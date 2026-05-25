import { db } from "../db/index.js";
import {
  stocks,
  distributions,
  stockLedger,
  anomalies,
  notifications,
  users,
} from "../db/schema/index.js";
import {
  eq,
  lt,
  and,
  gte,
  sql,
  isNull,
  desc,
  ne,
} from "drizzle-orm";
import { explainAnomaly } from "./azure-openai.js";
import logger from "./logger.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DetectedAnomaly {
  stockId: number | null;
  anomalyType: string;
  severity: "info" | "warning" | "critical";
  description: string;
}

// ─── Main detection runner ────────────────────────────────────────────────────

export async function runAnomalyDetection(): Promise<void> {
  logger.info("Starting anomaly detection run");

  try {
    const detected: DetectedAnomaly[] = [];

    const [lowStockAnomalies, velocityAnomalies, freqAnomalies, volAnomalies] =
      await Promise.all([
        checkLowStock(),
        checkVelocity(),
        checkFrequency(),
        checkVolume(),
      ]);

    detected.push(
      ...lowStockAnomalies,
      ...velocityAnomalies,
      ...freqAnomalies,
      ...volAnomalies
    );

    logger.info({ count: detected.length }, "Anomalies detected");

    for (const anomaly of detected) {
      await persistAnomaly(anomaly);
    }

    logger.info("Anomaly detection run complete");
  } catch (err) {
    logger.error({ err }, "Anomaly detection run failed");
  }
}

// ─── Check: Low stock ─────────────────────────────────────────────────────────

async function checkLowStock(): Promise<DetectedAnomaly[]> {
  const results: DetectedAnomaly[] = [];

  const activeStocks = await db
    .select()
    .from(stocks)
    .where(and(eq(stocks.status, "active"), isNull(stocks.deletedAt)));

  for (const stock of activeStocks) {
    if (stock.availableQuantity === 0) {
      results.push({
        stockId: stock.id,
        anomalyType: "zero_stock",
        severity: "critical",
        description: `${stock.stockName} (${stock.stockCode}) has zero available stock.`,
      });
    } else if (
      stock.minStockLevel > 0 &&
      stock.availableQuantity < stock.minStockLevel
    ) {
      results.push({
        stockId: stock.id,
        anomalyType: "low_stock",
        severity:
          stock.availableQuantity < stock.minStockLevel * 0.5
            ? "critical"
            : "warning",
        description: `${stock.stockName} (${stock.stockCode}) is below minimum stock level. Available: ${stock.availableQuantity}, Min: ${stock.minStockLevel}`,
      });
    }
  }

  return results;
}

// ─── Check: Velocity (>50% depletion in 7 days) ───────────────────────────────

async function checkVelocity(): Promise<DetectedAnomaly[]> {
  const results: DetectedAnomaly[] = [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const activeStocks = await db
    .select()
    .from(stocks)
    .where(and(eq(stocks.status, "active"), isNull(stocks.deletedAt)));

  for (const stock of activeStocks) {
    if (stock.openingQuantity <= 0) continue;

    // Total outflows in last 7 days
    const outflowRows = await db
      .select({ total: sql<number>`COALESCE(SUM(quantity), 0)` })
      .from(stockLedger)
      .where(
        and(
          eq(stockLedger.stockId, stock.id),
          eq(stockLedger.movementType, "out"),
          gte(stockLedger.performedAt, sevenDaysAgo)
        )
      );

    const outflow = Number(outflowRows[0]?.total ?? 0);
    const depletionRate = outflow / stock.openingQuantity;

    if (depletionRate > 0.5) {
      results.push({
        stockId: stock.id,
        anomalyType: "velocity_anomaly",
        severity: depletionRate > 0.8 ? "critical" : "warning",
        description: `${stock.stockName} has been depleted ${(depletionRate * 100).toFixed(1)}% in the last 7 days. Outflow: ${outflow} units.`,
      });
    }
  }

  return results;
}

// ─── Check: Frequency (same recipient > 3 times in 30 days) ──────────────────

async function checkFrequency(): Promise<DetectedAnomaly[]> {
  const results: DetectedAnomaly[] = [];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const freqRows = await db
    .select({
      stockId: distributions.stockId,
      recipientId: distributions.recipientId,
      recipientName: distributions.recipientName,
      count: sql<number>`COUNT(*)`,
    })
    .from(distributions)
    .where(
      and(
        gte(distributions.createdAt, thirtyDaysAgo),
        ne(distributions.status, "draft"),
        ne(distributions.status, "rejected")
      )
    )
    .groupBy(
      distributions.stockId,
      distributions.recipientId,
      distributions.recipientName
    )
    .having(sql`COUNT(*) > 3`);

  for (const row of freqRows) {
    results.push({
      stockId: row.stockId,
      anomalyType: "frequency_anomaly",
      severity: "warning",
      description: `Recipient "${row.recipientName}" has made ${row.count} requests for the same stock item in the last 30 days.`,
    });
  }

  return results;
}

// ─── Check: Volume (single tx > 2x average) ──────────────────────────────────

async function checkVolume(): Promise<DetectedAnomaly[]> {
  const results: DetectedAnomaly[] = [];

  const stockAvgRows = await db
    .select({
      stockId: distributions.stockId,
      avgQty: sql<number>`AVG(qty_requested)`,
      maxQty: sql<number>`MAX(qty_requested)`,
    })
    .from(distributions)
    .where(
      and(
        ne(distributions.status, "draft"),
        ne(distributions.status, "rejected")
      )
    )
    .groupBy(distributions.stockId)
    .having(sql`COUNT(*) >= 3`);

  for (const row of stockAvgRows) {
    const avg = Number(row.avgQty ?? 0);
    const max = Number(row.maxQty ?? 0);
    if (avg > 0 && max > avg * 2) {
      results.push({
        stockId: row.stockId,
        anomalyType: "volume_anomaly",
        severity: max > avg * 3 ? "critical" : "warning",
        description: `A distribution request for this item has quantity ${max.toFixed(1)} which is ${(max / avg).toFixed(1)}x the average request quantity (${avg.toFixed(1)}).`,
      });
    }
  }

  return results;
}

// ─── Persist anomaly ─────────────────────────────────────────────────────────

async function persistAnomaly(detected: DetectedAnomaly): Promise<void> {
  try {
    // Check if same anomaly type already active for this stock
    const existing = await db
      .select()
      .from(anomalies)
      .where(
        and(
          detected.stockId
            ? eq(anomalies.stockId, detected.stockId)
            : isNull(anomalies.stockId),
          eq(anomalies.anomalyType, detected.anomalyType),
          eq(anomalies.status, "active")
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Already tracked, skip
      return;
    }

    // Get stock history for AI explanation
    let stockHistory: Array<{
      movementType: string;
      quantity: number;
      performedAt: Date;
    }> = [];

    if (detected.stockId) {
      stockHistory = await db
        .select({
          movementType: stockLedger.movementType,
          quantity: stockLedger.quantity,
          performedAt: stockLedger.performedAt,
        })
        .from(stockLedger)
        .where(eq(stockLedger.stockId, detected.stockId))
        .orderBy(desc(stockLedger.performedAt))
        .limit(20);
    }

    const explanation = await explainAnomaly(detected, stockHistory);

    const [inserted] = await db
      .insert(anomalies)
      .values({
        stockId: detected.stockId,
        anomalyType: detected.anomalyType,
        severity: detected.severity,
        description: detected.description,
        explanation: explanation.explanation,
        recommendedAction: explanation.recommendedAction,
        detectedAt: new Date(),
      })
      .returning();

    // Notify admins and managers
    await notifyManagers(inserted.id, detected);

    logger.info(
      { anomalyId: inserted.id, type: detected.anomalyType },
      "Anomaly persisted"
    );
  } catch (err) {
    logger.error({ err, detected }, "Failed to persist anomaly");
  }
}

async function notifyManagers(
  anomalyId: number,
  anomaly: DetectedAnomaly
): Promise<void> {
  try {
    const managers = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.isActive, true),
          sql`role IN ('admin', 'manager', 'management_authority')`
        )
      );

    if (managers.length === 0) return;

    const notifValues = managers.map((m) => ({
      userId: m.id,
      type: "anomaly_detected",
      title: `Anomaly Detected: ${anomaly.anomalyType.replace(/_/g, " ")}`,
      message: anomaly.description,
      relatedEntityType: "anomaly",
      relatedEntityId: anomalyId,
    }));

    await db.insert(notifications).values(notifValues);
  } catch (err) {
    logger.error({ err }, "Failed to create anomaly notifications");
  }
}
