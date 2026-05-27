import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db/index.js";
import { users, assets, assetAssignments } from "../db/schema/index.js";
import { eq, and, desc, sql, ilike, inArray, or } from "drizzle-orm";

const router = Router();

// ─── GET /employees ────────────────────────────────────────────────────────────
// Employee directory with asset counts (accessible to all authenticated users)
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const page_size = Math.min(50, Math.max(1, Number(req.query.page_size ?? 20)));
    const offset = (page - 1) * page_size;
    const search = req.query.search as string | undefined;
    const department = req.query.department as string | undefined;

    let whereClause = and(eq(users.isActive, true), sql`role IN ('user', 'executive')`);
    if (search) {
      const pattern = `%${search}%`;
      whereClause = and(whereClause, or(ilike(users.fullName, pattern), ilike(users.employeeId, pattern), ilike(users.email, pattern)))!;
    }
    if (department) whereClause = and(whereClause, eq(users.department, department))!;

    const [{ total }] = await db.select({ total: sql<number>`COUNT(*)` }).from(users).where(whereClause);

    const rows = await db
      .select({
        id: users.id,
        employeeId: users.employeeId,
        fullName: users.fullName,
        email: users.email,
        department: users.department,
        designation: users.designation,
        location: users.location,
        onboardingDate: users.onboardingDate,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(whereClause)
      .orderBy(users.fullName)
      .limit(page_size)
      .offset(offset);

    // Get asset counts per employee
    const employeeIds = rows.map((r) => r.id);
    const assetCounts = employeeIds.length > 0 ? await db
      .select({
        employeeId: assetAssignments.employeeId,
        count: sql<number>`COUNT(*)`,
      })
      .from(assetAssignments)
      .where(and(eq(assetAssignments.status, "active"), inArray(assetAssignments.employeeId, employeeIds)))
      .groupBy(assetAssignments.employeeId)
      : [];

    const countMap = new Map(assetCounts.map((a) => [a.employeeId, Number(a.count)]));

    const totalNum = Number(total);
    res.json({
      items: rows.map((r) => ({
        id: String(r.id),
        employee_id: r.employeeId,
        name: r.fullName,
        email: r.email,
        department: r.department ?? null,
        designation: r.designation ?? null,
        location: r.location ?? null,
        onboarding_date: r.onboardingDate?.toISOString() ?? null,
        is_active: r.isActive,
        asset_count: countMap.get(r.id) ?? 0,
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

// ─── GET /employees/:id/assets ─────────────────────────────────────────────────
// Get all assets assigned to a specific employee (manager/admin only, or own)
router.get("/:id/assets", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = Number(req.params.id);
    const requesterId = req.user!.id;
    const role = req.user!.role;

    // Regular users can only view their own assets
    if ((role === "user" || role === "executive") && employeeId !== requesterId) {
      res.status(403).json({ error_code: "FORBIDDEN", message: "Access denied" });
      return;
    }

    const rows = await db
      .select({
        assignmentId: assetAssignments.id,
        assignmentCode: assetAssignments.assignmentCode,
        assetId: assets.id,
        assetTag: assets.assetTag,
        category: assets.category,
        subCategory: assets.subCategory,
        brand: assets.brand,
        model: assets.model,
        condition: assets.condition,
        serialNumber: assets.serialNumber,
        location: assets.location,
        warrantyExpiry: assets.warrantyExpiry,
        assignedDate: assetAssignments.assignedDate,
        validityDate: assetAssignments.validityDate,
        nextAuditDue: assetAssignments.nextAuditDue,
        lastAuditDate: assetAssignments.lastAuditDate,
        assignmentStatus: assetAssignments.status,
      })
      .from(assetAssignments)
      .leftJoin(assets, eq(assets.id, assetAssignments.assetId))
      .where(eq(assetAssignments.employeeId, employeeId))
      .orderBy(desc(assetAssignments.assignedDate));

    const now = new Date();
    res.json({
      items: rows.map((r) => {
        const daysToExpiry = r.validityDate
          ? Math.ceil((r.validityDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null;
        const auditOverdue = r.nextAuditDue ? r.nextAuditDue < now : false;

        return {
          assignment_id: String(r.assignmentId),
          assignment_code: r.assignmentCode,
          asset_id: String(r.assetId),
          asset_tag: r.assetTag,
          category: r.category,
          sub_category: r.subCategory ?? null,
          brand: r.brand ?? null,
          model: r.model ?? null,
          condition: r.condition,
          serial_number: r.serialNumber ?? null,
          location: r.location ?? null,
          warranty_expiry: r.warrantyExpiry?.toISOString() ?? null,
          assigned_date: r.assignedDate?.toISOString() ?? null,
          validity_date: r.validityDate?.toISOString() ?? null,
          days_to_expiry: daysToExpiry,
          next_audit_due: r.nextAuditDue?.toISOString() ?? null,
          last_audit_date: r.lastAuditDate?.toISOString() ?? null,
          audit_overdue: auditOverdue,
          status: r.assignmentStatus,
        };
      }),
      total: rows.length,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
