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
            transaction_code: sql<string>`distributions.transaction_code`,
            stock_name: sql<string>`s.stock_name`,
            qty_requested: sql<number>`distributions.qty_requested`,
            recipient_name: sql<string>`distributions.recipient_name`,
            location: sql<string>`distributions.location`,
            status: sql<string>`distributions.status`,
            created_at: sql<Date>`distributions.created_at`,
          })
          .from(sql`distributions JOIN stocks s ON distributions.stock_id = s.id`)
          .where(conditions.length ? sql`${sql.join(conditions, sql` AND `)}` : undefined)
          .orderBy(sql`distributions.created_at DESC`)
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
            transaction_code: sql<string>`distributions.transaction_code`,
            stock_name: sql<string>`s.stock_name`,
            qty_requested: sql<number>`distributions.qty_requested`,
            recipient_name: sql<string>`distributions.recipient_name`,
            risk_level: sql<string>`distributions.ai_risk_score`,
            status: sql<string>`distributions.status`,
            submitted_at: sql<Date>`distributions.submitted_at`,
          })
          .from(sql`distributions JOIN stocks s ON distributions.stock_id = s.id`)
          .where(sql`${sql.join(conditions, sql` AND `)}`)
          .orderBy(sql`distributions.submitted_at DESC`)
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
            transaction_code: sql<string>`distributions.transaction_code`,
            stock_name: sql<string>`s.stock_name`,
            status: sql<string>`distributions.status`,
            ai_recommendation: sql<string>`approvals.ai_recommendation`,
            risk_level: sql<string>`approvals.ai_risk_level`,
            updated_at: sql<Date>`approvals.updated_at`,
          })
          .from(
            sql`approvals JOIN distributions ON approvals.distribution_id = distributions.id JOIN stocks s ON distributions.stock_id = s.id`
          )
          .where(sql`${sql.join(conditions, sql` AND `)}`)
          .orderBy(sql`approvals.updated_at DESC`)
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
            movement_type: sql<string>`stock_ledger.movement_type`,
            quantity: sql<number>`stock_ledger.quantity`,
            balance_after: sql<number>`stock_ledger.running_balance`,
            performed_by: sql<string>`stock_ledger.performed_by`,
            remarks: sql<string>`stock_ledger.remarks`,
            performed_at: sql<Date>`stock_ledger.performed_at`,
          })
          .from(sql`stock_ledger JOIN stocks s ON stock_ledger.stock_id = s.id`)
          .where(conditions.length ? sql`${sql.join(conditions, sql` AND `)}` : undefined)
          .orderBy(sql`stock_ledger.performed_at DESC`)
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
            anomaly_type: sql<string>`anomalies.anomaly_type`,
            severity: sql<string>`anomalies.severity`,
            description: sql<string>`anomalies.description`,
            status: sql<string>`anomalies.status`,
            detected_at: sql<Date>`anomalies.detected_at`,
          })
          .from(sql`anomalies JOIN stocks s ON anomalies.stock_id = s.id`)
          .where(q.severity ? sql`anomalies.severity = ${q.severity}` : undefined)
          .orderBy(sql`anomalies.detected_at DESC`)
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
            transaction_code: sql<string>`distributions.transaction_code`,
            stock_name: sql<string>`s.stock_name`,
            qty_requested: sql<number>`distributions.qty_requested`,
            recipient_name: sql<string>`distributions.recipient_name`,
            ai_recommendation: sql<string>`approvals.ai_recommendation`,
            risk_level: sql<string>`approvals.ai_risk_level`,
            remarks: sql<string>`approvals.remarks`,
            updated_at: sql<Date>`approvals.updated_at`,
          })
          .from(
            sql`approvals JOIN distributions ON approvals.distribution_id = distributions.id JOIN stocks s ON distributions.stock_id = s.id`
          )
          .where(sql`${sql.join(conditions, sql` AND `)}`)
          .orderBy(sql`approvals.updated_at DESC`)
          .limit(500);
        rows = toRows(data as unknown as object[]);
        break;
      }

      case "user-activity": {
        // Per-user aggregated SUMMARY (distinct from the raw Audit Log, which is
        // a chronological event trail). One row per user with activity totals.
        columns = [
          { key: "actor", label: "User", type: "string" },
          { key: "total_events", label: "Total Events", type: "number" },
          { key: "distributions", label: "Distributions", type: "number" },
          { key: "approvals", label: "Approvals", type: "number" },
          { key: "rejections", label: "Rejections", type: "number" },
          { key: "last_active", label: "Last Active", type: "date" },
        ];
        const conditions = [];
        if (q.date_from) conditions.push(sql`${activity.createdAt} >= ${new Date(q.date_from)}`);
        if (q.date_to) conditions.push(sql`${activity.createdAt} <= ${new Date(q.date_to)}`);
        const data = await db
          .select({
            actor: activity.actor,
            total_events: sql<number>`COUNT(*)`,
            distributions: sql<number>`COUNT(*) FILTER (WHERE ${activity.eventType} LIKE 'distribution%')`,
            approvals: sql<number>`COUNT(*) FILTER (WHERE ${activity.eventType} LIKE '%approved')`,
            rejections: sql<number>`COUNT(*) FILTER (WHERE ${activity.eventType} LIKE '%rejected')`,
            last_active: sql<string>`MAX(${activity.createdAt})`,
          })
          .from(activity)
          .where(conditions.length ? and(...conditions) : undefined)
          .groupBy(activity.actor)
          .orderBy(desc(sql`MAX(${activity.createdAt})`))
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
