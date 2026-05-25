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
  gte,
  isNull,
  desc,
} from "drizzle-orm";

const router = Router();

// ─── GET /dashboard/summary ───────────────────────────────────────────────────

router.get("/summary", async (req: Request, res: Response, next: NextFunction) => {
  try {
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
        l1Pending: sql<number>`COUNT(*) FILTER (WHERE status = 'pending')`,
        l2Pending: sql<number>`COUNT(*) FILTER (WHERE l2_status IS NULL AND status = 'l1_approved' AND requires_l2 = true)`,
      })
      .from(approvals);

    // Active anomalies
    const [anomalyStats] = await db
      .select({ active: sql<number>`COUNT(*)` })
      .from(anomalies)
      .where(and(eq(anomalies.status, "active"), eq(anomalies.dismissed, false)));

    // Distributions this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [distStats] = await db
      .select({ thisMonth: sql<number>`COUNT(*)` })
      .from(distributions)
      .where(gte(distributions.createdAt, monthStart));

    // Automation rate: approved without manual flag (low-risk approved)
    const [autoStats] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        automated: sql<number>`COUNT(*) FILTER (WHERE ai_risk_level = 'Low' AND status = 'approved')`,
      })
      .from(approvals);

    const automationRate =
      Number(autoStats.total) > 0
        ? Math.round((Number(autoStats.automated) / Number(autoStats.total)) * 100)
        : 0;

    res.json({
      total_stocks: Number(stockStats.total),
      active_stocks: Number(stockStats.active),
      total_available_units: Number(stockStats.totalUnits),
      pending_approvals: Number(approvalStats.pending) + Number(approvalStats.l2Pending),
      active_anomalies: Number(anomalyStats.active),
      healthy_stocks: Number(stockStats.healthy),
      warning_stocks: Number(stockStats.warning),
      critical_stocks: Number(stockStats.critical),
      distributions_this_month: Number(distStats.thisMonth),
      automation_rate: automationRate,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /dashboard/activity ──────────────────────────────────────────────────

router.get("/activity", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await db
      .select()
      .from(activity)
      .orderBy(desc(activity.timestamp))
      .limit(20);

    res.json({ data: rows });
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

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

export default router;
