import { Request, Response, NextFunction } from "express";
import { verify } from "../lib/auth.js";
import { db } from "../db/index.js";
import { users } from "../db/schema/index.js";
import { eq } from "drizzle-orm";

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error_code: "MISSING_TOKEN",
      message: "Authorization token is required",
    });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verify(token);

  if (!payload) {
    res.status(401).json({
      error_code: "INVALID_TOKEN",
      message: "Token is invalid or has expired",
    });
    return;
  }

  try {
    // Check user is still active in DB
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        fullName: users.fullName,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, payload.id))
      .limit(1);

    if (!user) {
      res.status(401).json({
        error_code: "USER_NOT_FOUND",
        message: "User account not found",
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

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.fullName,
    };

    next();
  } catch (err) {
    next(err);
  }
}
