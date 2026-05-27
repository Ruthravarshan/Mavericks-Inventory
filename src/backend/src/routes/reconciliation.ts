import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db/index.js";
import { stocks, reconciliationCounts } from "../db/schema/index.js";
import { eq, and, isNull, ne, desc } from "drizzle-orm";
import { requireRole } from "../middleware/rbac.js";

const router = Router();

// ─── GET /reconciliation ──────────────────────────────────────────────────────
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stockRows = await db
      .select()
      .from(stocks)
      .where(and(isNull(stocks.deletedAt), ne(stocks.status, "draft" as const)));

    // Get the latest physical count for each stock
    const latestCounts = await db
      .select()
      .from(reconciliationCounts)
      .orderBy(desc(reconciliationCounts.countedAt));

    // Build map: stockId → latest count
    const countMap = new Map<number, typeof latestCounts[0]>();
    for (const c of latestCounts) {
      if (!countMap.has(c.stockId)) {
        countMap.set(c.stockId, c);
      }
    }

    const items = stockRows.map((s) => {
      const count = countMap.get(s.id);
      const systemQty = s.availableQuantity;
      const physicalQty = count ? count.physicalQty : null;
      const variance = physicalQty !== null ? physicalQty - systemQty : null;

      let status: "matched" | "variance" | "pending" | "draft_adjustment" = "pending";
      if (physicalQty !== null && variance !== null) {
        if (variance === 0) status = "matched";
        else if (Math.abs(variance) === 1) status = "draft_adjustment";
        else status = "variance";
      }

      return {
        id: String(s.id),
        stock_code: s.stockCode,
        stock_name: s.stockName,
        category: s.category,
        location: s.location ?? "—",
        system_qty: systemQty,
        physical_qty: physicalQty,
        variance,
        status,
        last_counted: count?.countedAt.toISOString().split("T")[0] ?? null,
        counted_by: count?.countedByName ?? null,
      };
    });

    res.json({
      items,
      total: items.length,
      summary: {
        matched: items.filter((i) => i.status === "matched").length,
        variance: items.filter((i) => i.status === "variance").length,
        draft_adjustment: items.filter((i) => i.status === "draft_adjustment").length,
        pending: items.filter((i) => i.status === "pending").length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /reconciliation/count — Submit physical count ───────────────────────
router.post(
  "/count",
  requireRole("admin", "manager", "management_authority"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { stock_id, physical_qty, notes } = req.body as {
        stock_id: string;
        physical_qty: number;
        notes?: string;
      };

      if (!stock_id || physical_qty === undefined) {
        res.status(400).json({ error: "stock_id and physical_qty are required" });
        return;
      }

      const [inserted] = await db
        .insert(reconciliationCounts)
        .values({
          stockId: Number(stock_id),
          physicalQty: Number(physical_qty),
          countedBy: (req as any).user?.id ?? null,
          countedByName: (req as any).user?.name ?? "System",
          notes: notes ?? null,
        })
        .returning();

      res.json({
        ok: true,
        id: String(inserted.id),
        stock_id,
        physical_qty: Number(physical_qty),
        counted_at: inserted.countedAt.toISOString().split("T")[0],
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /reconciliation/reset — Clear all counts for a stock (admin only) ───
router.post(
  "/reset",
  requireRole("admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { stock_id } = req.body as { stock_id?: string };

      if (stock_id) {
        await db
          .delete(reconciliationCounts)
          .where(eq(reconciliationCounts.stockId, Number(stock_id)));
        res.json({ ok: true, message: `Counts cleared for stock ${stock_id}` });
      } else {
        await db.delete(reconciliationCounts);
        res.json({ ok: true, message: "All physical counts cleared" });
      }
    } catch (err) {
      next(err);
    }
  }
);

export default router;
