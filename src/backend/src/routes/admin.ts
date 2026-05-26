import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { users, activity, stocks, distributions, anomalies } from "../db/schema/index.js";
import { eq, desc, sql, isNull } from "drizzle-orm";
import { pool } from "../db/index.js";
import { requireRole } from "../middleware/rbac.js";
import { hashPassword } from "../lib/auth.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// All admin routes require admin role
router.use(requireRole("admin"));

// Accept both camelCase and frontend's snake_case field names
const createUserSchema = z.object({
  employee_id: z.string().min(1).optional(),
  employeeId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  fullName: z.string().min(1).optional(),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  role: z.enum(["executive", "manager", "management_authority", "admin"]),
  department: z.string().optional(),
  location: z.string().optional(),
}).refine((d) => d.employee_id ?? d.employeeId, { message: "employee_id is required" })
  .refine((d) => d.name ?? d.fullName, { message: "name is required" });

// ─── GET /admin/system-health ─────────────────────────────────────────────────

router.get("/system-health", async (req: Request, res: Response, next: NextFunction) => {
  try {
    let dbStatus = "connected";
    let dbLatencyMs = 0;

    try {
      const t0 = Date.now();
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      dbLatencyMs = Date.now() - t0;
    } catch {
      dbStatus = "disconnected";
    }

    const [stockCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(stocks)
      .where(isNull(stocks.deletedAt));

    const [userCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .where(eq(users.isActive, true));

    const [distCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(distributions);

    const [anomalyCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(anomalies)
      .where(eq(anomalies.status, "active"));

    res.json({
      overall: dbStatus === "connected" ? "healthy" : "degraded",
      checked_at: new Date().toISOString(),
      services: [
        {
          name: "Database",
          status: dbStatus === "connected" ? "healthy" : "down",
          response_time_ms: dbLatencyMs,
          message: dbStatus === "connected" ? "Connected" : "Connection failed",
        },
        {
          name: "Azure OpenAI",
          status: process.env.AZURE_OPENAI_ENDPOINT ? "healthy" : "degraded",
          response_time_ms: 0,
          message: process.env.AZURE_OPENAI_ENDPOINT ? "Configured" : "Using fallback mode",
        },
        {
          name: "Azure Blob",
          status: process.env.AZURE_STORAGE_CONNECTION_STRING ? "healthy" : "degraded",
          response_time_ms: 0,
          message: process.env.AZURE_STORAGE_CONNECTION_STRING ? "Configured" : "Using fallback mode",
        },
        {
          name: "Azure Search",
          status: process.env.AZURE_SEARCH_ENDPOINT ? "healthy" : "degraded",
          response_time_ms: 0,
          message: process.env.AZURE_SEARCH_ENDPOINT ? "Configured" : "Using fallback mode",
        },
        {
          name: "API Server",
          status: "healthy",
          response_time_ms: 0,
          message: `${Number(stockCount.count)} stocks, ${Number(userCount.count)} users`,
        },
      ],
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /admin/users ─────────────────────────────────────────────────────────

router.get("/users", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const page_size = Math.min(100, Math.max(1, Number(req.query.page_size ?? 20)));
    const offset = (page - 1) * page_size;

    const [{ total }] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(users);

    const rows = await db
      .select({
        id: users.id,
        employeeId: users.employeeId,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        department: users.department,
        location: users.location,
        isActive: users.isActive,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(page_size)
      .offset(offset);

    // Map to match frontend User type (snake_case)
    const items = rows.map((u) => ({
      id: String(u.id),
      employee_id: u.employeeId,
      name: u.fullName,
      email: u.email,
      role: u.role,
      department: u.department ?? "",
      location: u.location ?? "",
      is_active: u.isActive,
      last_login: u.lastLoginAt?.toISOString() ?? null,
      created_at: u.createdAt.toISOString(),
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


// ─── POST /admin/users ────────────────────────────────────────────────────────

router.post("/users", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error_code: "VALIDATION_ERROR",
        message: "Invalid user data",
        details: parsed.error.flatten(),
      });
      return;
    }

    const employeeId = parsed.data.employee_id ?? parsed.data.employeeId ?? "";
    const fullName = parsed.data.name ?? parsed.data.fullName ?? "";
    const rawPassword = parsed.data.password ?? `Temp@${uuidv4().slice(0, 8)}!`;
    const passwordHash = await hashPassword(rawPassword);

    const [user] = await db
      .insert(users)
      .values({
        employeeId,
        fullName,
        email: parsed.data.email.toLowerCase(),
        role: parsed.data.role,
        department: parsed.data.department,
        location: parsed.data.location,
        passwordHash,
        isActive: true,
      })
      .returning({
        id: users.id,
        employeeId: users.employeeId,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        department: users.department,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    await db.insert(activity).values({
      eventType: "user_created",
      description: `User ${user.fullName} created by admin ${req.user!.name}`,
      actor: req.user!.email,
      entityType: "user",
      entityId: user.id,
      ipAddress: req.ip,
    });

    res.status(201).json({
      user: {
        id: String(user.id),
        employee_id: user.employeeId,
        name: user.fullName,
        email: user.email,
        role: user.role,
        department: user.department ?? "",
        is_active: user.isActive,
        created_at: user.createdAt.toISOString(),
      },
      tempPassword: parsed.data.password ? undefined : rawPassword,
      message: "User created successfully.",
    });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException & { code?: string }).code === "23505") {
      res.status(409).json({
        error_code: "DUPLICATE_USER",
        message: "A user with this email or employee ID already exists",
      });
      return;
    }
    next(err);
  }
});

// ─── PATCH /admin/users/:id/deactivate ───────────────────────────────────────

router.post(
  "/users/:id/deactivate",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error_code: "INVALID_ID", message: "Invalid user ID" });
        return;
      }

      if (id === req.user!.id) {
        res.status(400).json({
          error_code: "SELF_DEACTIVATION",
          message: "Cannot deactivate your own account",
        });
        return;
      }

      const [user] = await db
        .update(users)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning({ id: users.id, fullName: users.fullName });

      if (!user) {
        res.status(404).json({ error_code: "NOT_FOUND", message: "User not found" });
        return;
      }

      await db.insert(activity).values({
        eventType: "user_deactivated",
        description: `User ${user.fullName} deactivated by ${req.user!.name}`,
        actor: req.user!.email,
        entityType: "user",
        entityId: id,
        ipAddress: req.ip,
      });

      res.json({ message: "User deactivated" });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /admin/users/:id/activate ─────────────────────────────────────────

router.post(
  "/users/:id/activate",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error_code: "INVALID_ID", message: "Invalid user ID" });
        return;
      }

      const [user] = await db
        .update(users)
        .set({
          isActive: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning({ id: users.id, fullName: users.fullName });

      if (!user) {
        res.status(404).json({ error_code: "NOT_FOUND", message: "User not found" });
        return;
      }

      await db.insert(activity).values({
        eventType: "user_activated",
        description: `User ${user.fullName} activated by ${req.user!.name}`,
        actor: req.user!.email,
        entityType: "user",
        entityId: id,
        ipAddress: req.ip,
      });

      res.json({ message: "User activated" });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /admin/config ────────────────────────────────────────────────────────

router.get("/config", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Return shape matching SystemConfig type
    res.json({
      l2_qty_threshold: 50,
      l2_always_categories: ["Server"],
      l1_sla_hours: 24,
      l2_sla_hours: 48,
      anomaly_sensitivity: "Medium",
      session_timeout_minutes: 480,
    });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /admin/config ────────────────────────────────────────────────────────

router.put("/config", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Config is static in this deployment — acknowledge the update and return merged config
    const defaults = {
      l2_qty_threshold: 50,
      l2_always_categories: ["Server"],
      l1_sla_hours: 24,
      l2_sla_hours: 48,
      anomaly_sensitivity: "Medium",
      session_timeout_minutes: 480,
    };
    const updated = { ...defaults, ...req.body };
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── GET /admin/system-stats ──────────────────────────────────────────────────

router.get("/system-stats", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [userStats] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        active: sql<number>`COUNT(*) FILTER (WHERE is_active = true)`,
        loginsToday: sql<number>`COUNT(*) FILTER (WHERE DATE(last_login_at) = CURRENT_DATE)`,
      })
      .from(users);

    const [stockCount] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(stocks)
      .where(isNull(stocks.deletedAt));

    const [distCount] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(distributions);

    const [anomalyCount] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(anomalies)
      .where(eq(anomalies.status, "active"));

    const [pendingCount] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(distributions)
      .where(sql`status IN ('submitted','l1_pending','l2_pending')`);

    // Distributions pending over 48 hours
    const pendingOver48h = await db
      .select({
        transaction_code: distributions.transactionCode,
        stock_name: sql<string>`s.stock_name`,
        hours_pending: sql<number>`EXTRACT(EPOCH FROM (NOW() - distributions.submitted_at)) / 3600`,
        risk_level: distributions.aiRiskScore,
        submitted_by: sql<string>`u.full_name`,
      })
      .from(sql`distributions JOIN stocks s ON distributions.stock_id = s.id JOIN users u ON distributions.created_by = u.id`)
      .where(sql`distributions.submitted_at IS NOT NULL AND distributions.status IN ('submitted','l1_pending','l2_pending') AND distributions.submitted_at < NOW() - INTERVAL '48 hours'`)
      .limit(10);

    // Top distributed items
    const topDist = await db
      .select({
        stock_name: sql<string>`s.stock_name`,
        total_qty: sql<number>`SUM(d.qty_requested)`,
      })
      .from(sql`distributions d JOIN stocks s ON d.stock_id = s.id`)
      .groupBy(sql`s.stock_name`)
      .orderBy(sql`SUM(d.qty_requested) DESC`)
      .limit(10);

    res.json({
      total_users: Number(userStats.total),
      active_users: Number(userStats.active),
      logins_today: Number(userStats.loginsToday),
      total_stocks: Number(stockCount.total),
      total_distributions: Number(distCount.total),
      total_anomalies: Number(anomalyCount.total),
      pending_approvals: Number(pendingCount.total),
      pending_over_48h: pendingOver48h.map((r) => ({
        transaction_code: r.transaction_code,
        stock_name: r.stock_name,
        hours_pending: Math.round(Number(r.hours_pending)),
        risk_level: r.risk_level ?? "Unknown",
        submitted_by: r.submitted_by,
      })),
      top_distributed: topDist.map((r) => ({
        stock_name: r.stock_name,
        total_qty: Number(r.total_qty),
      })),
    });
  } catch (err) {
    next(err);
  }
});


// ─── GET /admin/categories ────────────────────────────────────────────────────

router.get("/categories", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await db
      .selectDistinct({ category: stocks.category })
      .from(stocks)
      .where(isNull(stocks.deletedAt))
      .orderBy(stocks.category);

    res.json({ data: rows.map((r) => r.category) });
  } catch (err) {
    next(err);
  }
});

// ─── GET /admin/uom ───────────────────────────────────────────────────────────

router.get("/uom", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await db
      .selectDistinct({ uom: stocks.unitOfMeasure })
      .from(stocks)
      .orderBy(stocks.unitOfMeasure);

    // Provide defaults + DB values
    const defaults = ["Units", "Pieces", "Boxes", "Kg", "Litres", "Metres", "Rolls", "Sets"];
    const dbValues = rows.map((r) => r.uom);
    const combined = [...new Set([...defaults, ...dbValues])].sort();

    res.json({ data: combined });
  } catch (err) {
    next(err);
  }
});

export default router;
