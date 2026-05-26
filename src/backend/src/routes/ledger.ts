import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db/index.js";
import { stockLedger, stocks } from "../db/schema/index.js";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

const router = Router();

// ─── GET /ledger ──────────────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Accept both snake_case and camelCase param names
    const rawStockId = req.query.stock_id ?? req.query.stockId;
    const stockIdFilter = rawStockId ? Number(rawStockId) : undefined;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const page_size = Math.min(100, Math.max(1, Number(req.query.page_size ?? req.query.limit ?? 20)));
    const offset = (page - 1) * page_size;

    const conditions = [];

    if (stockIdFilter) {
      conditions.push(eq(stockLedger.stockId, stockIdFilter));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(stockLedger)
      .where(whereClause);

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
        remarks: stockLedger.remarks,
      })
      .from(stockLedger)
      .leftJoin(stocks, eq(stockLedger.stockId, stocks.id))
      .where(whereClause)
      .orderBy(desc(stockLedger.performedAt))
      .limit(page_size)
      .offset(offset);

    const mvtMap: Record<string, "in" | "out" | "adjustment"> = {
      in: "in",
      opening: "in",
      out: "out",
      adjustment: "adjustment",
    };

    const totalNum = Number(total);
    res.json({
      items: rows.map((r) => ({
        id: String(r.id),
        stock_id: String(r.stockId),
        stock_code: r.stockCode ?? "",
        stock_name: r.stockName ?? "",
        transaction_type: mvtMap[r.movementType] ?? "adjustment",
        qty_change: r.quantity,
        qty_before: r.runningBalance - r.quantity,
        qty_after: r.runningBalance,
        distribution_id: r.distributionId ? String(r.distributionId) : null,
        transaction_code: null,
        actor_name: r.performedBy ?? "",
        remarks: r.remarks ?? "",
        created_at: r.performedAt.toISOString(),
      })),
      total: totalNum,
      page,
      page_size,
      total_pages: Math.ceil(totalNum / page_size),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
