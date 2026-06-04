import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db/index.js";
import {
  stocks,
  distributions,
  anomalies,
  activity,
  approvals,
} from "../db/schema/index.js";
import {
  sql,
  eq,
  and,
  isNull,
  desc,
} from "drizzle-orm";

const router = Router();

// ─── GET /dashboard/summary ───────────────────────────────────────────────────

router.get("/summary", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    // Total stocks
    const [stockStats] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        active: sql<number>`COUNT(*) FILTER (WHERE status = 'active')`,
        totalUnits: sql<number>`COALESCE(SUM(available_quantity) FILTER (WHERE status = 'active'), 0)`,
        healthy: sql<number>`COUNT(*) FILTER (WHERE health_score >= 70 AND status = 'active')`,
        warning: sql<number>`COUNT(*) FILTER (WHERE health_score >= 40 AND health_score < 70 AND status = 'active')`,
        critical: sql<number>`COUNT(*) FILTER (WHERE health_score < 40 AND status = 'active')`,
      })
      .from(stocks)
      .where(isNull(stocks.deletedAt));

    // Pending approvals
    const [approvalStats] = await db
      .select({
        pending: sql<number>`COUNT(*) FILTER (WHERE status = 'pending')`,
        l2Pending: sql<number>`COUNT(*) FILTER (WHERE l2_status IS NULL AND status = 'l1_approved' AND requires_l2 = true)`,
      })
      .from(approvals);

    // Active & critical anomalies
    const [anomalyStats] = await db
      .select({
        active: sql<number>`COUNT(*) FILTER (WHERE dismissed = false AND status = 'active')`,
        critical: sql<number>`COUNT(*) FILTER (WHERE dismissed = false AND severity = 'critical')`,
      })
      .from(anomalies);


    // Total distributions
    const [distTotal] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(distributions);

    // Per-user distribution stats
    const [myStats] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        pending: sql<number>`COUNT(*) FILTER (WHERE status IN ('submitted','l1_pending','l2_pending'))`,
        approved: sql<number>`COUNT(*) FILTER (WHERE status = 'approved')`,
        rejected: sql<number>`COUNT(*) FILTER (WHERE status = 'rejected')`,
      })
      .from(distributions)
      .where(eq(distributions.createdBy, userId));

    // Approval velocity: average hours from submitted_at to approved (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [velocityStats] = await db
      .select({
        avg_hours: sql<number>`
          COALESCE(
            AVG(EXTRACT(EPOCH FROM (updated_at - submitted_at)) / 3600.0)
            FILTER (WHERE status = 'approved' AND submitted_at IS NOT NULL AND updated_at >= ${thirtyDaysAgo}),
            0
          )
        `,
      })
      .from(distributions);

    // Distribution by status
    const distByStatus = await db
      .select({
        status: distributions.status,
        count: sql<number>`COUNT(*)`,
      })
      .from(distributions)
      .groupBy(distributions.status);

    // Top distributed items (by quantity distributed)
    const topItems = await db
      .select({
        stock_name: sql<string>`s.stock_name`,
        total_qty: sql<number>`SUM(d.qty_requested)`,
      })
      .from(sql`distributions d JOIN stocks s ON d.stock_id = s.id`)
      .groupBy(sql`s.stock_name`)
      .orderBy(sql`SUM(d.qty_requested) DESC`)
      .limit(10);

    // Transaction trend: distributions per day. Take the most recent 30 days
    // that actually have data (robust to older seed data — avoids an empty chart
    // when nothing was created in the trailing calendar window).
    const trendDesc = await db
      .select({
        date: sql<string>`DATE(created_at)::text`,
        count: sql<number>`COUNT(*)`,
      })
      .from(distributions)
      .groupBy(sql`DATE(created_at)`)
      .orderBy(sql`DATE(created_at) DESC`)
      .limit(30);
    const trend = [...trendDesc].reverse(); // back to chronological order

    res.json({
      total_stocks: Number(stockStats.total),
      active_stocks: Number(stockStats.active),
      total_available_units: Number(stockStats.totalUnits),
      total_distributions: Number(distTotal.total),
      pending_approvals: Number(approvalStats.pending) + Number(approvalStats.l2Pending),
      active_anomalies: Number(anomalyStats.active ?? 0),
      critical_anomalies: Number(anomalyStats.critical ?? 0),
      my_distributions: Number(myStats.total),
      my_pending: Number(myStats.pending),
      my_approved: Number(myStats.approved),
      my_rejected: Number(myStats.rejected),
      approval_velocity_hours: Number(Number(velocityStats.avg_hours).toFixed(1)),
      stock_health_summary: {
        healthy: Number(stockStats.healthy),
        warning: Number(stockStats.warning),
        critical: Number(stockStats.critical),
      },
      distribution_by_status: distByStatus.map((r) => ({
        status: r.status,
        count: Number(r.count),
      })),
      top_distributed_items: topItems.map((r) => ({
        stock_name: r.stock_name,
        total_qty: Number(r.total_qty),
      })),
      transaction_trend: trend.map((r) => ({
        date: r.date,
        count: Number(r.count),
      })),
    });
  } catch (err) {
    next(err);
  }
});



// ─── GET /dashboard/activity ──────────────────────────────────────────────────

router.get("/activity", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const rows = await db
      .select()
      .from(activity)
      .orderBy(desc(activity.createdAt))
      .limit(limit);

    // Map to match frontend Activity type shape
    const mapped = rows.map((r) => ({
      id: String(r.id),
      event_type: r.eventType,
      description: r.description,
      actor_name: r.actor,
      actor_role: "",
      entity_type: r.entityType ?? "",
      entity_id: String(r.entityId ?? ""),
      entity_name: "",
      created_at: (r.createdAt ?? r.timestamp).toISOString(),
    }));

    res.json(mapped);
  } catch (err) {
    next(err);
  }
});


// ─── GET /dashboard/health-scores ────────────────────────────────────────────

router.get("/health-scores", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await db
      .select({
        id: stocks.id,
        stockCode: stocks.stockCode,
        stockName: stocks.stockName,
        category: stocks.category,
        availableQuantity: stocks.availableQuantity,
        minStockLevel: stocks.minStockLevel,
        reservedQuantity: stocks.reservedQuantity,
        healthScore: stocks.healthScore,
        status: stocks.status,
        location: stocks.location,
      })
      .from(stocks)
      .where(and(eq(stocks.status, "active"), isNull(stocks.deletedAt)))
      .orderBy(stocks.healthScore);

    const mapped = rows.map((r) => ({
      stock_id: String(r.id),
      stock_code: r.stockCode,
      stock_name: r.stockName,
      health_score: r.healthScore,
      health_status: r.healthScore >= 70 ? "healthy" : r.healthScore >= 40 ? "warning" : "critical",
      available_qty: r.availableQuantity,
      min_level: r.minStockLevel,
    }));

    res.json(mapped);
  } catch (err) {
    next(err);
  }
});

export default router;
