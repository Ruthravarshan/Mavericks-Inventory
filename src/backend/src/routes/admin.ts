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

const createUserSchema = z.object({
  employeeId: z.string().min(1),
  fullName: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["executive", "manager", "management_authority", "admin"]),
  department: z.string().optional(),
  location: z.string().optional(),
});

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
      status: dbStatus === "connected" ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      services: {
        database: { status: dbStatus, latencyMs: dbLatencyMs },
        azure_openai: {
          status: process.env.AZURE_OPENAI_ENDPOINT ? "configured" : "fallback_mode",
        },
        azure_blob: {
          status: process.env.AZURE_STORAGE_CONNECTION_STRING ? "configured" : "fallback_mode",
        },
        azure_search: {
          status: process.env.AZURE_SEARCH_ENDPOINT ? "configured" : "fallback_mode",
        },
      },
      stats: {
        totalStocks: Number(stockCount.count),
        activeUsers: Number(userCount.count),
        totalDistributions: Number(distCount.count),
        activeAnomalies: Number(anomalyCount.count),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /admin/users ─────────────────────────────────────────────────────────

router.get("/users", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const offset = (page - 1) * limit;

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
      .limit(limit)
      .offset(offset);

    res.json({ data: rows, pagination: { page, limit, total: rows.length } });
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

    const tempPassword = `Temp@${uuidv4().slice(0, 8)}!`;
    const passwordHash = await hashPassword(tempPassword);

    const [user] = await db
      .insert(users)
      .values({
        ...parsed.data,
        email: parsed.data.email.toLowerCase(),
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

    // In production, send email with temp password
    res.status(201).json({
      user,
      tempPassword, // Would be removed in production (email only)
      message: "User created. Share the temporary password securely.",
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

router.patch(
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

router.patch(
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
    res.json({
      config: {
        maxLoginAttempts: 5,
        lockDurationMinutes: 15,
        l2QtyThreshold: 50,
        l2RequiredCategories: ["Server"],
        anomalyDetectionIntervalMinutes: 15,
        azureOpenAI: {
          configured: !!process.env.AZURE_OPENAI_ENDPOINT,
          deployment: process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o",
        },
        azureBlob: {
          configured: !!process.env.AZURE_STORAGE_CONNECTION_STRING,
          container: process.env.AZURE_STORAGE_CONTAINER ?? "mavericks-uploads",
        },
        azureSearch: {
          configured: !!process.env.AZURE_SEARCH_ENDPOINT,
          index: process.env.AZURE_SEARCH_INDEX ?? "mavericks-stocks",
        },
      },
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
