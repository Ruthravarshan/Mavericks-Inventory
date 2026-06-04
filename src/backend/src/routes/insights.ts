import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { stocks, anomalies } from "../db/schema/index.js";
import { sql, eq, and, isNull } from "drizzle-orm";
import { pool } from "../db/index.js";
import { naturalLanguageQuery, generateHealthNarrative } from "../lib/azure-openai.js";
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
PostgreSQL tables (use EXACT column names shown — do NOT invent column names):
- stocks(id, stock_code, stock_name, category, sub_category, unit_of_measure, opening_quantity, available_quantity, reserved_quantity, min_stock_level, max_stock_level, location, description, status, health_score, created_at, updated_at, deleted_at)
  * category values: 'Laptop','Desktop','Monitor','Mobile Phone','Peripherals','Networking','Server','Storage','Software License','Access Card','ID Card','Power Equipment','Cables','Other IT Equipment'
  * status values: 'active','draft','inactive'
  * Always filter: WHERE deleted_at IS NULL AND status = 'active' unless the user asks otherwise
- distributions(id, transaction_code, stock_id, qty_requested, distribution_date, recipient_type, recipient_id, recipient_name, location, purpose, status, ai_risk_score, ai_recommendation, ai_reasoning, ai_confidence, submitted_at, created_at, updated_at, created_by)
  * status values: 'draft','submitted','l1_pending','l2_pending','approved','rejected'
  * Join to stocks on distributions.stock_id = stocks.id
- approvals(id, distribution_id, status, remarks, approved_by, approved_at, ai_recommendation, ai_risk_score, ai_risk_level, ai_reasoning, ai_confidence, requires_l2, l2_status, l2_approved_by, l2_approved_at, l2_remarks, created_at, updated_at)
  * status values: 'pending','approved','rejected'
  * l2_status values: 'pending','approved','rejected',null
  * Join to distributions on approvals.distribution_id = distributions.id
- anomalies(id, stock_id, anomaly_type, severity, description, explanation, recommended_action, status, detected_at, acknowledged_by, acknowledged_at, resolved_by, resolved_at, resolution_notes, created_at)
  * severity values: 'critical','warning','info'
  * status values: 'active','acknowledged','resolved','dismissed'
  * Join to stocks on anomalies.stock_id = stocks.id
- stock_ledger(id, stock_id, movement_type, quantity, running_balance, distribution_id, performed_by, performed_at, source, remarks)
  * movement_type values: 'in','out','adjustment'
  * Join to stocks on stock_ledger.stock_id = stocks.id
- users(id, employee_id, full_name, email, role, department, location, is_active, designation, created_at, last_login_at)
  * role values: 'admin','manager','management_authority','user','executive','auditor'
`;

// ─── GET /insights/inventory-health ──────────────────────────────────────────

router.get("/inventory-health", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cacheKey = "inventory_health";
    const cached = cacheGet<Record<string, unknown>>(cacheKey);
    if (cached) {
      res.json(cached);
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

    const avgHealth = Math.round(Number(stockStats.avgHealth));
    const criticalCount = Number(stockStats.critical);
    const warningCount = Number(stockStats.warning);
    const healthyCount = Number(stockStats.healthy);

    // Try AI-generated narrative first
    const aiNarrative = await generateHealthNarrative({
      active: Number(stockStats.active),
      healthy: healthyCount,
      warning: warningCount,
      critical: criticalCount,
      avgHealth,
      totalUnits: Math.round(Number(stockStats.totalUnits)),
      activeAnomalies: Number(anomalyStats.active),
      criticalAnomalies: Number(anomalyStats.critical),
      criticalItems: criticalItems.map((s) => ({
        name: s.stockName,
        code: s.stockCode,
        health: Math.round(s.healthScore),
        available: s.availableQuantity,
        min: s.minStockLevel,
      })),
    });

    // Build fallback observations and actions
    const fallbackObservations: string[] = [
      `${healthyCount} stocks healthy, ${warningCount} warning, ${criticalCount} critical`,
      `${Number(anomalyStats.active)} active anomalies (${Number(anomalyStats.critical)} critical)`,
      ...criticalItems.map((s) => `${s.stockName} (${s.stockCode}) health: ${Math.round(s.healthScore)}/100 — ${s.availableQuantity} units vs min ${s.minStockLevel}`),
    ];

    const fallbackActions: string[] = [
      ...(criticalCount > 0 ? [`Replenish ${criticalCount} critical stock item(s) immediately`] : []),
      ...(warningCount > 0 ? [`Review ${warningCount} stock item(s) in warning state`] : []),
      ...(Number(anomalyStats.critical) > 0 ? [`Resolve ${Number(anomalyStats.critical)} critical anomaly/anomalies`] : []),
      ...(criticalCount === 0 && warningCount === 0 ? ["Inventory levels are within acceptable thresholds"] : []),
    ];

    const fallbackSummary =
      `Inventory Health Summary: ${Number(stockStats.active)} active stock items. ` +
      `Average health score: ${avgHealth}/100. ` +
      `${healthyCount} healthy (${Math.round((healthyCount / Math.max(1, Number(stockStats.active))) * 100)}%), ` +
      `${warningCount} warning, ${criticalCount} critical. ` +
      `${Number(anomalyStats.active)} active anomalies.`;

    const result = {
      summary: aiNarrative?.summary ?? fallbackSummary,
      observations: aiNarrative?.observations?.length ? aiNarrative.observations : fallbackObservations,
      recommended_actions: aiNarrative?.recommended_actions?.length ? aiNarrative.recommended_actions : fallbackActions,
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
