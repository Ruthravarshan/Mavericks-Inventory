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
} from "drizzle-orm";
import { analyzeRisk } from "../lib/azure-openai.js";

const router = Router();

const createDistributionSchema = z.object({
  stockId: z.number().int().positive(),
  qtyRequested: z.number().positive(),
  distributionDate: z.string().min(1),
  recipientType: z.enum(["employee", "project"]),
  recipientId: z.string().min(1),
  recipientName: z.string().min(1),
  location: z.string().optional(),
  purpose: z.string().optional(),
});

const updateDistributionSchema = z.object({
  qtyRequested: z.number().positive().optional(),
  distributionDate: z.string().optional(),
  recipientType: z.enum(["employee", "project"]).optional(),
  recipientId: z.string().optional(),
  recipientName: z.string().optional(),
  location: z.string().optional(),
  purpose: z.string().optional(),
});

function generateTransactionCode(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TXN-${dateStr}-${random}`;
}

// ─── GET /distributions ───────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user!.role;
    const userId = req.user!.id;

    const statusFilter = req.query.status as string | undefined;
    const stockIdFilter = req.query.stockId ? Number(req.query.stockId) : undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const offset = (page - 1) * limit;

    const conditions = [];

    // Role-scoped visibility
    if (role === "executive") {
      conditions.push(eq(distributions.createdBy, userId));
    }

    if (statusFilter) {
      conditions.push(
        eq(
          distributions.status,
          statusFilter as
            | "draft"
            | "submitted"
            | "l1_pending"
            | "l2_pending"
            | "approved"
            | "rejected"
        )
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

    const rows = await db
      .select()
      .from(distributions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(distributions.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ data: rows, pagination: { page, limit, total: rows.length } });
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
      .where(and(eq(stocks.id, data.stockId)))
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
    if (data.qtyRequested > availableUnreserved) {
      res.status(400).json({
        error_code: "INSUFFICIENT_STOCK",
        message: `Only ${availableUnreserved} units are available. Requested: ${data.qtyRequested}`,
      });
      return;
    }

    const [dist] = await db
      .insert(distributions)
      .values({
        transactionCode: generateTransactionCode(),
        stockId: data.stockId,
        qtyRequested: data.qtyRequested,
        distributionDate: data.distributionDate,
        recipientType: data.recipientType,
        recipientId: data.recipientId,
        recipientName: data.recipientName,
        location: data.location,
        purpose: data.purpose,
        status: "draft",
        createdBy: req.user!.id,
      })
      .returning();

    await db.insert(activity).values({
      eventType: "distribution_created",
      description: `Distribution ${dist.transactionCode} created for ${data.qtyRequested} units of ${stock.stockName}`,
      actor: req.user!.email,
      entityType: "distribution",
      entityId: dist.id,
      newValue: JSON.stringify({ transactionCode: dist.transactionCode }),
      ipAddress: req.ip,
    });

    res.status(201).json(dist);
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

    // Role check for executive
    if (req.user!.role === "executive" && dist.createdBy !== req.user!.id) {
      res.status(403).json({ error_code: "FORBIDDEN", message: "Access denied" });
      return;
    }

    const [stock] = await db
      .select()
      .from(stocks)
      .where(eq(stocks.id, dist.stockId))
      .limit(1);

    res.json({ ...dist, stock });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /distributions/:id ─────────────────────────────────────────────────

router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
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

    const [updated] = await db
      .update(distributions)
      .set({
        ...parsed.data,
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

    res.json(updated);
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

    // Race condition protection — re-check availability
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

    // Get recipient history for AI
    const recipientHistory = await db
      .select({
        qtyRequested: distributions.qtyRequested,
        status: distributions.status,
      })
      .from(distributions)
      .where(
        and(
          eq(distributions.recipientId, dist.recipientId),
          eq(distributions.stockId, dist.stockId),
          ne(distributions.id, dist.id)
        )
      )
      .limit(20);

    // AI risk assessment
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

    // Update reserved quantity on stock
    await db
      .update(stocks)
      .set({
        reservedQuantity: stock.reservedQuantity + dist.qtyRequested,
        updatedAt: new Date(),
      })
      .where(eq(stocks.id, dist.stockId));

    // Update distribution status
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

    // Create approval record
    await db.insert(approvals).values({
      distributionId: id,
      status: "pending",
      aiRecommendation: riskResult.recommendation,
      aiRiskScore: String(riskResult.riskScore),
      aiRiskLevel: riskResult.riskLevel,
      aiReasoning: riskResult.reasoning,
      aiConfidence: riskResult.confidence,
    });

    // Notify all managers
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

    res.json({
      distribution: updatedDist,
      riskAssessment: riskResult,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
