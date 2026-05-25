import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { notifications } from "../db/schema/index.js";
import { eq, and, inArray, desc } from "drizzle-orm";

const router = Router();

// ─── GET /notifications ───────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.user!.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    const unreadCount = rows.filter((n) => !n.isRead).length;

    res.json({ data: rows, unreadCount });
  } catch (err) {
    next(err);
  }
});

// ─── POST /notifications/mark-read ───────────────────────────────────────────

router.post("/mark-read", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      ids: z.array(z.number().int().positive()),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error_code: "VALIDATION_ERROR",
        message: "ids must be an array of integers",
      });
      return;
    }

    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          inArray(notifications.id, parsed.data.ids),
          eq(notifications.userId, req.user!.id)
        )
      );

    res.json({ message: "Notifications marked as read" });
  } catch (err) {
    next(err);
  }
});

// ─── POST /notifications/read-all ────────────────────────────────────────────

router.post("/read-all", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, req.user!.id),
          eq(notifications.isRead, false)
        )
      );

    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    next(err);
  }
});

export default router;
