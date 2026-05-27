import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db/index.js";
import { assets, assetAssignments, assetAudits, activity } from "../db/schema/index.js";
import { eq, and, desc, sql } from "drizzle-orm";

const router = Router();

// ─── GET /my-assets ────────────────────────────────────────────────────────────
// Returns all assets currently assigned to the authenticated user
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const rows = await db
      .select({
        assignmentId: assetAssignments.id,
        assignmentCode: assetAssignments.assignmentCode,
        assetId: assets.id,
        assetTag: assets.assetTag,
        serialNumber: assets.serialNumber,
        category: assets.category,
        subCategory: assets.subCategory,
        brand: assets.brand,
        model: assets.model,
        description: assets.description,
        condition: assets.condition,
        assetStatus: assets.status,
        location: assets.location,
        warrantyExpiry: assets.warrantyExpiry,
        assignedDate: assetAssignments.assignedDate,
        validityDate: assetAssignments.validityDate,
        nextAuditDue: assetAssignments.nextAuditDue,
        lastAuditDate: assetAssignments.lastAuditDate,
        purpose: assetAssignments.purpose,
        assignmentStatus: assetAssignments.status,
      })
      .from(assetAssignments)
      .leftJoin(assets, eq(assets.id, assetAssignments.assetId))
      .where(and(eq(assetAssignments.employeeId, userId), eq(assetAssignments.status, "active")))
      .orderBy(desc(assetAssignments.assignedDate));

    const now = new Date();
    const items = rows.map((r) => {
      const validityDate = r.validityDate;
      const nextAuditDue = r.nextAuditDue;
      const warrantyExpiry = r.warrantyExpiry;

      let validityStatus: string = "valid";
      if (validityDate) {
        const daysLeft = Math.ceil((validityDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0) validityStatus = "expired";
        else if (daysLeft <= 30) validityStatus = "expiring_soon";
      }

      let auditStatus: string = "ok";
      if (nextAuditDue && nextAuditDue < now) auditStatus = "overdue";
      else if (nextAuditDue) {
        const days = Math.ceil((nextAuditDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (days <= 14) auditStatus = "due_soon";
      }

      return {
        assignment_id: String(r.assignmentId),
        assignment_code: r.assignmentCode,
        asset_id: String(r.assetId),
        asset_tag: r.assetTag,
        serial_number: r.serialNumber ?? null,
        category: r.category,
        sub_category: r.subCategory ?? null,
        brand: r.brand ?? null,
        model: r.model ?? null,
        description: r.description ?? null,
        condition: r.condition,
        location: r.location ?? null,
        warranty_expiry: warrantyExpiry?.toISOString() ?? null,
        assigned_date: r.assignedDate?.toISOString() ?? null,
        validity_date: validityDate?.toISOString() ?? null,
        validity_status: validityStatus,
        next_audit_due: nextAuditDue?.toISOString() ?? null,
        last_audit_date: r.lastAuditDate?.toISOString() ?? null,
        audit_status: auditStatus,
        purpose: r.purpose ?? null,
        assignment_status: r.assignmentStatus,
      };
    });

    res.json({ items, total: items.length });
  } catch (err) {
    next(err);
  }
});

// ─── GET /my-assets/history ────────────────────────────────────────────────────
// Returns all past assignments (including returned/expired)
router.get("/history", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const page_size = Math.min(50, Math.max(1, Number(req.query.page_size ?? 20)));
    const offset = (page - 1) * page_size;

    const [{ total }] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(assetAssignments)
      .where(eq(assetAssignments.employeeId, userId));

    const rows = await db
      .select({
        assignmentId: assetAssignments.id,
        assignmentCode: assetAssignments.assignmentCode,
        assetId: assets.id,
        assetTag: assets.assetTag,
        category: assets.category,
        brand: assets.brand,
        model: assets.model,
        assignedDate: assetAssignments.assignedDate,
        returnedDate: assetAssignments.returnedDate,
        validityDate: assetAssignments.validityDate,
        assignmentStatus: assetAssignments.status,
      })
      .from(assetAssignments)
      .leftJoin(assets, eq(assets.id, assetAssignments.assetId))
      .where(eq(assetAssignments.employeeId, userId))
      .orderBy(desc(assetAssignments.assignedDate))
      .limit(page_size)
      .offset(offset);

    const totalNum = Number(total);
    res.json({
      items: rows.map((r) => ({
        assignment_id: String(r.assignmentId),
        assignment_code: r.assignmentCode,
        asset_id: String(r.assetId),
        asset_tag: r.assetTag,
        category: r.category,
        brand: r.brand ?? null,
        model: r.model ?? null,
        assigned_date: r.assignedDate?.toISOString() ?? null,
        returned_date: r.returnedDate?.toISOString() ?? null,
        validity_date: r.validityDate?.toISOString() ?? null,
        status: r.assignmentStatus,
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

// ─── GET /my-assets/audits ─────────────────────────────────────────────────────
router.get("/audits", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const rows = await db
      .select({
        auditId: assetAudits.id,
        auditCode: assetAudits.auditCode,
        assetId: assets.id,
        assetTag: assets.assetTag,
        category: assets.category,
        model: assets.model,
        auditType: assetAudits.auditType,
        aiStatus: assetAudits.aiStatus,
        aiConfidence: assetAudits.aiConfidence,
        aiObservations: assetAudits.aiObservations,
        finalStatus: assetAudits.finalStatus,
        completedAt: assetAudits.completedAt,
        createdAt: assetAudits.createdAt,
      })
      .from(assetAudits)
      .leftJoin(assets, eq(assets.id, assetAudits.assetId))
      .where(eq(assetAudits.conductedBy, userId))
      .orderBy(desc(assetAudits.createdAt))
      .limit(50);

    res.json({
      items: rows.map((r) => ({
        audit_id: String(r.auditId),
        audit_code: r.auditCode,
        asset_id: String(r.assetId),
        asset_tag: r.assetTag,
        category: r.category ?? null,
        model: r.model ?? null,
        audit_type: r.auditType,
        ai_status: r.aiStatus,
        ai_confidence: r.aiConfidence ?? null,
        ai_observations: r.aiObservations ?? null,
        final_status: r.finalStatus,
        completed_at: r.completedAt?.toISOString() ?? null,
        created_at: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
