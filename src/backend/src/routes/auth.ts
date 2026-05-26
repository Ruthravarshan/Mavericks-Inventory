import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { users, activity } from "../db/schema/index.js";
import { eq, sql } from "drizzle-orm";
import {
  sign,
  signRefresh,
  verify,
  hashPassword,
  comparePassword,
} from "../lib/auth.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────

router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error_code: "VALIDATION_ERROR",
        message: "Invalid request body",
        details: parsed.error.flatten(),
      });
      return;
    }

    const { email, password } = parsed.data;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      res.status(401).json({
        error_code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        error_code: "ACCOUNT_DISABLED",
        message: "Your account has been disabled",
      });
      return;
    }

    // Check lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000
      );
      res.status(429).json({
        error_code: "ACCOUNT_LOCKED",
        message: `Account is locked. Try again in ${minutesLeft} minutes.`,
      });
      return;
    }

    const passwordMatch = await comparePassword(password, user.passwordHash);

    if (!passwordMatch) {
      const newAttempts = user.failedLoginAttempts + 1;
      const shouldLock = newAttempts >= 5;
      const lockUntil = shouldLock
        ? new Date(Date.now() + 15 * 60 * 1000)
        : null;

      await db
        .update(users)
        .set({
          failedLoginAttempts: newAttempts,
          lockedUntil: lockUntil,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      if (shouldLock) {
        res.status(429).json({
          error_code: "ACCOUNT_LOCKED",
          message: "Too many failed attempts. Account locked for 15 minutes.",
        });
        return;
      }

      res.status(401).json({
        error_code: "INVALID_CREDENTIALS",
        message: `Invalid email or password. ${5 - newAttempts} attempts remaining.`,
      });
      return;
    }

    // Reset failed attempts, update last login
    await db
      .update(users)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.fullName,
    };

    const accessToken = sign(tokenPayload);
    const refreshToken = signRefresh(tokenPayload);

    // Log activity
    await db.insert(activity).values({
      eventType: "user_login",
      description: `User ${user.fullName} logged in`,
      actor: user.email,
      entityType: "user",
      entityId: user.id,
      ipAddress: req.ip ?? req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
    });

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    });

    const { passwordHash: _ph, ...rawUser } = user;

    // Map to frontend User type (snake_case)
    const safeUser = {
      id: String(rawUser.id),
      employee_id: rawUser.employeeId,
      name: rawUser.fullName,
      email: rawUser.email,
      role: rawUser.role,
      department: rawUser.department ?? "",
      location: rawUser.location ?? "",
      is_active: rawUser.isActive,
      last_login: rawUser.lastLoginAt?.toISOString() ?? null,
      created_at: rawUser.createdAt.toISOString(),
    };

    res.json({
      accessToken,
      refreshToken,
      user: safeUser,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────

router.post("/logout", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user) {
      await db.insert(activity).values({
        eventType: "user_logout",
        description: `User ${req.user.name} logged out`,
        actor: req.user.email,
        entityType: "user",
        entityId: req.user.id,
        ipAddress: req.ip ?? req.socket.remoteAddress,
        userAgent: req.headers["user-agent"],
      });
    }

    res.clearCookie("refresh_token");
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/refresh ───────────────────────────────────────────────────────

router.post("/refresh", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken =
      req.cookies?.refresh_token ??
      req.body?.refreshToken;

    if (!refreshToken) {
      res.status(401).json({
        error_code: "MISSING_REFRESH_TOKEN",
        message: "Refresh token is required",
      });
      return;
    }

    const payload = verify(refreshToken);
    if (!payload) {
      res.status(401).json({
        error_code: "INVALID_REFRESH_TOKEN",
        message: "Refresh token is invalid or expired",
      });
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.id))
      .limit(1);

    if (!user || !user.isActive) {
      res.status(403).json({
        error_code: "ACCOUNT_DISABLED",
        message: "Account is disabled",
      });
      return;
    }

    const newAccessToken = sign({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.fullName,
    });

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    next(err);
  }
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

router.get("/me", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [user] = await db
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
      .where(eq(users.id, req.user!.id))
      .limit(1);

    if (!user) {
      res.status(404).json({
        error_code: "USER_NOT_FOUND",
        message: "User not found",
      });
      return;
    }

    // Map to frontend User type (snake_case)
    res.json({
      id: String(user.id),
      employee_id: user.employeeId,
      name: user.fullName,
      email: user.email,
      role: user.role,
      department: user.department ?? "",
      location: user.location ?? "",
      is_active: user.isActive,
      last_login: user.lastLoginAt?.toISOString() ?? null,
      created_at: user.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/change-password ───────────────────────────────────────────────

router.post(
  "/change-password",
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error_code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: parsed.error.flatten(),
        });
        return;
      }

      const { oldPassword, newPassword } = parsed.data;

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.user!.id))
        .limit(1);

      if (!user) {
        res.status(404).json({
          error_code: "USER_NOT_FOUND",
          message: "User not found",
        });
        return;
      }

      const matches = await comparePassword(oldPassword, user.passwordHash);
      if (!matches) {
        res.status(400).json({
          error_code: "WRONG_PASSWORD",
          message: "Current password is incorrect",
        });
        return;
      }

      const newHash = await hashPassword(newPassword);

      await db
        .update(users)
        .set({ passwordHash: newHash, updatedAt: new Date() })
        .where(eq(users.id, user.id));

      await db.insert(activity).values({
        eventType: "password_changed",
        description: `User ${user.fullName} changed their password`,
        actor: user.email,
        entityType: "user",
        entityId: user.id,
        ipAddress: req.ip ?? req.socket.remoteAddress,
      });

      res.json({ message: "Password changed successfully" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
