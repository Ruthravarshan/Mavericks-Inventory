import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db/index.js";
import {
  stocks,
  distributions,
  approvals,
  anomalies,
  activity,
  stockLedger,
} from "../db/schema/index.js";
import { sql, eq, and, isNull, desc } from "drizzle-orm";

const router = Router();

function toRows(records: object[]): Record<string, unknown>[] {
  return records.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      out[k] = v instanceof Date ? v.toISOString() : v ?? "—";
    }
    return out;
  });
}

function healthLabel(score: number): string {
  if (score >= 70) return "healthy";
  if (score >= 40) return "warning";
  return "critical";
}

// ─── GET /reports/:type ───────────────────────────────────────────────────────

router.get("/:type", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type } = req.params;
    const q = req.query as Record<string, string>;

    let columns: { key: string; label: string; type: string }[] = [];
    let rows: Record<string, unknown>[] = [];

    switch (type) {
      case "stock-availability": {
        columns = [
          { key: "stock_code", label: "Code", type: "string" },
          { key: "stock_name", label: "Name", type: "string" },
          { key: "category", label: "Category", type: "string" },
          { key: "available_qty", label: "Available", type: "number" },
          { key: "min_level", label: "Min Level", type: "number" },
          { key: "location", label: "Location", type: "string" },
          { key: "health", label: "Health", type: "badge" },
        ];
        const data = await db
          .select({
            stock_code: stocks.stockCode,
            stock_name: stocks.stockName,
            category: stocks.category,
            available_qty: stocks.availableQuantity,
            min_level: stocks.minStockLevel,
            location: stocks.location,
            health_score: stocks.healthScore,
          })
          .from(stocks)
          .where(
            and(
              isNull(stocks.deletedAt),
              eq(stocks.status, "active"),
              q.category ? eq(stocks.category, q.category) : undefined
            )
          )
          .orderBy(stocks.stockName);
        rows = data.map((r) => ({
          stock_code: r.stock_code,
          stock_name: r.stock_name,
          category: r.category,
          available_qty: r.available_qty,
          min_level: r.min_level,
          location: r.location ?? "—",
          health: healthLabel(r.health_score),
        }));
        break;
      }

      case "distribution-history": {
        columns = [
          { key: "transaction_code", label: "Transaction", type: "string" },
          { key: "stock_name", label: "Stock", type: "string" },
          { key: "qty_requested", label: "Qty", type: "number" },
          { key: "recipient_name", label: "Recipient", type: "string" },
          { key: "location", label: "Location", type: "string" },
          { key: "status", label: "Status", type: "badge" },
          { key: "created_at", label: "Date", type: "date" },
        ];
        const conditions = [];
        if (q.status) conditions.push(sql`distributions.status = ${q.status}`);
        if (q.date_from) conditions.push(sql`distributions.created_at >= ${new Date(q.date_from)}`);
        if (q.date_to) conditions.push(sql`distributions.created_at <= ${new Date(q.date_to)}`);
        const data = await db
          .select({
            transaction_code: distributions.transactionCode,
            stock_name: sql<string>`s.stock_name`,
            qty_requested: distributions.qtyRequested,
            recipient_name: distributions.recipientName,
            location: distributions.location,
            status: distributions.status,
            created_at: distributions.createdAt,
          })
          .from(sql`distributions JOIN stocks s ON distributions.stock_id = s.id`)
          .where(conditions.length ? sql`${sql.join(conditions, sql` AND `)}` : undefined)
          .orderBy(desc(distributions.createdAt))
          .limit(500);
        rows = toRows(data as unknown as object[]);
        break;
      }

      case "pending-approvals": {
        columns = [
          { key: "transaction_code", label: "Transaction", type: "string" },
          { key: "stock_name", label: "Stock", type: "string" },
          { key: "qty_requested", label: "Qty", type: "number" },
          { key: "recipient_name", label: "Recipient", type: "string" },
          { key: "risk_level", label: "Risk", type: "badge" },
          { key: "status", label: "Status", type: "badge" },
          { key: "submitted_at", label: "Submitted", type: "date" },
        ];
        const conditions = [sql`distributions.status IN ('submitted','l1_pending','l2_pending')`];
        if (q.risk_level) conditions.push(sql`LOWER(distributions.ai_risk_score) = LOWER(${q.risk_level})`);
        const data = await db
          .select({
            transaction_code: distributions.transactionCode,
            stock_name: sql<string>`s.stock_name`,
            qty_requested: distributions.qtyRequested,
            recipient_name: distributions.recipientName,
            risk_level: distributions.aiRiskScore,
            status: distributions.status,
            submitted_at: distributions.submittedAt,
          })
          .from(sql`distributions JOIN stocks s ON distributions.stock_id = s.id`)
          .where(sql`${sql.join(conditions, sql` AND `)}`)
          .orderBy(desc(distributions.submittedAt))
          .limit(500);
        rows = toRows(data as unknown as object[]);
        break;
      }

      case "approval-history": {
        columns = [
          { key: "transaction_code", label: "Transaction", type: "string" },
          { key: "stock_name", label: "Stock", type: "string" },
          { key: "status", label: "Final Status", type: "badge" },
          { key: "ai_recommendation", label: "AI Rec.", type: "badge" },
          { key: "risk_level", label: "Risk", type: "badge" },
          { key: "updated_at", label: "Decided At", type: "date" },
        ];
        const conditions = [sql`distributions.status IN ('approved','rejected')`];
        if (q.date_from) conditions.push(sql`approvals.updated_at >= ${new Date(q.date_from)}`);
        if (q.date_to) conditions.push(sql`approvals.updated_at <= ${new Date(q.date_to)}`);
        const data = await db
          .select({
            transaction_code: distributions.transactionCode,
            stock_name: sql<string>`s.stock_name`,
            status: distributions.status,
            ai_recommendation: approvals.aiRecommendation,
            risk_level: approvals.aiRiskLevel,
            updated_at: approvals.updatedAt,
          })
          .from(
            sql`approvals JOIN distributions ON approvals.distribution_id = distributions.id JOIN stocks s ON distributions.stock_id = s.id`
          )
          .where(sql`${sql.join(conditions, sql` AND `)}`)
          .orderBy(desc(approvals.updatedAt))
          .limit(500);
        rows = toRows(data as unknown as object[]);
        break;
      }

      case "stock-ledger": {
        columns = [
          { key: "stock_code", label: "Stock Code", type: "string" },
          { key: "stock_name", label: "Stock Name", type: "string" },
          { key: "movement_type", label: "Type", type: "badge" },
          { key: "quantity", label: "Quantity", type: "number" },
          { key: "balance_after", label: "Balance After", type: "number" },
          { key: "performed_by", label: "By", type: "string" },
          { key: "remarks", label: "Remarks", type: "string" },
          { key: "performed_at", label: "Date", type: "date" },
        ];
        const conditions = [];
        if (q.date_from) conditions.push(sql`stock_ledger.performed_at >= ${new Date(q.date_from)}`);
        if (q.date_to) conditions.push(sql`stock_ledger.performed_at <= ${new Date(q.date_to)}`);
        const data = await db
          .select({
            stock_code: sql<string>`s.stock_code`,
            stock_name: sql<string>`s.stock_name`,
            movement_type: stockLedger.movementType,
            quantity: stockLedger.quantity,
            balance_after: stockLedger.runningBalance,
            performed_by: stockLedger.performedBy,
            remarks: stockLedger.remarks,
            performed_at: stockLedger.performedAt,
          })
          .from(sql`stock_ledger JOIN stocks s ON stock_ledger.stock_id = s.id`)
          .where(conditions.length ? sql`${sql.join(conditions, sql` AND `)}` : undefined)
          .orderBy(desc(stockLedger.performedAt))
          .limit(500);
        rows = toRows(data as unknown as object[]);
        break;
      }

      case "anomaly-history": {
        columns = [
          { key: "stock_code", label: "Stock", type: "string" },
          { key: "anomaly_type", label: "Type", type: "string" },
          { key: "severity", label: "Severity", type: "badge" },
          { key: "description", label: "Description", type: "string" },
          { key: "status", label: "Status", type: "badge" },
          { key: "detected_at", label: "Detected", type: "date" },
        ];
        const data = await db
          .select({
            stock_code: sql<string>`s.stock_code`,
            anomaly_type: anomalies.anomalyType,
            severity: anomalies.severity,
            description: anomalies.description,
            status: anomalies.status,
            detected_at: anomalies.detectedAt,
          })
          .from(sql`anomalies JOIN stocks s ON anomalies.stock_id = s.id`)
          .where(
            q.severity
              ? eq(anomalies.severity, q.severity as "critical" | "warning" | "info")
              : undefined
          )
          .orderBy(desc(anomalies.detectedAt))
          .limit(500);
        rows = toRows(data as unknown as object[]);
        break;
      }

      case "rejection-analysis": {
        columns = [
          { key: "transaction_code", label: "Transaction", type: "string" },
          { key: "stock_name", label: "Stock", type: "string" },
          { key: "qty_requested", label: "Qty", type: "number" },
          { key: "recipient_name", label: "Recipient", type: "string" },
          { key: "ai_recommendation", label: "AI Rec.", type: "badge" },
          { key: "risk_level", label: "Risk", type: "badge" },
          { key: "remarks", label: "Rejection Reason", type: "string" },
          { key: "updated_at", label: "Rejected At", type: "date" },
        ];
        const conditions = [sql`distributions.status = 'rejected'`];
        if (q.date_from) conditions.push(sql`approvals.updated_at >= ${new Date(q.date_from)}`);
        if (q.date_to) conditions.push(sql`approvals.updated_at <= ${new Date(q.date_to)}`);
        const data = await db
          .select({
            transaction_code: distributions.transactionCode,
            stock_name: sql<string>`s.stock_name`,
            qty_requested: distributions.qtyRequested,
            recipient_name: distributions.recipientName,
            ai_recommendation: approvals.aiRecommendation,
            risk_level: approvals.aiRiskLevel,
            remarks: approvals.remarks,
            updated_at: approvals.updatedAt,
          })
          .from(
            sql`approvals JOIN distributions ON approvals.distribution_id = distributions.id JOIN stocks s ON distributions.stock_id = s.id`
          )
          .where(sql`${sql.join(conditions, sql` AND `)}`)
          .orderBy(desc(approvals.updatedAt))
          .limit(500);
        rows = toRows(data as unknown as object[]);
        break;
      }

      case "user-activity": {
        columns = [
          { key: "event_type", label: "Event", type: "string" },
          { key: "description", label: "Description", type: "string" },
          { key: "actor", label: "User", type: "string" },
          { key: "entity_type", label: "Entity Type", type: "string" },
          { key: "ip_address", label: "IP", type: "string" },
          { key: "created_at", label: "Timestamp", type: "date" },
        ];
        const conditions = [];
        if (q.date_from) conditions.push(sql`created_at >= ${new Date(q.date_from)}`);
        if (q.date_to) conditions.push(sql`created_at <= ${new Date(q.date_to)}`);
        const data = await db
          .select({
            event_type: activity.eventType,
            description: activity.description,
            actor: activity.actor,
            entity_type: activity.entityType,
            ip_address: activity.ipAddress,
            created_at: activity.createdAt,
          })
          .from(activity)
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(desc(activity.createdAt))
          .limit(500);
        rows = toRows(data as unknown as object[]);
        break;
      }

      default:
        res.status(404).json({ error_code: "NOT_FOUND", message: "Report type not found" });
        return;
    }

    res.json({
      columns,
      rows,
      generated_at: new Date().toISOString(),
      total_rows: rows.length,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Export stub ──────────────────────────────────────────────────────────────

router.get("/:type/export/:format", (_req: Request, res: Response) => {
  res.status(501).json({
    error_code: "NOT_IMPLEMENTED",
    message: "Export requires additional setup. Use the data table instead.",
  });
});

export default router;
