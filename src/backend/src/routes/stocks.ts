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
  asc,
  ne,
} from "drizzle-orm";
import { requireRole } from "../middleware/rbac.js";
import { indexStockItem, deleteIndex } from "../lib/azure-search.js";

const router = Router();

const createStockSchema = z.object({
  stockCode: z.string().min(1).max(50),
  stockName: z.string().min(1).max(200),
  category: z.string().min(1),
  subCategory: z.string().optional(),
  unitOfMeasure: z.string().min(1),
  openingQuantity: z.number().min(0),
  minStockLevel: z.number().min(0).default(0),
  location: z.string().optional(),
  description: z.string().optional(),
  assetTagPrefix: z.string().optional(),
});

const updateStockSchema = z.object({
  stockName: z.string().min(1).max(200).optional(),
  category: z.string().min(1).optional(),
  subCategory: z.string().optional(),
  unitOfMeasure: z.string().min(1).optional(),
  minStockLevel: z.number().min(0).optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  assetTagPrefix: z.string().optional(),
  status: z.enum(["draft", "active", "inactive"]).optional(),
});

function calcHealthScore(
  availableQuantity: number,
  minStockLevel: number
): number {
  if (minStockLevel <= 0) return 100;
  if (availableQuantity >= minStockLevel * 1.5) return 85;
  if (availableQuantity >= minStockLevel) return 60;
  return 25;
}

// ─── GET /stocks ──────────────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = req.query.category as string | undefined;
    const location = req.query.location as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const offset = (page - 1) * limit;

    const conditions = [isNull(stocks.deletedAt)];

    if (category) conditions.push(ilike(stocks.category, `%${category}%`));
    if (location) conditions.push(ilike(stocks.location ?? stocks.stockName, `%${location}%`));
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

    const rows = await db
      .select()
      .from(stocks)
      .where(and(...conditions))
      .orderBy(desc(stocks.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      data: rows,
      pagination: {
        page,
        limit,
        total: rows.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /stocks ─────────────────────────────────────────────────────────────

router.post(
  "/",
  requireRole("executive", "admin"),
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
      const healthScore = calcHealthScore(data.openingQuantity, data.minStockLevel);

      const [stock] = await db
        .insert(stocks)
        .values({
          stockCode: data.stockCode.toUpperCase(),
          stockName: data.stockName,
          category: data.category,
          subCategory: data.subCategory,
          unitOfMeasure: data.unitOfMeasure,
          openingQuantity: data.openingQuantity,
          availableQuantity: data.openingQuantity,
          reservedQuantity: 0,
          minStockLevel: data.minStockLevel,
          location: data.location,
          description: data.description,
          assetTagPrefix: data.assetTagPrefix,
          status: "draft",
          healthScore,
          createdBy: req.user!.id,
        })
        .returning();

      // Opening ledger entry
      await db.insert(stockLedger).values({
        stockId: stock.id,
        movementType: "opening",
        quantity: data.openingQuantity,
        runningBalance: data.openingQuantity,
        performedBy: req.user!.name,
        performedAt: new Date(),
        source: "manual_entry",
        remarks: "Opening balance",
      });

      // Index in Azure Search
      await indexStockItem(stock);

      // Log activity
      await db.insert(activity).values({
        eventType: "stock_created",
        description: `Stock item "${stock.stockName}" (${stock.stockCode}) created`,
        actor: req.user!.email,
        entityType: "stock",
        entityId: stock.id,
        newValue: JSON.stringify({ stockCode: stock.stockCode, stockName: stock.stockName }),
        ipAddress: req.ip,
      });

      res.status(201).json(stock);
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

    res.json(stock);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /stocks/:id ────────────────────────────────────────────────────────

router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
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

    const updateData = parsed.data;
    const newMinLevel = updateData.minStockLevel ?? existing.minStockLevel;
    const newHealthScore = calcHealthScore(existing.availableQuantity, newMinLevel);

    const [updated] = await db
      .update(stocks)
      .set({
        ...updateData,
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
      newValue: JSON.stringify(updateData),
      ipAddress: req.ip,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

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

      // Check for distributions
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
