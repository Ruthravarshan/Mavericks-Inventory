import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db/index.js";
import { legalHolds } from "../db/schema/index.js";
import { eq, ilike, or, desc, and } from "drizzle-orm";
import { requireRole } from "../middleware/rbac.js";

const router = Router();

// ─── GET /legal-holds ──────────────────────────────────────────────────────────
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, search } = req.query as { status?: string; search?: string };

    const conditions = [];
    if (status && status !== "all") {
      conditions.push(eq(legalHolds.status, status as "active" | "released"));
    }
    if (search) {
      conditions.push(
        or(
          ilike(legalHolds.title, `%${search}%`),
          ilike(legalHolds.caseNumber, `%${search}%`),
          ilike(legalHolds.holdReference, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select()
      .from(legalHolds)
      .where(whereClause)
      .orderBy(desc(legalHolds.createdAt));

    const items = rows.map(toResponse);

    // For summary stats, always query without filters
    const allRows = await db.select().from(legalHolds);
    const activeHolds = allRows.filter((h) => h.status === "active");

    res.json({
      items,
      total: items.length,
      active_count: activeHolds.length,
      total_locked: activeHolds.reduce((s, h) => s + h.recordsLocked, 0),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /legal-holds/:id ──────────────────────────────────────────────────────
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [hold] = await db
      .select()
      .from(legalHolds)
      .where(eq(legalHolds.id, Number(req.params.id)));

    if (!hold) {
      res.status(404).json({ error: "Legal hold not found" });
      return;
    }
    res.json(toResponse(hold));
  } catch (err) {
    next(err);
  }
});

// ─── POST /legal-holds — Create (admin only) ──────────────────────────────────
router.post(
  "/",
  requireRole("admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, scope, reason, case_number, records_locked } = req.body as {
        title: string;
        scope: "transaction" | "stock_master" | "user_records";
        reason: string;
        case_number: string;
        records_locked?: number;
      };

      if (!title || !scope || !reason || !case_number) {
        res.status(400).json({ error: "title, scope, reason, and case_number are required" });
        return;
      }

      const year = new Date().getFullYear();
      // Count existing holds this year for reference
      const existing = await db
        .select({ id: legalHolds.id })
        .from(legalHolds);
      const seq = String(existing.length + 1).padStart(3, "0");
      const holdReference = `LH-${year}-${seq}`;

      const [inserted] = await db
        .insert(legalHolds)
        .values({
          holdReference,
          title,
          scope,
          reason,
          caseNumber: case_number,
          recordsLocked: records_locked ?? 0,
          initiatedBy: (req as any).user?.id ?? null,
          initiatedByName: (req as any).user?.name ?? "Admin",
          status: "active",
        })
        .returning();

      res.status(201).json(toResponse(inserted));
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /legal-holds/:id/release — Release (admin only) ─────────────────────
router.post(
  "/:id/release",
  requireRole("admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const [hold] = await db.select().from(legalHolds).where(eq(legalHolds.id, id));

      if (!hold) {
        res.status(404).json({ error: "Legal hold not found" });
        return;
      }
      if (hold.status === "released") {
        res.status(400).json({ error: "Hold is already released" });
        return;
      }

      const [updated] = await db
        .update(legalHolds)
        .set({
          status: "released",
          releasedBy: (req as any).user?.id ?? null,
          releasedByName: (req as any).user?.name ?? "Admin",
          releasedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(legalHolds.id, id))
        .returning();

      res.json(toResponse(updated));
    } catch (err) {
      next(err);
    }
  }
);

function toResponse(h: typeof legalHolds.$inferSelect) {
  return {
    id: h.id,
    hold_reference: h.holdReference,
    title: h.title,
    scope: h.scope,
    status: h.status,
    records_locked: h.recordsLocked,
    initiated_by: h.initiatedByName,
    initiated_at: h.createdAt.toISOString().split("T")[0],
    reason: h.reason,
    case_number: h.caseNumber,
    released_at: h.releasedAt ? h.releasedAt.toISOString().split("T")[0] : null,
    released_by: h.releasedByName ?? null,
  };
}

export default router;
