import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db/index.js";
import { stockLedger, stocks } from "../db/schema/index.js";
import { eq, and, gte, lte, desc } from "drizzle-orm";

const router = Router();

// ─── GET /ledger ──────────────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stockIdFilter = req.query.stockId ? Number(req.query.stockId) : undefined;
    const movementType = req.query.movementType as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (stockIdFilter) {
      conditions.push(eq(stockLedger.stockId, stockIdFilter));
    }

    if (movementType) {
      conditions.push(
        eq(
          stockLedger.movementType,
          movementType as "in" | "out" | "opening" | "adjustment"
        )
      );
    }

    if (dateFrom) {
      conditions.push(gte(stockLedger.performedAt, new Date(dateFrom)));
    }

    if (dateTo) {
      conditions.push(lte(stockLedger.performedAt, new Date(dateTo)));
    }

    const rows = await db
      .select({
        id: stockLedger.id,
        stockId: stockLedger.stockId,
        stockCode: stocks.stockCode,
        stockName: stocks.stockName,
        movementType: stockLedger.movementType,
        quantity: stockLedger.quantity,
        runningBalance: stockLedger.runningBalance,
        distributionId: stockLedger.distributionId,
        performedBy: stockLedger.performedBy,
        performedAt: stockLedger.performedAt,
        source: stockLedger.source,
        remarks: stockLedger.remarks,
      })
      .from(stockLedger)
      .leftJoin(stocks, eq(stockLedger.stockId, stocks.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(stockLedger.performedAt))
      .limit(limit)
      .offset(offset);

    res.json({
      data: rows,
      pagination: { page, limit, total: rows.length },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
