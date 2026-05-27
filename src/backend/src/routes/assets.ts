import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { assets, assetAssignments, users, activity } from "../db/schema/index.js";
import { eq, and, isNull, desc, sql, or, ilike, inArray } from "drizzle-orm";
import { requireRole } from "../middleware/rbac.js";

const router = Router();

const createAssetSchema = z.object({
  asset_tag: z.string().min(1),
  serial_number: z.string().optional(),
  stock_id: z.number().optional(),
  category: z.string().min(1),
  sub_category: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  description: z.string().optional(),
  condition: z.enum(["new", "good", "fair", "poor", "damaged"]).default("new"),
  status: z.enum(["available", "assigned", "under_maintenance", "retired", "lost"]).default("available"),
  location: z.string().optional(),
  purchase_date: z.string().optional(),
  warranty_expiry: z.string().optional(),
  purchase_price: z.string().optional(),
  invoice_number: z.string().optional(),
  notes: z.string().optional(),
});

// ─── GET /assets ───────────────────────────────────────────────────────────────
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const page_size = Math.min(100, Math.max(1, Number(req.query.page_size ?? 20)));
    const offset = (page - 1) * page_size;
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;
    const status = req.query.status as string | undefined;

    let whereClause = isNull(assets.deletedAt);
    if (category) whereClause = and(whereClause, eq(assets.category, category))!;
    if (status) whereClause = and(whereClause, eq(assets.status, status as "available" | "assigned" | "under_maintenance" | "retired" | "lost"))!;
    if (search) whereClause = and(whereClause, or(ilike(assets.assetTag, `%${search}%`), ilike(assets.model, `%${search}%`), ilike(assets.serialNumber, `%${search}%`)))!;

    const [{ total }] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(assets)
      .where(whereClause);

    const rows = await db
      .select()
      .from(assets)
      .where(whereClause)
      .orderBy(desc(assets.createdAt))
      .limit(page_size)
      .offset(offset);

    // For each asset, get current assignment info
    const assetIds = rows.map((r) => r.id);
    const assignments = assetIds.length > 0 ? await db
      .select({
        assetId: assetAssignments.assetId,
        employeeId: assetAssignments.employeeId,
        employeeName: users.fullName,
        employeeEmail: users.email,
        validityDate: assetAssignments.validityDate,
        assignedDate: assetAssignments.assignedDate,
        nextAuditDue: assetAssignments.nextAuditDue,
      })
      .from(assetAssignments)
      .leftJoin(users, eq(users.id, assetAssignments.employeeId))
      .where(and(eq(assetAssignments.status, "active"), inArray(assetAssignments.assetId, assetIds)))
      : [];

    const assignmentMap = new Map(assignments.map((a) => [a.assetId, a]));

    const totalNum = Number(total);
    res.json({
      items: rows.map((r) => {
        const asgn = assignmentMap.get(r.id);
        return {
          id: String(r.id),
          asset_tag: r.assetTag,
          serial_number: r.serialNumber ?? null,
          stock_id: r.stockId ? String(r.stockId) : null,
          category: r.category,
          sub_category: r.subCategory ?? null,
          brand: r.brand ?? null,
          model: r.model ?? null,
          description: r.description ?? null,
          condition: r.condition,
          status: r.status,
          location: r.location ?? null,
          purchase_date: r.purchaseDate?.toISOString() ?? null,
          warranty_expiry: r.warrantyExpiry?.toISOString() ?? null,
          purchase_price: r.purchasePrice ?? null,
          invoice_number: r.invoiceNumber ?? null,
          notes: r.notes ?? null,
          created_at: r.createdAt.toISOString(),
          updated_at: r.updatedAt.toISOString(),
          current_assignee: asgn ? {
            employee_id: String(asgn.employeeId),
            employee_name: asgn.employeeName,
            employee_email: asgn.employeeEmail,
            assigned_date: asgn.assignedDate?.toISOString() ?? null,
            validity_date: asgn.validityDate?.toISOString() ?? null,
            next_audit_due: asgn.nextAuditDue?.toISOString() ?? null,
          } : null,
        };
      }),
      total: totalNum,
      page,
      page_size,
      total_pages: Math.ceil(totalNum / page_size),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /assets ──────────────────────────────────────────────────────────────
router.post("/", requireRole("admin", "manager"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createAssetSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error_code: "VALIDATION_ERROR", message: "Invalid asset data", details: parsed.error.flatten() });
      return;
    }
    const d = parsed.data;
    const [asset] = await db.insert(assets).values({
      assetTag: d.asset_tag,
      serialNumber: d.serial_number,
      stockId: d.stock_id,
      category: d.category,
      subCategory: d.sub_category,
      brand: d.brand,
      model: d.model,
      description: d.description,
      condition: d.condition,
      status: d.status,
      location: d.location,
      purchaseDate: d.purchase_date ? new Date(d.purchase_date) : undefined,
      warrantyExpiry: d.warranty_expiry ? new Date(d.warranty_expiry) : undefined,
      purchasePrice: d.purchase_price,
      invoiceNumber: d.invoice_number,
      notes: d.notes,
      createdBy: req.user!.id,
    }).returning();

    await db.insert(activity).values({
      eventType: "asset_created",
      description: `Asset ${asset.assetTag} created by ${req.user!.name}`,
      actor: req.user!.email,
      entityType: "asset",
      entityId: asset.id,
      ipAddress: req.ip,
    });

    res.status(201).json(mapAsset(asset, null));
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException & { code?: string }).code === "23505") {
      res.status(409).json({ error_code: "DUPLICATE_ASSET_TAG", message: "Asset tag already exists" });
      return;
    }
    next(err);
  }
});

// ─── GET /assets/:id ───────────────────────────────────────────────────────────
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const [asset] = await db.select().from(assets).where(and(eq(assets.id, id), isNull(assets.deletedAt))).limit(1);
    if (!asset) {
      res.status(404).json({ error_code: "NOT_FOUND", message: "Asset not found" });
      return;
    }
    const [asgn] = await db
      .select({
        employeeId: assetAssignments.employeeId,
        employeeName: users.fullName,
        employeeEmail: users.email,
        validityDate: assetAssignments.validityDate,
        assignedDate: assetAssignments.assignedDate,
        nextAuditDue: assetAssignments.nextAuditDue,
      })
      .from(assetAssignments)
      .leftJoin(users, eq(users.id, assetAssignments.employeeId))
      .where(and(eq(assetAssignments.assetId, id), eq(assetAssignments.status, "active")))
      .limit(1);

    res.json(mapAsset(asset, asgn ?? null));
  } catch (err) {
    next(err);
  }
});

// ─── PUT /assets/:id ───────────────────────────────────────────────────────────
router.put("/:id", requireRole("admin", "manager"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const parsed = createAssetSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error_code: "VALIDATION_ERROR", message: "Invalid data" });
      return;
    }
    const d = parsed.data;
    const [asset] = await db.update(assets).set({
      ...(d.asset_tag && { assetTag: d.asset_tag }),
      ...(d.serial_number !== undefined && { serialNumber: d.serial_number }),
      ...(d.category && { category: d.category }),
      ...(d.sub_category !== undefined && { subCategory: d.sub_category }),
      ...(d.brand !== undefined && { brand: d.brand }),
      ...(d.model !== undefined && { model: d.model }),
      ...(d.description !== undefined && { description: d.description }),
      ...(d.condition && { condition: d.condition }),
      ...(d.status && { status: d.status }),
      ...(d.location !== undefined && { location: d.location }),
      ...(d.purchase_date !== undefined && { purchaseDate: d.purchase_date ? new Date(d.purchase_date) : null }),
      ...(d.warranty_expiry !== undefined && { warrantyExpiry: d.warranty_expiry ? new Date(d.warranty_expiry) : null }),
      ...(d.notes !== undefined && { notes: d.notes }),
      updatedBy: req.user!.id,
      updatedAt: new Date(),
    }).where(and(eq(assets.id, id), isNull(assets.deletedAt))).returning();

    if (!asset) {
      res.status(404).json({ error_code: "NOT_FOUND", message: "Asset not found" });
      return;
    }
    res.json(mapAsset(asset, null));
  } catch (err) {
    next(err);
  }
});

// ─── POST /assets/:id/assign ───────────────────────────────────────────────────
router.post("/:id/assign", requireRole("admin", "manager"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const { employee_id, validity_date, purpose, notes } = req.body;

    if (!employee_id) {
      res.status(400).json({ error_code: "VALIDATION_ERROR", message: "employee_id is required" });
      return;
    }

    const [asset] = await db.select().from(assets).where(and(eq(assets.id, id), isNull(assets.deletedAt))).limit(1);
    if (!asset) {
      res.status(404).json({ error_code: "NOT_FOUND", message: "Asset not found" });
      return;
    }
    if (asset.status === "assigned") {
      res.status(409).json({ error_code: "ALREADY_ASSIGNED", message: "Asset is already assigned" });
      return;
    }

    const [employee] = await db.select().from(users).where(eq(users.id, Number(employee_id))).limit(1);
    if (!employee) {
      res.status(404).json({ error_code: "NOT_FOUND", message: "Employee not found" });
      return;
    }

    const assignmentCode = `ASGN-${Date.now()}`;
    const now = new Date();
    const nextAudit = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days

    const [assignment] = await db.insert(assetAssignments).values({
      assignmentCode,
      assetId: id,
      employeeId: Number(employee_id),
      assignedDate: now,
      validityDate: validity_date ? new Date(validity_date) : undefined,
      nextAuditDue: nextAudit,
      status: "active",
      purpose: purpose ?? null,
      notes: notes ?? null,
      assignedBy: req.user!.id,
    }).returning();

    await db.update(assets).set({ status: "assigned", updatedAt: new Date() }).where(eq(assets.id, id));

    await db.insert(activity).values({
      eventType: "asset_assigned",
      description: `Asset ${asset.assetTag} assigned to ${employee.fullName} by ${req.user!.name}`,
      actor: req.user!.email,
      entityType: "asset",
      entityId: id,
      ipAddress: req.ip,
    });

    res.status(201).json({ assignment_id: String(assignment.id), assignment_code: assignmentCode, message: "Asset assigned successfully" });
  } catch (err) {
    next(err);
  }
});

// ─── POST /assets/:id/return ───────────────────────────────────────────────────
router.post("/:id/return", requireRole("admin", "manager"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const { notes } = req.body;

    const [activeAssignment] = await db
      .select()
      .from(assetAssignments)
      .where(and(eq(assetAssignments.assetId, id), eq(assetAssignments.status, "active")))
      .limit(1);

    if (!activeAssignment) {
      res.status(404).json({ error_code: "NOT_FOUND", message: "No active assignment found for this asset" });
      return;
    }

    await db.update(assetAssignments).set({
      status: "returned",
      returnedDate: new Date(),
      returnedTo: req.user!.id,
      notes: notes ?? activeAssignment.notes,
      updatedAt: new Date(),
    }).where(eq(assetAssignments.id, activeAssignment.id));

    await db.update(assets).set({ status: "available", updatedAt: new Date() }).where(eq(assets.id, id));

    await db.insert(activity).values({
      eventType: "asset_returned",
      description: `Asset returned by ${req.user!.name}`,
      actor: req.user!.email,
      entityType: "asset",
      entityId: id,
      ipAddress: req.ip,
    });

    res.json({ message: "Asset returned successfully" });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /assets/:id ────────────────────────────────────────────────────────
router.delete("/:id", requireRole("admin"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    await db.update(assets).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(assets.id, id));
    res.json({ message: "Asset deleted" });
  } catch (err) {
    next(err);
  }
});

function mapAsset(r: typeof assets.$inferSelect, asgn: { employeeId: number; employeeName: string | null | undefined; employeeEmail: string | null | undefined; validityDate: Date | null | undefined; assignedDate: Date | null | undefined; nextAuditDue: Date | null | undefined; } | null) {
  return {
    id: String(r.id),
    asset_tag: r.assetTag,
    serial_number: r.serialNumber ?? null,
    stock_id: r.stockId ? String(r.stockId) : null,
    category: r.category,
    sub_category: r.subCategory ?? null,
    brand: r.brand ?? null,
    model: r.model ?? null,
    description: r.description ?? null,
    condition: r.condition,
    status: r.status,
    location: r.location ?? null,
    purchase_date: r.purchaseDate?.toISOString() ?? null,
    warranty_expiry: r.warrantyExpiry?.toISOString() ?? null,
    purchase_price: r.purchasePrice ?? null,
    invoice_number: r.invoiceNumber ?? null,
    notes: r.notes ?? null,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
    current_assignee: asgn ? {
      employee_id: String(asgn.employeeId),
      employee_name: asgn.employeeName ?? null,
      employee_email: asgn.employeeEmail ?? null,
      assigned_date: asgn.assignedDate?.toISOString() ?? null,
      validity_date: asgn.validityDate?.toISOString() ?? null,
      next_audit_due: asgn.nextAuditDue?.toISOString() ?? null,
    } : null,
  };
}

export default router;
