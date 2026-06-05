import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import {
  stocks,
  stockLedger,
  activity,
  distributions,
} from "../db/schema/index.js";
import {
  eq,
  and,
  isNull,
  ilike,
  or,
  desc,
  ne,
  sql,
} from "drizzle-orm";
import { requireRole } from "../middleware/rbac.js";
import { indexStockItem, deleteIndex } from "../lib/azure-search.js";
import type { Stock as DBStock } from "../db/schema/stocks.js";

const router = Router();

// Accept snake_case from frontend, matching CreateStockRequest type
const createStockSchema = z.object({
  stock_code: z.string().min(2).max(50),
  name: z.string().min(2).max(200),
  category: z.string().min(1),
  uom: z.string().min(1),
  total_qty: z.coerce.number().min(0),
  available_qty: z.coerce.number().min(0).optional(),
  min_level: z.coerce.number().min(0).default(0),
  max_level: z.coerce.number().min(0).default(0),
  location: z.string().optional(),
  status: z.enum(["draft", "active", "inactive"]).default("draft"),
  description: z.string().optional(),
});

const updateStockSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  category: z.string().optional(),
  uom: z.string().optional(),
  min_level: z.coerce.number().min(0).optional(),
  max_level: z.coerce.number().min(0).optional(),
  location: z.string().optional(),
  status: z.enum(["draft", "active", "inactive"]).optional(),
  description: z.string().optional(),
});

function calcHealthScore(availableQuantity: number, minStockLevel: number): number {
  if (minStockLevel <= 0) return 100;
  if (availableQuantity >= minStockLevel * 1.5) return 85;
  if (availableQuantity >= minStockLevel) return 60;
  return 25;
}

function toStockResponse(row: DBStock) {
  const score = row.healthScore;
  return {
    id: String(row.id),
    stock_code: row.stockCode,
    name: row.stockName,
    category: row.category,
    uom: row.unitOfMeasure,
    total_qty: row.openingQuantity,
    available_qty: row.availableQuantity,
    reserved_qty: row.reservedQuantity ?? 0,
    distributed_qty: Math.max(0, row.openingQuantity - row.availableQuantity),
    min_level: row.minStockLevel,
    max_level: row.maxStockLevel ?? 0,
    location: row.location ?? "",
    status: row.status,
    description: row.description ?? "",
    health_score: score,
    health_status: score >= 70 ? "healthy" : score >= 40 ? "warning" : "critical",
    last_updated: (row.updatedAt ?? row.createdAt).toISOString(),
    created_at: row.createdAt.toISOString(),
    created_by: String(row.createdBy),
  };
}

// ─── GET /stocks ──────────────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = req.query.category as string | undefined;
    const location = req.query.location as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const page_size = Math.min(100, Math.max(1, Number(req.query.page_size ?? req.query.limit ?? 20)));
    const offset = (page - 1) * page_size;

    const conditions = [isNull(stocks.deletedAt)];

    if (category) conditions.push(ilike(stocks.category, `%${category}%`));
    if (location) conditions.push(ilike(stocks.location, `%${location}%`));
    if (status) conditions.push(eq(stocks.status, status as "draft" | "active" | "inactive"));
    if (search) {
      conditions.push(
        or(
          ilike(stocks.stockName, `%${search}%`),
          ilike(stocks.stockCode, `%${search}%`),
          ilike(stocks.category, `%${search}%`)
        )!
      );
    }

    const [{ total }] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(stocks)
      .where(and(...conditions));

    const rows = await db
      .select()
      .from(stocks)
      .where(and(...conditions))
      .orderBy(desc(stocks.createdAt))
      .limit(page_size)
      .offset(offset);

    const totalNum = Number(total);
    res.json({
      items: rows.map(toStockResponse),
      total: totalNum,
      page,
      page_size,
      total_pages: Math.ceil(totalNum / page_size),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /stocks/export ───────────────────────────────────────────────────────

router.get("/export", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await db
      .select()
      .from(stocks)
      .where(and(isNull(stocks.deletedAt), eq(stocks.status, "active")))
      .orderBy(stocks.stockCode);

    // Build CSV
    const header = "Stock Code,Name,Category,UOM,Available Qty,Min Level,Location,Health Score,Status\n";
    const csv = rows.map((r) =>
      [r.stockCode, r.stockName, r.category, r.unitOfMeasure, r.availableQuantity,
        r.minStockLevel, r.location ?? "", r.healthScore, r.status].join(",")
    ).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="stocks-${Date.now()}.csv"`);
    res.send(header + csv);
  } catch (err) {
    next(err);
  }
});

// ─── POST /stocks ─────────────────────────────────────────────────────────────

router.post(
  "/",
  requireRole("manager", "admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createStockSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error_code: "VALIDATION_ERROR",
          message: "Invalid stock data",
          details: parsed.error.flatten(),
        });
        return;
      }

      const data = parsed.data;
      const openingQty = data.total_qty;
      const availQty = data.available_qty ?? openingQty;
      const healthScore = calcHealthScore(availQty, data.min_level);

      const [stock] = await db
        .insert(stocks)
        .values({
          stockCode: data.stock_code.toUpperCase(),
          stockName: data.name,
          category: data.category,
          unitOfMeasure: data.uom,
          openingQuantity: openingQty,
          availableQuantity: availQty,
          reservedQuantity: 0,
          minStockLevel: data.min_level,
          maxStockLevel: data.max_level,
          location: data.location,
          description: data.description,
          status: data.status,
          healthScore,
          createdBy: req.user!.id,
        })
        .returning();

      await db.insert(stockLedger).values({
        stockId: stock.id,
        movementType: "opening",
        quantity: openingQty,
        runningBalance: openingQty,
        performedBy: req.user!.name,
        performedAt: new Date(),
        source: "manual_entry",
        remarks: "Opening balance",
      });

      await indexStockItem(stock);

      await db.insert(activity).values({
        eventType: "stock_created",
        description: `Stock item "${stock.stockName}" (${stock.stockCode}) created`,
        actor: req.user!.email,
        entityType: "stock",
        entityId: stock.id,
        newValue: JSON.stringify({ stockCode: stock.stockCode, stockName: stock.stockName }),
        ipAddress: req.ip,
      });

      res.status(201).json(toStockResponse(stock));
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException & { code?: string }).code === "23505") {
        res.status(409).json({
          error_code: "DUPLICATE_STOCK_CODE",
          message: "A stock item with this code already exists",
        });
        return;
      }
      next(err);
    }
  }
);

// ─── GET /stocks/:id ──────────────────────────────────────────────────────────

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error_code: "INVALID_ID", message: "Invalid stock ID" });
      return;
    }

    const [stock] = await db
      .select()
      .from(stocks)
      .where(and(eq(stocks.id, id), isNull(stocks.deletedAt)))
      .limit(1);

    if (!stock) {
      res.status(404).json({ error_code: "NOT_FOUND", message: "Stock not found" });
      return;
    }

    res.json(toStockResponse(stock));
  } catch (err) {
    next(err);
  }
});

// ─── PUT /stocks/:id ──────────────────────────────────────────────────────────

router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error_code: "INVALID_ID", message: "Invalid stock ID" });
      return;
    }

    const [existing] = await db
      .select()
      .from(stocks)
      .where(and(eq(stocks.id, id), isNull(stocks.deletedAt)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error_code: "NOT_FOUND", message: "Stock not found" });
      return;
    }

    if (existing.status === "inactive") {
      res.status(400).json({
        error_code: "STOCK_INACTIVE",
        message: "Cannot update an inactive stock item",
      });
      return;
    }

    const parsed = updateStockSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error_code: "VALIDATION_ERROR",
        message: "Invalid update data",
        details: parsed.error.flatten(),
      });
      return;
    }

    const { name, uom, min_level, ...rest } = parsed.data;
    const newMinLevel = min_level ?? existing.minStockLevel;
    const newHealthScore = calcHealthScore(existing.availableQuantity, newMinLevel);

    const [updated] = await db
      .update(stocks)
      .set({
        ...(name ? { stockName: name } : {}),
        ...(uom ? { unitOfMeasure: uom } : {}),
        ...(min_level !== undefined ? { minStockLevel: min_level } : {}),
        ...(rest.category ? { category: rest.category } : {}),
        ...(rest.location !== undefined ? { location: rest.location } : {}),
        ...(rest.status ? { status: rest.status } : {}),
        ...(rest.description !== undefined ? { description: rest.description } : {}),
        healthScore: newHealthScore,
        updatedBy: req.user!.id,
        updatedAt: new Date(),
      })
      .where(eq(stocks.id, id))
      .returning();

    await indexStockItem(updated);

    await db.insert(activity).values({
      eventType: "stock_updated",
      description: `Stock item "${updated.stockName}" updated`,
      actor: req.user!.email,
      entityType: "stock",
      entityId: updated.id,
      oldValue: JSON.stringify({ status: existing.status }),
      newValue: JSON.stringify(parsed.data),
      ipAddress: req.ip,
    });

    res.json(toStockResponse(updated));
  } catch (err) {
    next(err);
  }
});

// ─── POST /stocks/:id/activate ────────────────────────────────────────────────
// Moves a draft OR inactive stock item to "active". Dedicated endpoint because
// PUT /:id refuses to touch inactive rows.

router.post(
  "/:id/activate",
  requireRole("manager", "admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error_code: "INVALID_ID", message: "Invalid stock ID" });
        return;
      }

      const [existing] = await db
        .select()
        .from(stocks)
        .where(and(eq(stocks.id, id), isNull(stocks.deletedAt)))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error_code: "NOT_FOUND", message: "Stock not found" });
        return;
      }
      if (existing.status === "active") {
        res.status(400).json({ error_code: "INVALID_STATUS", message: "Stock is already active" });
        return;
      }

      const [updated] = await db
        .update(stocks)
        .set({ status: "active", updatedBy: req.user!.id, updatedAt: new Date() })
        .where(eq(stocks.id, id))
        .returning();

      await indexStockItem(updated);

      await db.insert(activity).values({
        eventType: "stock_activated",
        description: `Stock item "${updated.stockName}" activated`,
        actor: req.user!.email,
        entityType: "stock",
        entityId: updated.id,
        oldValue: JSON.stringify({ status: existing.status }),
        newValue: JSON.stringify({ status: "active" }),
        ipAddress: req.ip,
      });

      res.json(toStockResponse(updated));
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /stocks/:id/deactivate ──────────────────────────────────────────────
// Moves an active stock item to "inactive" (archived).

router.post(
  "/:id/deactivate",
  requireRole("manager", "admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error_code: "INVALID_ID", message: "Invalid stock ID" });
        return;
      }

      const [existing] = await db
        .select()
        .from(stocks)
        .where(and(eq(stocks.id, id), isNull(stocks.deletedAt)))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error_code: "NOT_FOUND", message: "Stock not found" });
        return;
      }
      if (existing.status !== "active") {
        res.status(400).json({
          error_code: "INVALID_STATUS",
          message: "Only active stocks can be deactivated",
        });
        return;
      }

      const [updated] = await db
        .update(stocks)
        .set({ status: "inactive", updatedBy: req.user!.id, updatedAt: new Date() })
        .where(eq(stocks.id, id))
        .returning();

      await indexStockItem(updated);

      await db.insert(activity).values({
        eventType: "stock_deactivated",
        description: `Stock item "${updated.stockName}" deactivated`,
        actor: req.user!.email,
        entityType: "stock",
        entityId: updated.id,
        oldValue: JSON.stringify({ status: existing.status }),
        newValue: JSON.stringify({ status: "inactive" }),
        ipAddress: req.ip,
      });

      res.json(toStockResponse(updated));
    } catch (err) {
      next(err);
    }
  }
);

// ─── DELETE /stocks/:id ───────────────────────────────────────────────────────

router.delete(
  "/:id",
  requireRole("admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error_code: "INVALID_ID", message: "Invalid stock ID" });
        return;
      }

      const [existing] = await db
        .select()
        .from(stocks)
        .where(and(eq(stocks.id, id), isNull(stocks.deletedAt)))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error_code: "NOT_FOUND", message: "Stock not found" });
        return;
      }

      if (existing.status !== "draft") {
        res.status(400).json({
          error_code: "CANNOT_DELETE",
          message: "Only draft stock items can be deleted",
        });
        return;
      }

      const [distCheck] = await db
        .select({ id: distributions.id })
        .from(distributions)
        .where(and(eq(distributions.stockId, id), ne(distributions.status, "draft")))
        .limit(1);

      if (distCheck) {
        res.status(400).json({
          error_code: "HAS_DISTRIBUTIONS",
          message: "Cannot delete stock item with active distributions",
        });
        return;
      }

      await db
        .update(stocks)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(stocks.id, id));

      await deleteIndex(id);

      await db.insert(activity).values({
        eventType: "stock_deleted",
        description: `Stock item "${existing.stockName}" (${existing.stockCode}) soft deleted`,
        actor: req.user!.email,
        entityType: "stock",
        entityId: id,
        ipAddress: req.ip,
      });

      res.json({ message: "Stock item deleted" });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /stocks/:id/ledger ───────────────────────────────────────────────────

router.get("/:id/ledger", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error_code: "INVALID_ID", message: "Invalid stock ID" });
      return;
    }

    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const offset = (page - 1) * limit;

    const [stock] = await db
      .select({ id: stocks.id })
      .from(stocks)
      .where(and(eq(stocks.id, id), isNull(stocks.deletedAt)))
      .limit(1);

    if (!stock) {
      res.status(404).json({ error_code: "NOT_FOUND", message: "Stock not found" });
      return;
    }

    const ledgerEntries = await db
      .select()
      .from(stockLedger)
      .where(eq(stockLedger.stockId, id))
      .orderBy(desc(stockLedger.performedAt))
      .limit(limit)
      .offset(offset);

    res.json({
      data: ledgerEntries,
      pagination: { page, limit, total: ledgerEntries.length },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
