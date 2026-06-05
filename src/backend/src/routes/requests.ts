import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { assetRequests, assets, assetAssignments, users, activity, notifications } from "../db/schema/index.js";
import { eq, desc, sql, and } from "drizzle-orm";
import { requireRole } from "../middleware/rbac.js";

const router = Router();

const createRequestSchema = z.object({
  category: z.string().min(1),
  sub_category: z.string().optional(),
  item_description: z.string().min(3),
  reason: z.string().min(5),
  priority: z.enum(["low", "normal", "urgent", "critical"]).default("normal"),
});

// ─── GET /requests ─────────────────────────────────────────────────────────────
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const page_size = Math.min(50, Math.max(1, Number(req.query.page_size ?? 20)));
    const offset = (page - 1) * page_size;
    const status = req.query.status as string | undefined;

    // Admins/managers see all requests; regular users see only their own
    let whereClause = status ? eq(assetRequests.status, status as "pending" | "approved" | "rejected" | "fulfilled" | "cancelled") : sql`1=1`;
    if (role === "user" || role === "executive") {
      whereClause = and(whereClause, eq(assetRequests.requestedBy, userId))!;
    }

    const [{ total }] = await db.select({ total: sql<number>`COUNT(*)` }).from(assetRequests).where(whereClause);

    const rows = await db
      .select({
        id: assetRequests.id,
        requestCode: assetRequests.requestCode,
        requestedBy: assetRequests.requestedBy,
        requesterName: users.fullName,
        requesterEmail: users.email,
        category: assetRequests.category,
        subCategory: assetRequests.subCategory,
        itemDescription: assetRequests.itemDescription,
        reason: assetRequests.reason,
        priority: assetRequests.priority,
        status: assetRequests.status,
        reviewNotes: assetRequests.reviewNotes,
        reviewedAt: assetRequests.reviewedAt,
        fulfilledAt: assetRequests.fulfilledAt,
        fulfilledAssetId: assetRequests.fulfilledAssetId,
        acknowledgedAt: assetRequests.acknowledgedAt,
        createdAt: assetRequests.createdAt,
      })
      .from(assetRequests)
      .leftJoin(users, eq(users.id, assetRequests.requestedBy))
      .where(whereClause)
      .orderBy(desc(assetRequests.createdAt))
      .limit(page_size)
      .offset(offset);

    const totalNum = Number(total);
    res.json({
      items: rows.map((r) => ({
        id: String(r.id),
        request_code: r.requestCode,
        requested_by: String(r.requestedBy),
        requester_name: r.requesterName ?? null,
        requester_email: r.requesterEmail ?? null,
        category: r.category,
        sub_category: r.subCategory ?? null,
        item_description: r.itemDescription,
        reason: r.reason,
        priority: r.priority,
        status: r.status,
        review_notes: r.reviewNotes ?? null,
        reviewed_at: r.reviewedAt?.toISOString() ?? null,
        fulfilled_at: r.fulfilledAt?.toISOString() ?? null,
        fulfilled_asset_id: r.fulfilledAssetId ? String(r.fulfilledAssetId) : null,
        acknowledged_at: r.acknowledgedAt?.toISOString() ?? null,
        created_at: r.createdAt.toISOString(),
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

// ─── POST /requests ─────────────────────────────────────────────────────────────
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error_code: "VALIDATION_ERROR", message: "Invalid request data", details: parsed.error.flatten() });
      return;
    }
    const d = parsed.data;
    const requestCode = `REQ-${Date.now()}`;

    const [request] = await db.insert(assetRequests).values({
      requestCode,
      requestedBy: req.user!.id,
      category: d.category,
      subCategory: d.sub_category,
      itemDescription: d.item_description,
      reason: d.reason,
      priority: d.priority,
      status: "pending",
    }).returning();

    await db.insert(activity).values({
      eventType: "asset_request_created",
      description: `${req.user!.name} raised a request for ${d.item_description} (${d.category})`,
      actor: req.user!.email,
      entityType: "asset_request",
      entityId: request.id,
      ipAddress: req.ip,
    });

    // Notify managers
    const managers = await db.select({ id: users.id }).from(users).where(sql`role IN ('manager', 'admin')`);
    if (managers.length > 0) {
      await db.insert(notifications).values(managers.map((m) => ({
        userId: m.id,
        type: "asset_request",
        title: `New Asset Request: ${d.category}`,
        message: `${req.user!.name} has requested ${d.item_description}. Priority: ${d.priority}`,
        relatedEntityType: "asset_request",
        relatedEntityId: request.id,
      })));
    }

    res.status(201).json({
      id: String(request.id),
      request_code: requestCode,
      status: "pending",
      message: "Request submitted successfully",
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /requests/:id/approve ────────────────────────────────────────────────
router.post("/:id/approve", requireRole("admin", "manager"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const { review_notes, asset_id } = req.body;

    const [request] = await db.select().from(assetRequests).where(eq(assetRequests.id, id)).limit(1);
    if (!request) {
      res.status(404).json({ error_code: "NOT_FOUND", message: "Request not found" });
      return;
    }

    await db.update(assetRequests).set({
      status: "approved",
      reviewedBy: req.user!.id,
      reviewedAt: new Date(),
      reviewNotes: review_notes ?? null,
      updatedAt: new Date(),
    }).where(eq(assetRequests.id, id));

    // Notify requester
    await db.insert(notifications).values({
      userId: request.requestedBy,
      type: "request_approved",
      title: "Your request has been approved",
      message: `Your request for ${request.itemDescription} has been approved by ${req.user!.name}.${review_notes ? ` Note: ${review_notes}` : ""}`,
      relatedEntityType: "asset_request",
      relatedEntityId: id,
    });

    await db.insert(activity).values({
      eventType: "asset_request_approved",
      description: `Request ${request.requestCode} approved by ${req.user!.name}`,
      actor: req.user!.email,
      entityType: "asset_request",
      entityId: id,
      ipAddress: req.ip,
    });

    res.json({ message: "Request approved" });
  } catch (err) {
    next(err);
  }
});

// ─── POST /requests/:id/reject ─────────────────────────────────────────────────
router.post("/:id/reject", requireRole("admin", "manager"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const { review_notes } = req.body;

    const [request] = await db.select().from(assetRequests).where(eq(assetRequests.id, id)).limit(1);
    if (!request) {
      res.status(404).json({ error_code: "NOT_FOUND", message: "Request not found" });
      return;
    }

    await db.update(assetRequests).set({
      status: "rejected",
      reviewedBy: req.user!.id,
      reviewedAt: new Date(),
      reviewNotes: review_notes ?? null,
      updatedAt: new Date(),
    }).where(eq(assetRequests.id, id));

    await db.insert(notifications).values({
      userId: request.requestedBy,
      type: "request_rejected",
      title: "Your request has been rejected",
      message: `Your request for ${request.itemDescription} was rejected.${review_notes ? ` Reason: ${review_notes}` : ""}`,
      relatedEntityType: "asset_request",
      relatedEntityId: id,
    });

    await db.insert(activity).values({
      eventType: "asset_request_rejected",
      description: `Request ${request.requestCode} rejected by ${req.user!.name}`,
      actor: req.user!.email,
      entityType: "asset_request",
      entityId: id,
      ipAddress: req.ip,
    });

    res.json({ message: "Request rejected" });
  } catch (err) {
    next(err);
  }
});

// ─── POST /requests/:id/fulfill ────────────────────────────────────────────────
router.post("/:id/fulfill", requireRole("admin", "manager"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const { asset_id, validity_date, notes } = req.body;

    if (!asset_id) {
      res.status(400).json({ error_code: "VALIDATION_ERROR", message: "asset_id is required" });
      return;
    }

    const [request] = await db.select().from(assetRequests).where(eq(assetRequests.id, id)).limit(1);
    if (!request) {
      res.status(404).json({ error_code: "NOT_FOUND", message: "Request not found" });
      return;
    }

    const [asset] = await db.select().from(assets).where(eq(assets.id, Number(asset_id))).limit(1);
    if (!asset) {
      res.status(404).json({ error_code: "NOT_FOUND", message: "Asset not found" });
      return;
    }

    const assignmentCode = `ASGN-${Date.now()}`;
    const now = new Date();
    const nextAudit = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    await db.insert(assetAssignments).values({
      assignmentCode,
      assetId: Number(asset_id),
      employeeId: request.requestedBy,
      assignedDate: now,
      validityDate: validity_date ? new Date(validity_date) : undefined,
      nextAuditDue: nextAudit,
      status: "active",
      purpose: request.itemDescription,
      notes: notes ?? null,
      assignedBy: req.user!.id,
    });

    await db.update(assets).set({ status: "assigned", updatedAt: new Date() }).where(eq(assets.id, Number(asset_id)));

    await db.update(assetRequests).set({
      status: "fulfilled",
      fulfilledAssetId: Number(asset_id),
      fulfilledAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(assetRequests.id, id));

    await db.insert(notifications).values({
      userId: request.requestedBy,
      type: "request_fulfilled",
      title: "Your request has been fulfilled",
      message: `Your request for ${request.itemDescription} has been fulfilled. Asset ${asset.assetTag} has been assigned to you.`,
      relatedEntityType: "asset_request",
      relatedEntityId: id,
    });

    await db.insert(activity).values({
      eventType: "asset_request_fulfilled",
      description: `Request ${request.requestCode} fulfilled with asset ${asset.assetTag} by ${req.user!.name}`,
      actor: req.user!.email,
      entityType: "asset_request",
      entityId: id,
      ipAddress: req.ip,
    });

    res.json({ message: "Request fulfilled and asset assigned", assignment_code: assignmentCode });
  } catch (err) {
    next(err);
  }
});

// ─── POST /requests/:id/acknowledge ──────────────────────────────────────────
// Employee confirms they have received the fulfilled asset.
router.post("/:id/acknowledge", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error_code: "INVALID_ID", message: "Invalid request ID" });
      return;
    }

    const [request] = await db.select().from(assetRequests).where(eq(assetRequests.id, id)).limit(1);
    if (!request) {
      res.status(404).json({ error_code: "NOT_FOUND", message: "Request not found" });
      return;
    }
    // Only the requester can acknowledge their own request.
    if (request.requestedBy !== req.user!.id) {
      res.status(403).json({ error_code: "FORBIDDEN", message: "You can only acknowledge your own requests" });
      return;
    }
    if (request.status !== "fulfilled") {
      res.status(400).json({ error_code: "INVALID_STATE", message: "Only fulfilled requests can be acknowledged" });
      return;
    }
    if (request.acknowledgedAt) {
      res.json({ message: "Request already acknowledged" });
      return;
    }

    await db.update(assetRequests).set({
      acknowledgedBy: req.user!.id,
      acknowledgedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(assetRequests.id, id));

    await db.insert(activity).values({
      eventType: "asset_request_acknowledged",
      description: `${req.user!.name} acknowledged receipt for request ${request.requestCode}`,
      actor: req.user!.email,
      entityType: "asset_request",
      entityId: id,
      ipAddress: req.ip,
    });

    // Notify the manager who fulfilled it (best-effort).
    if (request.reviewedBy) {
      await db.insert(notifications).values({
        userId: request.reviewedBy,
        type: "request_acknowledged",
        title: "Asset receipt acknowledged",
        message: `${req.user!.name} confirmed receipt for ${request.itemDescription}.`,
        relatedEntityType: "asset_request",
        relatedEntityId: id,
      });
    }

    res.json({ message: "Receipt acknowledged" });
  } catch (err) {
    next(err);
  }
});

export default router;
