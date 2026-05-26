import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { stocks, anomalies } from "../db/schema/index.js";
import { sql, eq, and, isNull } from "drizzle-orm";
import { pool } from "../db/index.js";
import { naturalLanguageQuery } from "../lib/azure-openai.js";
import logger from "../lib/logger.js";

const router = Router();

// In-memory cache for insights
const insightsCache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function cacheGet<T>(key: string): T | undefined {
  const entry = insightsCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiry) {
    insightsCache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

function cacheSet(key: string, data: unknown): void {
  insightsCache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

const SCHEMA_CONTEXT = `
Tables:
- stocks(id, stock_code, stock_name, category, sub_category, unit_of_measure, available_quantity, reserved_quantity, min_stock_level, location, status, health_score)
- distributions(id, transaction_code, stock_id, qty_requested, distribution_date, recipient_type, recipient_id, recipient_name, purpose, status, created_at)
- approvals(id, distribution_id, status, ai_risk_level, ai_risk_score, requires_l2, created_at)
- anomalies(id, stock_id, anomaly_type, severity, description, status, detected_at)
- stock_ledger(id, stock_id, movement_type, quantity, running_balance, performed_at, source)
`;

// ─── GET /insights/inventory-health ──────────────────────────────────────────

router.get("/inventory-health", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cacheKey = "inventory_health";
    const cached = cacheGet<Record<string, unknown>>(cacheKey);
    if (cached) {
      res.json({ ...cached, cached: true });
      return;
    }

    // Gather DB stats
    const [stockStats] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        active: sql<number>`COUNT(*) FILTER (WHERE status = 'active')`,
        totalUnits: sql<number>`COALESCE(SUM(available_quantity) FILTER (WHERE status = 'active'), 0)`,
        avgHealth: sql<number>`COALESCE(AVG(health_score) FILTER (WHERE status = 'active'), 0)`,
        healthy: sql<number>`COUNT(*) FILTER (WHERE health_score >= 70 AND status = 'active')`,
        warning: sql<number>`COUNT(*) FILTER (WHERE health_score >= 40 AND health_score < 70 AND status = 'active')`,
        critical: sql<number>`COUNT(*) FILTER (WHERE health_score < 40 AND status = 'active')`,
      })
      .from(stocks)
      .where(isNull(stocks.deletedAt));

    const [anomalyStats] = await db
      .select({
        active: sql<number>`COUNT(*) FILTER (WHERE status = 'active')`,
        critical: sql<number>`COUNT(*) FILTER (WHERE severity = 'critical' AND status = 'active')`,
      })
      .from(anomalies);

    // Critical items
    const criticalItems = await db
      .select({
        stockCode: stocks.stockCode,
        stockName: stocks.stockName,
        healthScore: stocks.healthScore,
        availableQuantity: stocks.availableQuantity,
        minStockLevel: stocks.minStockLevel,
      })
      .from(stocks)
      .where(and(eq(stocks.status, "active"), isNull(stocks.deletedAt)))
      .orderBy(stocks.healthScore)
      .limit(5);

    // Build narrative (AI-enhanced if available, stat-based fallback)
    let narrative: string | null = null;

    try {
      const healthPct = Math.round(
        (Number(stockStats.healthy) / Math.max(1, Number(stockStats.active))) * 100
      );
      const avgHealth = Math.round(Number(stockStats.avgHealth));

      narrative = `Inventory Health Summary: ${Number(stockStats.active)} active stock items tracked. ` +
        `Average health score: ${avgHealth}/100. ` +
        `${Number(stockStats.healthy)} items (${healthPct}%) are healthy, ` +
        `${Number(stockStats.warning)} are in warning state, and ` +
        `${Number(stockStats.critical)} are critical. ` +
        `There are ${Number(anomalyStats.active)} active anomalies ` +
        `(${Number(anomalyStats.critical)} critical). ` +
        (Number(stockStats.critical) > 0
          ? `Immediate attention required for ${Number(stockStats.critical)} critical stock item(s).`
          : `Overall inventory health is satisfactory.`);
    } catch {
      narrative = null;
    }

    // Fallback narrative
    if (!narrative) {
      const healthPct = Math.round(
        (Number(stockStats.healthy) / Math.max(1, Number(stockStats.active))) * 100
      );
      narrative =
        `Inventory contains ${Number(stockStats.active)} active items. ` +
        `${healthPct}% are in healthy state. ` +
        `${Number(anomalyStats.active)} anomalies require attention.`;
    }

    const avgHealth = Math.round(Number(stockStats.avgHealth));
    const criticalCount = Number(stockStats.critical);
    const warningCount = Number(stockStats.warning);
    const healthyCount = Number(stockStats.healthy);

    const observations: string[] = [
      `${healthyCount} stocks healthy, ${warningCount} warning, ${criticalCount} critical`,
      `${Number(anomalyStats.active)} active anomalies (${Number(anomalyStats.critical)} critical)`,
      ...criticalItems.map((s) => `${s.stockName} (${s.stockCode}) health: ${Math.round(s.healthScore)}/100 — ${s.availableQuantity} units vs min ${s.minStockLevel}`),
    ];

    const recommended_actions: string[] = [
      ...(criticalCount > 0 ? [`Replenish ${criticalCount} critical stock item(s) immediately`] : []),
      ...(warningCount > 0 ? [`Review ${warningCount} stock item(s) in warning state`] : []),
      ...(Number(anomalyStats.critical) > 0 ? [`Resolve ${Number(anomalyStats.critical)} critical anomaly/anomalies`] : []),
      ...(criticalCount === 0 && warningCount === 0 ? ["Inventory levels are within acceptable thresholds"] : []),
    ];

    const result = {
      summary: narrative,
      observations,
      recommended_actions,
      health_score: avgHealth,
      last_refreshed: new Date().toISOString(),
    };

    cacheSet(cacheKey, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── POST /insights/query ─────────────────────────────────────────────────────

router.post("/query", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({ query: z.string().min(1).max(500) });
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error_code: "VALIDATION_ERROR",
        message: "query field is required",
      });
      return;
    }

    const { query } = parsed.data;

    const nlResult = await naturalLanguageQuery(query, SCHEMA_CONTEXT);

    if (!nlResult) {
      res.json({
        query,
        answer: "Natural language query is unavailable. Please use the search filters provided.",
        data: [],
        columns: [],
        confidence: 0,
      });
      return;
    }

    // Execute safe SQL
    try {
      logger.info({ sql: nlResult.sql }, "Executing NL-generated SQL");
      const result = await pool.query(nlResult.sql);

      const columns = result.rows.length > 0 ? Object.keys(result.rows[0]) : [];
      res.json({
        query,
        answer: nlResult.explanation ?? "Query executed successfully.",
        data: result.rows,
        columns,
        confidence: 0.8,
      });
    } catch (queryErr) {
      logger.error({ queryErr, sql: nlResult.sql }, "NL SQL execution failed");
      res.status(400).json({
        query,
        answer: `Query could not be executed: ${nlResult.explanation ?? "unknown error"}`,
        data: [],
        columns: [],
        confidence: 0,
      });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
