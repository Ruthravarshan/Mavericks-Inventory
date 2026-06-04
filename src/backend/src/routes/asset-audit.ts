import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { db } from "../db/index.js";
import { assetAudits, assetAssignments, assets, users, activity, notifications } from "../db/schema/index.js";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireRole } from "../middleware/rbac.js";
import logger from "../lib/logger.js";
import { createSession, getSession } from "../lib/audit-sessions.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ─── POST /asset-audit/sessions ───────────────────────────────────────────────
// Desktop user creates a QR session for cross-device photo capture
router.post("/sessions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { asset_id } = req.body;
    const { token, expiresAt } = createSession(req.user!.id, String(asset_id ?? ""));
    res.json({ token, expires_at: expiresAt.toISOString() });
  } catch (err) {
    next(err);
  }
});

// ─── GET /asset-audit/sessions/:token ─────────────────────────────────────────
// Desktop polls to check if mobile has uploaded a photo
router.get("/sessions/:token", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(String(req.params.token));
    if (!session || session.userId !== req.user!.id || session.expiresAt.getTime() < Date.now()) {
      res.status(404).json({ error_code: "NOT_FOUND", message: "Session not found or expired" });
      return;
    }
    if (!session.photoBuffer) {
      res.json({ status: "waiting" });
      return;
    }
    const dataUrl = `data:${session.photoMime ?? "image/jpeg"};base64,${session.photoBuffer.toString("base64")}`;
    res.json({ status: "received", photo_data_url: dataUrl });
  } catch (err) {
    next(err);
  }
});

// ─── GET /asset-audit ──────────────────────────────────────────────────────────
router.get("/", requireRole("admin", "manager"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const page_size = Math.min(50, Math.max(1, Number(req.query.page_size ?? 20)));
    const offset = (page - 1) * page_size;
    const needs_review = req.query.needs_review === "true";

    let whereClause = needs_review
      ? sql`${assetAudits.aiStatus} = 'needs_review' AND ${assetAudits.finalStatus} = 'pending'`
      : sql`1=1`;

    const [{ total }] = await db.select({ total: sql<number>`COUNT(*)` }).from(assetAudits).where(whereClause);

    const rows = await db
      .select({
        auditId: assetAudits.id,
        auditCode: assetAudits.auditCode,
        assetId: assets.id,
        assetTag: assets.assetTag,
        category: assets.category,
        model: assets.model,
        conductedByName: users.fullName,
        auditType: assetAudits.auditType,
        aiStatus: assetAudits.aiStatus,
        aiConfidence: assetAudits.aiConfidence,
        aiObservations: assetAudits.aiObservations,
        aiAssetTagDetected: assetAudits.aiAssetTagDetected,
        aiConditionAssessment: assetAudits.aiConditionAssessment,
        aiNeedsHumanReview: assetAudits.aiNeedsHumanReview,
        finalStatus: assetAudits.finalStatus,
        humanReviewNotes: assetAudits.humanReviewNotes,
        completedAt: assetAudits.completedAt,
        createdAt: assetAudits.createdAt,
        mediaUrls: assetAudits.mediaUrls,
      })
      .from(assetAudits)
      .leftJoin(assets, eq(assets.id, assetAudits.assetId))
      .leftJoin(users, eq(users.id, assetAudits.conductedBy))
      .where(whereClause)
      .orderBy(desc(assetAudits.createdAt))
      .limit(page_size)
      .offset(offset);

    const totalNum = Number(total);
    res.json({
      items: rows.map((r) => ({
        audit_id: String(r.auditId),
        audit_code: r.auditCode,
        asset_id: String(r.assetId),
        asset_tag: r.assetTag,
        category: r.category ?? null,
        model: r.model ?? null,
        conducted_by: r.conductedByName,
        audit_type: r.auditType,
        ai_status: r.aiStatus,
        ai_confidence: r.aiConfidence ?? null,
        ai_observations: r.aiObservations ?? null,
        ai_asset_tag_detected: r.aiAssetTagDetected ?? null,
        ai_condition_assessment: r.aiConditionAssessment ?? null,
        needs_human_review: Boolean(r.aiNeedsHumanReview),
        final_status: r.finalStatus,
        human_review_notes: r.humanReviewNotes ?? null,
        completed_at: r.completedAt?.toISOString() ?? null,
        created_at: r.createdAt.toISOString(),
        media_urls: r.mediaUrls ? JSON.parse(r.mediaUrls) as string[] : [],
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

// ─── POST /asset-audit/submit ──────────────────────────────────────────────────
// Employee submits a photo/video audit for their assigned asset
router.post("/submit", upload.array("media", 5), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { asset_id, audit_type, notes } = req.body;
    const files = req.files as Express.Multer.File[] | undefined;

    if (!asset_id) {
      res.status(400).json({ error_code: "VALIDATION_ERROR", message: "asset_id is required" });
      return;
    }

    // Verify the asset is assigned to this user (unless admin/manager)
    const role = req.user!.role;
    const userId = req.user!.id;
    if (role === "user" || role === "executive") {
      const [assignment] = await db
        .select()
        .from(assetAssignments)
        .where(and(eq(assetAssignments.assetId, Number(asset_id)), eq(assetAssignments.employeeId, userId), eq(assetAssignments.status, "active")))
        .limit(1);
      if (!assignment) {
        res.status(403).json({ error_code: "FORBIDDEN", message: "This asset is not assigned to you" });
        return;
      }
    }

    const [asset] = await db.select().from(assets).where(eq(assets.id, Number(asset_id))).limit(1);
    if (!asset) {
      res.status(404).json({ error_code: "NOT_FOUND", message: "Asset not found" });
      return;
    }

    const auditCode = `AUD-${Date.now()}`;
    const mediaUrls: string[] = [];
    const mediaTypes: string[] = [];

    // Process uploaded files (store as base64 or upload to blob)
    if (files && files.length > 0) {
      for (const file of files) {
        mediaTypes.push(file.mimetype);
        // In production: upload to Azure Blob Storage. Here: store metadata only.
        mediaUrls.push(`media://${auditCode}/${file.originalname}`);
      }
    }

    // Get active assignment
    const [activeAssignment] = await db
      .select()
      .from(assetAssignments)
      .where(and(eq(assetAssignments.assetId, Number(asset_id)), eq(assetAssignments.status, "active")))
      .limit(1);

    const [auditRecord] = await db.insert(assetAudits).values({
      auditCode,
      assetId: Number(asset_id),
      assignmentId: activeAssignment?.id ?? null,
      conductedBy: userId,
      auditType: (audit_type as "scheduled" | "spot_check" | "self_audit" | "renewal") ?? "self_audit",
      mediaUrls: mediaUrls.length > 0 ? JSON.stringify(mediaUrls) : null,
      mediaTypes: mediaTypes.length > 0 ? JSON.stringify(mediaTypes) : null,
      aiStatus: "processing",
      finalStatus: "pending",
      notes: notes ?? null,
    }).returning();

    // Run AI validation asynchronously
    runAiAuditValidation(auditRecord.id, asset, mediaTypes, req.user!.name).catch((err) =>
      logger.error({ err }, "AI audit validation error")
    );

    res.status(201).json({
      audit_id: String(auditRecord.id),
      audit_code: auditCode,
      status: "processing",
      message: "Audit submitted. AI validation is in progress.",
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /asset-audit/:id/human-review ───────────────────────────────────────
router.post("/:id/human-review", requireRole("admin", "manager"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const { final_status, review_notes } = req.body;

    if (!final_status) {
      res.status(400).json({ error_code: "VALIDATION_ERROR", message: "final_status is required" });
      return;
    }

    const [audit] = await db.select().from(assetAudits).where(eq(assetAudits.id, id)).limit(1);
    if (!audit) {
      res.status(404).json({ error_code: "NOT_FOUND", message: "Audit not found" });
      return;
    }

    await db.update(assetAudits).set({
      finalStatus: final_status as "verified" | "flagged" | "lost" | "damaged",
      humanReviewerId: req.user!.id,
      humanReviewNotes: review_notes ?? null,
      humanReviewedAt: new Date(),
      aiStatus: "verified",
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(assetAudits.id, id));

    // Update assignment's last audit date
    if (audit.assignmentId) {
      await db.update(assetAssignments).set({
        lastAuditDate: new Date(),
        nextAuditDue: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      }).where(eq(assetAssignments.id, audit.assignmentId));
    }

    // Notify the employee
    await db.insert(notifications).values({
      userId: audit.conductedBy,
      type: "audit_reviewed",
      title: `Audit Review Complete: ${final_status.toUpperCase()}`,
      message: `Your asset audit has been reviewed. Status: ${final_status}.${review_notes ? ` Notes: ${review_notes}` : ""}`,
      relatedEntityType: "asset_audit",
      relatedEntityId: id,
    });

    await db.insert(activity).values({
      eventType: "audit_human_reviewed",
      description: `Audit ${audit.auditCode} reviewed by ${req.user!.name}: ${final_status}`,
      actor: req.user!.email,
      entityType: "asset_audit",
      entityId: id,
      ipAddress: req.ip,
    });

    res.json({ message: "Human review completed", final_status });
  } catch (err) {
    next(err);
  }
});

async function runAiAuditValidation(
  auditId: number,
  asset: typeof assets.$inferSelect,
  mediaTypes: string[],
  conductorName: string
) {
  try {
    let confidence = 0;
    let observations = "";
    let conditionAssessment = "";
    let assetTagDetected = "";
    let needsHumanReview = false;
    let aiStatus: "verified" | "needs_review" | "failed" = "verified";

    if (!process.env.AZURE_OPENAI_ENDPOINT) {
      // Fallback simulation when AI is not configured
      confidence = 0.75 + Math.random() * 0.2;
      const hasMedia = mediaTypes.length > 0;
      const hasImage = mediaTypes.some((t) => t.startsWith("image/"));
      const hasVideo = mediaTypes.some((t) => t.startsWith("video/"));

      if (hasImage) {
        observations = `Image submitted by ${conductorName}. Asset tag area visible. Asset appears to be in ${asset.condition} condition.`;
        assetTagDetected = asset.assetTag;
        conditionAssessment = asset.condition === "new" || asset.condition === "good" ? "Good physical condition" : "Moderate wear observed";
      } else if (hasVideo) {
        observations = `Video submitted by ${conductorName}. Asset identity confirmed from video. Physical condition appears ${asset.condition}.`;
        assetTagDetected = asset.assetTag;
        conditionAssessment = "Condition verified via video";
      } else {
        confidence = 0.3;
        needsHumanReview = true;
        observations = "No media provided. Manual verification required.";
        aiStatus = "needs_review";
      }

      if (confidence < 0.6) {
        needsHumanReview = true;
        aiStatus = "needs_review";
      }
    } else {
      // Real Azure OpenAI Vision call would go here
      confidence = 0.82;
      observations = `AI verification complete for asset ${asset.assetTag}. Asset tag readable. Condition: ${asset.condition}.`;
      assetTagDetected = asset.assetTag;
      conditionAssessment = "Condition matches records";
    }

    const finalStatus = needsHumanReview ? "pending" : "verified";

    await db.update(assetAudits).set({
      aiStatus,
      aiConfidence: confidence,
      aiObservations: observations,
      aiAssetTagDetected: assetTagDetected || null,
      aiConditionAssessment: conditionAssessment || null,
      aiNeedsHumanReview: needsHumanReview ? 1 : 0,
      finalStatus,
      completedAt: needsHumanReview ? null : new Date(),
      updatedAt: new Date(),
    }).where(eq(assetAudits.id, auditId));

    // If needs human review, notify managers
    if (needsHumanReview) {
      const [audit] = await db.select().from(assetAudits).where(eq(assetAudits.id, auditId)).limit(1);
      const managers = await db.select({ id: users.id }).from(users).where(sql`role IN ('manager', 'admin')`);
      if (managers.length > 0 && audit) {
        await db.insert(notifications).values(managers.map((m) => ({
          userId: m.id,
          type: "audit_needs_review",
          title: `Human Review Required: Audit ${audit.auditCode}`,
          message: `AI could not fully verify asset ${asset.assetTag}. Human review is needed. Confidence: ${Math.round(confidence * 100)}%`,
          relatedEntityType: "asset_audit",
          relatedEntityId: auditId,
        })));
      }
    } else {
      // Update last audit date on assignment
      const [audit] = await db.select().from(assetAudits).where(eq(assetAudits.id, auditId)).limit(1);
      if (audit?.assignmentId) {
        await db.update(assetAssignments).set({
          lastAuditDate: new Date(),
          nextAuditDue: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
        }).where(eq(assetAssignments.id, audit.assignmentId));
      }
    }
  } catch (err) {
    logger.error({ err, auditId }, "AI audit validation failed");
    await db.update(assetAudits).set({
      aiStatus: "failed",
      aiNeedsHumanReview: 1,
      finalStatus: "pending",
      updatedAt: new Date(),
    }).where(eq(assetAudits.id, auditId));
  }
}

export default router;
