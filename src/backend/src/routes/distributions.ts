import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import {
  distributions,
  stocks,
  approvals,
  activity,
  notifications,
  users,
} from "../db/schema/index.js";
import {
  eq,
  and,
  gte,
  lte,
  desc,
  ne,
  sql,
  inArray,
  type SQL,
} from "drizzle-orm";
import { analyzeRisk } from "../lib/azure-openai.js";

const router = Router();

// Accept snake_case from frontend, matching CreateDistributionRequest type
const createDistributionSchema = z.object({
  stock_id: z.coerce.number().int().positive(),
  qty_requested: z.coerce.number().positive(),
  distribution_date: z.string().min(1),
  recipient_type: z.enum(["employee", "project"]),
  recipient_id: z.string().min(1),
  recipient_name: z.string().min(1),
  location: z.string().optional(),
  purpose: z.string().optional(),
});

const updateDistributionSchema = z.object({
  qty_requested: z.coerce.number().positive().optional(),
  distribution_date: z.string().optional(),
  recipient_type: z.enum(["employee", "project"]).optional(),
  recipient_id: z.string().optional(),
  recipient_name: z.string().optional(),
  location: z.string().optional(),
  purpose: z.string().optional(),
});

function generateTransactionCode(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TXN-${dateStr}-${random}`;
}

function deriveRiskLevel(score: string | null): "Low" | "Medium" | "High" {
  const n = Number(score ?? 0);
  if (n >= 70) return "High";
  if (n >= 40) return "Medium";
  return "Low";
}

function toDistributionResponse(
  row: typeof distributions.$inferSelect,
  stock: { stockCode: string; stockName: string; category: string; unitOfMeasure: string } | null,
  createdByName?: string
) {
  return {
    id: String(row.id),
    transaction_code: row.transactionCode,
    stock_id: String(row.stockId),
    stock_code: stock?.stockCode ?? "",
    stock_name: stock?.stockName ?? "",
    stock_category: stock?.category ?? "",
    qty_requested: row.qtyRequested,
    qty_approved: row.status === "approved" ? row.qtyRequested : null,
    uom: stock?.unitOfMeasure ?? "",
    recipient_type: row.recipientType,
    recipient_id: row.recipientId,
    recipient_name: row.recipientName,
    distribution_date: row.distributionDate,
    location: row.location ?? "",
    purpose: row.purpose ?? "",
    status: row.status,
    risk_score: Number(row.aiRiskScore ?? 0),
    risk_level: deriveRiskLevel(row.aiRiskScore),
    ai_recommendation: (row.aiRecommendation ?? "Review") as "Approve" | "Review" | "Reject",
    ai_reasoning: row.aiReasoning ?? "",
    submitted_at: row.submittedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
    created_by: String(row.createdBy),
    created_by_name: createdByName ?? "",
    approval_history: [],
  };
}

// ─── GET /distributions ───────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user!.role;
    const userId = req.user!.id;

    const statusFilter = req.query.status as string | undefined;
    const stockIdFilter = req.query.stock_id ? Number(req.query.stock_id) : undefined;
    const dateFrom = req.query.date_from as string | undefined;
    const dateTo = req.query.date_to as string | undefined;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const page_size = Math.min(100, Math.max(1, Number(req.query.page_size ?? req.query.limit ?? 20)));
    const offset = (page - 1) * page_size;

    const conditions: SQL<unknown>[] = [];

    if (role === "executive") {
      conditions.push(eq(distributions.createdBy, userId));
    }

    if (statusFilter) {
      conditions.push(
        eq(distributions.status, statusFilter as "draft" | "submitted" | "l1_pending" | "l2_pending" | "approved" | "rejected")
      );
    }

    if (stockIdFilter) {
      conditions.push(eq(distributions.stockId, stockIdFilter));
    }

    if (dateFrom) {
      conditions.push(gte(distributions.createdAt, new Date(dateFrom)));
    }

    if (dateTo) {
      conditions.push(lte(distributions.createdAt, new Date(dateTo)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(distributions)
      .where(whereClause);

    const rows = await db
      .select()
      .from(distributions)
      .where(whereClause)
      .orderBy(desc(distributions.createdAt))
      .limit(page_size)
      .offset(offset);

    // Fetch associated stocks in one query
    const stockIds = [...new Set(rows.map((r) => r.stockId))];
    let stockMap: Record<number, { stockCode: string; stockName: string; category: string; unitOfMeasure: string }> = {};
    if (stockIds.length > 0) {
      const stockRows = await db
        .select({
          id: stocks.id,
          stockCode: stocks.stockCode,
          stockName: stocks.stockName,
          category: stocks.category,
          unitOfMeasure: stocks.unitOfMeasure,
        })
        .from(stocks)
        .where(inArray(stocks.id, stockIds));
      stockMap = Object.fromEntries(stockRows.map((s) => [s.id, s]));
    }

    const totalNum = Number(total);
    res.json({
      items: rows.map((r) => toDistributionResponse(r, stockMap[r.stockId] ?? null)),
      total: totalNum,
      page,
      page_size,
      total_pages: Math.ceil(totalNum / page_size),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /distributions ──────────────────────────────────────────────────────

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createDistributionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error_code: "VALIDATION_ERROR",
        message: "Invalid distribution data",
        details: parsed.error.flatten(),
      });
      return;
    }

    const data = parsed.data;

    const [stock] = await db
      .select()
      .from(stocks)
      .where(eq(stocks.id, data.stock_id))
      .limit(1);

    if (!stock) {
      res.status(404).json({ error_code: "STOCK_NOT_FOUND", message: "Stock not found" });
      return;
    }

    if (stock.status !== "active") {
      res.status(400).json({
        error_code: "STOCK_NOT_ACTIVE",
        message: "Distributions can only be created for active stock items",
      });
      return;
    }

    const availableUnreserved = stock.availableQuantity - stock.reservedQuantity;
    if (data.qty_requested > availableUnreserved) {
      res.status(400).json({
        error_code: "INSUFFICIENT_STOCK",
        message: `Only ${availableUnreserved} units are available. Requested: ${data.qty_requested}`,
      });
      return;
    }

    const [dist] = await db
      .insert(distributions)
      .values({
        transactionCode: generateTransactionCode(),
        stockId: data.stock_id,
        qtyRequested: data.qty_requested,
        distributionDate: data.distribution_date,
        recipientType: data.recipient_type,
        recipientId: data.recipient_id,
        recipientName: data.recipient_name,
        location: data.location,
        purpose: data.purpose,
        status: "draft",
        createdBy: req.user!.id,
      })
      .returning();

    await db.insert(activity).values({
      eventType: "distribution_created",
      description: `Distribution ${dist.transactionCode} created for ${data.qty_requested} units of ${stock.stockName}`,
      actor: req.user!.email,
      entityType: "distribution",
      entityId: dist.id,
      newValue: JSON.stringify({ transactionCode: dist.transactionCode }),
      ipAddress: req.ip,
    });

    res.status(201).json(toDistributionResponse(dist, stock));
  } catch (err) {
    next(err);
  }
});

// ─── GET /distributions/:id ───────────────────────────────────────────────────

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error_code: "INVALID_ID", message: "Invalid distribution ID" });
      return;
    }

    const [dist] = await db
      .select()
      .from(distributions)
      .where(eq(distributions.id, id))
      .limit(1);

    if (!dist) {
      res.status(404).json({ error_code: "NOT_FOUND", message: "Distribution not found" });
      return;
    }

    if (req.user!.role === "executive" && dist.createdBy !== req.user!.id) {
      res.status(403).json({ error_code: "FORBIDDEN", message: "Access denied" });
      return;
    }

    const [stock] = await db
      .select()
      .from(stocks)
      .where(eq(stocks.id, dist.stockId))
      .limit(1);

    res.json(toDistributionResponse(dist, stock ?? null));
  } catch (err) {
    next(err);
  }
});

// ─── PUT /distributions/:id ───────────────────────────────────────────────────

router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error_code: "INVALID_ID", message: "Invalid ID" });
      return;
    }

    const [dist] = await db
      .select()
      .from(distributions)
      .where(eq(distributions.id, id))
      .limit(1);

    if (!dist) {
      res.status(404).json({ error_code: "NOT_FOUND", message: "Distribution not found" });
      return;
    }

    if (dist.status !== "draft" && dist.status !== "rejected") {
      res.status(400).json({
        error_code: "CANNOT_UPDATE",
        message: "Only draft or rejected distributions can be updated",
      });
      return;
    }

    if (req.user!.role === "executive" && dist.createdBy !== req.user!.id) {
      res.status(403).json({ error_code: "FORBIDDEN", message: "Access denied" });
      return;
    }

    const parsed = updateDistributionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error_code: "VALIDATION_ERROR",
        message: "Invalid update data",
        details: parsed.error.flatten(),
      });
      return;
    }

    const { qty_requested, distribution_date, recipient_type, recipient_id, recipient_name, ...rest } = parsed.data;

    const [updated] = await db
      .update(distributions)
      .set({
        ...(qty_requested !== undefined ? { qtyRequested: qty_requested } : {}),
        ...(distribution_date ? { distributionDate: distribution_date } : {}),
        ...(recipient_type ? { recipientType: recipient_type } : {}),
        ...(recipient_id ? { recipientId: recipient_id } : {}),
        ...(recipient_name ? { recipientName: recipient_name } : {}),
        ...(rest.location !== undefined ? { location: rest.location } : {}),
        ...(rest.purpose !== undefined ? { purpose: rest.purpose } : {}),
        updatedBy: req.user!.id,
        updatedAt: new Date(),
      })
      .where(eq(distributions.id, id))
      .returning();

    await db.insert(activity).values({
      eventType: "distribution_updated",
      description: `Distribution ${dist.transactionCode} updated`,
      actor: req.user!.email,
      entityType: "distribution",
      entityId: id,
      ipAddress: req.ip,
    });

    const [stock] = await db.select().from(stocks).where(eq(stocks.id, updated.stockId)).limit(1);
    res.json(toDistributionResponse(updated, stock ?? null));
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /distributions/:id ────────────────────────────────────────────────

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error_code: "INVALID_ID", message: "Invalid ID" });
      return;
    }

    const [dist] = await db
      .select()
      .from(distributions)
      .where(eq(distributions.id, id))
      .limit(1);

    if (!dist) {
      res.status(404).json({ error_code: "NOT_FOUND", message: "Distribution not found" });
      return;
    }

    if (dist.status !== "draft") {
      res.status(400).json({
        error_code: "CANNOT_DELETE",
        message: "Only draft distributions can be deleted",
      });
      return;
    }

    if (req.user!.role === "executive" && dist.createdBy !== req.user!.id) {
      res.status(403).json({ error_code: "FORBIDDEN", message: "Access denied" });
      return;
    }

    await db.delete(distributions).where(eq(distributions.id, id));

    await db.insert(activity).values({
      eventType: "distribution_deleted",
      description: `Distribution ${dist.transactionCode} deleted`,
      actor: req.user!.email,
      entityType: "distribution",
      entityId: id,
      ipAddress: req.ip,
    });

    res.json({ message: "Distribution deleted" });
  } catch (err) {
    next(err);
  }
});

// ─── POST /distributions/:id/submit ──────────────────────────────────────────

router.post("/:id/submit", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error_code: "INVALID_ID", message: "Invalid ID" });
      return;
    }

    const [dist] = await db
      .select()
      .from(distributions)
      .where(eq(distributions.id, id))
      .limit(1);

    if (!dist) {
      res.status(404).json({ error_code: "NOT_FOUND", message: "Distribution not found" });
      return;
    }

    if (dist.status !== "draft" && dist.status !== "rejected") {
      res.status(400).json({
        error_code: "ALREADY_SUBMITTED",
        message: "Distribution is already submitted",
      });
      return;
    }

    if (req.user!.role === "executive" && dist.createdBy !== req.user!.id) {
      res.status(403).json({ error_code: "FORBIDDEN", message: "Access denied" });
      return;
    }

    const [stock] = await db
      .select()
      .from(stocks)
      .where(eq(stocks.id, dist.stockId))
      .limit(1);

    if (!stock) {
      res.status(404).json({ error_code: "STOCK_NOT_FOUND", message: "Stock not found" });
      return;
    }

    const available = stock.availableQuantity - stock.reservedQuantity;
    if (dist.qtyRequested > available) {
      res.status(400).json({
        error_code: "INSUFFICIENT_STOCK",
        message: `Only ${available} units available at time of submission`,
      });
      return;
    }

    const recipientHistory = await db
      .select({ qtyRequested: distributions.qtyRequested, status: distributions.status })
      .from(distributions)
      .where(
        and(
          eq(distributions.recipientId, dist.recipientId),
          eq(distributions.stockId, dist.stockId),
          ne(distributions.id, dist.id)
        )
      )
      .limit(20);

    const riskResult = await analyzeRisk(
      {
        qtyRequested: dist.qtyRequested,
        recipientName: dist.recipientName,
        purpose: dist.purpose,
        recipientType: dist.recipientType,
      },
      recipientHistory,
      {
        stockName: stock.stockName,
        availableQuantity: stock.availableQuantity,
        minStockLevel: stock.minStockLevel,
        category: stock.category,
      }
    );

    await db
      .update(stocks)
      .set({
        reservedQuantity: stock.reservedQuantity + dist.qtyRequested,
        updatedAt: new Date(),
      })
      .where(eq(stocks.id, dist.stockId));

    const [updatedDist] = await db
      .update(distributions)
      .set({
        status: "l1_pending",
        aiRiskScore: String(riskResult.riskScore),
        aiRecommendation: riskResult.recommendation,
        aiReasoning: riskResult.reasoning,
        aiConfidence: riskResult.confidence,
        submittedBy: req.user!.id,
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(distributions.id, id))
      .returning();

    await db.insert(approvals).values({
      distributionId: id,
      status: "pending",
      aiRecommendation: riskResult.recommendation,
      aiRiskScore: String(riskResult.riskScore),
      aiRiskLevel: riskResult.riskLevel,
      aiReasoning: riskResult.reasoning,
      aiConfidence: riskResult.confidence,
    });

    const managers = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.isActive, true),
          sql`role IN ('manager', 'management_authority', 'admin')`
        )
      );

    if (managers.length > 0) {
      await db.insert(notifications).values(
        managers.map((m) => ({
          userId: m.id,
          type: "approval_required",
          title: "New Distribution Awaiting Approval",
          message: `Distribution ${dist.transactionCode} from ${dist.recipientName} requires review. Risk: ${riskResult.riskLevel}`,
          relatedEntityType: "distribution",
          relatedEntityId: id,
        }))
      );
    }

    await db.insert(activity).values({
      eventType: "distribution_submitted",
      description: `Distribution ${dist.transactionCode} submitted for approval. AI risk: ${riskResult.riskLevel}`,
      actor: req.user!.email,
      entityType: "distribution",
      entityId: id,
      newValue: JSON.stringify({ riskLevel: riskResult.riskLevel }),
      ipAddress: req.ip,
    });

    res.json(toDistributionResponse(updatedDist, stock));
  } catch (err) {
    next(err);
  }
});

export default router;
