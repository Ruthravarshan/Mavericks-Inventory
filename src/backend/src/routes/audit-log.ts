import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db/index.js";
import { activity } from "../db/schema/index.js";
import { sql, desc, gte, lte, and, ilike } from "drizzle-orm";
import { requireRole } from "../middleware/rbac.js";

const router = Router();

// ─── GET /audit-log ───────────────────────────────────────────────────────────

router.get("/", requireRole("manager", "management_authority", "admin"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const page_size = Math.min(100, Math.max(1, Number(req.query.page_size ?? 20)));
    const offset = (page - 1) * page_size;

    const [{ total }] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(activity);

    const rows = await db
      .select()
      .from(activity)
      .orderBy(desc(activity.createdAt))
      .limit(page_size)
      .offset(offset);

    const items = rows.map((r) => ({
      id: String(r.id),
      event_type: r.eventType,
      description: r.description,
      actor_id: "",
      actor_name: r.actor,
      actor_role: "",
      entity_type: r.entityType ?? "",
      entity_id: String(r.entityId ?? ""),
      entity_name: "",
      ip_address: r.ipAddress ?? null,
      created_at: (r.createdAt ?? r.timestamp).toISOString(),
    }));

    const totalNum = Number(total);
    res.json({
      items,
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
