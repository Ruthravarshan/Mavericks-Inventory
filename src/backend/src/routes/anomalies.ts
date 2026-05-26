import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { anomalies, stocks, activity } from "../db/schema/index.js";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

const router = Router();

function toAnomalyResponse(
  row: typeof anomalies.$inferSelect,
  stock: { stockCode: string; stockName: string } | null
) {
  return {
    id: String(row.id),
    stock_id: row.stockId ? String(row.stockId) : "",
    stock_code: stock?.stockCode ?? "",
    stock_name: stock?.stockName ?? "",
    anomaly_type: row.anomalyType,
    severity: row.severity,
    description: row.description,
    ai_explanation: row.explanation ?? "",
    recommended_action: row.recommendedAction ?? "",
    detected_at: row.detectedAt.toISOString(),
    status: row.dismissed ? "dismissed" : row.status,
    acknowledged_by: row.acknowledgedBy ?? null,
    acknowledged_at: row.acknowledgedAt?.toISOString() ?? null,
    resolved_by: row.resolvedBy ?? null,
    resolved_at: row.resolvedAt?.toISOString() ?? null,
    resolution_notes: row.resolutionNotes ?? null,
  };
}

// ─── GET /anomalies ───────────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const statusFilter = req.query.status as string | undefined;
    const severityFilter = req.query.severity as string | undefined;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const page_size = Math.min(100, Math.max(1, Number(req.query.page_size ?? req.query.limit ?? 20)));
    const offset = (page - 1) * page_size;

    const conditions = [];

    if (statusFilter && statusFilter !== "dismissed") {
      conditions.push(eq(anomalies.status, statusFilter as "active" | "acknowledged" | "resolved"));
    }

    if (severityFilter) {
      conditions.push(eq(anomalies.severity, severityFilter as "info" | "warning" | "critical"));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(anomalies)
      .where(whereClause);

    const rows = await db
      .select()
      .from(anomalies)
      .where(whereClause)
      .orderBy(desc(anomalies.detectedAt))
      .limit(page_size)
      .offset(offset);

    // Batch-fetch associated stocks
    const stockIds = [...new Set(rows.map((r) => r.stockId).filter(Boolean))] as number[];
    let stockMap: Record<number, { stockCode: string; stockName: string }> = {};
    if (stockIds.length > 0) {
      const stockRows = await db
        .select({ id: stocks.id, stockCode: stocks.stockCode, stockName: stocks.stockName })
        .from(stocks)
        .where(inArray(stocks.id, stockIds));
      stockMap = Object.fromEntries(stockRows.map((s) => [s.id, s]));
    }

    const totalNum = Number(total);
    res.json({
      items: rows.map((r) => toAnomalyResponse(r, r.stockId ? (stockMap[r.stockId] ?? null) : null)),
      total: totalNum,
      page,
      page_size,
      total_pages: Math.ceil(totalNum / page_size),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /anomalies/:id/acknowledge ─────────────────────────────────────────

router.post("/:id/acknowledge", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error_code: "INVALID_ID", message: "Invalid ID" });
      return;
    }

    const [anomaly] = await db
      .select()
      .from(anomalies)
      .where(eq(anomalies.id, id))
      .limit(1);

    if (!anomaly) {
      res.status(404).json({ error_code: "NOT_FOUND", message: "Anomaly not found" });
      return;
    }

    if (anomaly.status !== "active") {
      res.status(400).json({
        error_code: "INVALID_STATE",
        message: "Only active anomalies can be acknowledged",
      });
      return;
    }

    await db
      .update(anomalies)
      .set({ status: "acknowledged", acknowledgedBy: req.user!.name, acknowledgedAt: new Date() })
      .where(eq(anomalies.id, id));

    await db.insert(activity).values({
      eventType: "anomaly_acknowledged",
      description: `Anomaly ${id} (${anomaly.anomalyType}) acknowledged by ${req.user!.name}`,
      actor: req.user!.email,
      entityType: "anomaly",
      entityId: id,
      ipAddress: req.ip,
    });

    res.json({ message: "Anomaly acknowledged" });
  } catch (err) {
    next(err);
  }
});

// ─── POST /anomalies/:id/resolve ──────────────────────────────────────────────

router.post("/:id/resolve", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error_code: "INVALID_ID", message: "Invalid ID" });
      return;
    }

    // Accept both `notes` (frontend) and `resolutionNotes` (legacy)
    const schema = z.object({
      notes: z.string().min(1).optional(),
      resolutionNotes: z.string().min(1).optional(),
    });

    const parsed = schema.safeParse(req.body);
    const notes = (parsed.success ? (parsed.data.notes ?? parsed.data.resolutionNotes) : undefined) ?? "";

    if (!notes || notes.length < 5) {
      res.status(400).json({
        error_code: "VALIDATION_ERROR",
        message: "Resolution notes required (min 5 characters)",
      });
      return;
    }

    const [anomaly] = await db
      .select()
      .from(anomalies)
      .where(eq(anomalies.id, id))
      .limit(1);

    if (!anomaly) {
      res.status(404).json({ error_code: "NOT_FOUND", message: "Anomaly not found" });
      return;
    }

    if (anomaly.status === "resolved") {
      res.status(400).json({ error_code: "ALREADY_RESOLVED", message: "Anomaly is already resolved" });
      return;
    }

    await db
      .update(anomalies)
      .set({
        status: "resolved",
        resolvedBy: req.user!.name,
        resolvedAt: new Date(),
        resolutionNotes: notes,
      })
      .where(eq(anomalies.id, id));

    await db.insert(activity).values({
      eventType: "anomaly_resolved",
      description: `Anomaly ${id} (${anomaly.anomalyType}) resolved by ${req.user!.name}`,
      actor: req.user!.email,
      entityType: "anomaly",
      entityId: id,
      newValue: JSON.stringify({ resolutionNotes: notes }),
      ipAddress: req.ip,
    });

    res.json({ message: "Anomaly resolved" });
  } catch (err) {
    next(err);
  }
});

// ─── POST /anomalies/:id/dismiss ──────────────────────────────────────────────

router.post("/:id/dismiss", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error_code: "INVALID_ID", message: "Invalid ID" });
      return;
    }

    const [anomaly] = await db
      .select()
      .from(anomalies)
      .where(eq(anomalies.id, id))
      .limit(1);

    if (!anomaly) {
      res.status(404).json({ error_code: "NOT_FOUND", message: "Anomaly not found" });
      return;
    }

    await db
      .update(anomalies)
      .set({ dismissed: true })
      .where(eq(anomalies.id, id));

    await db.insert(activity).values({
      eventType: "anomaly_dismissed",
      description: `Anomaly ${id} dismissed by ${req.user!.name}`,
      actor: req.user!.email,
      entityType: "anomaly",
      entityId: id,
      ipAddress: req.ip,
    });

    res.json({ message: "Anomaly dismissed" });
  } catch (err) {
    next(err);
  }
});

export default router;
