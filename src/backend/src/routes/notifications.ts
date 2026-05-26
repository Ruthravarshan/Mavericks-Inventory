import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db/index.js";
import { notifications } from "../db/schema/index.js";
import { eq, and, desc } from "drizzle-orm";

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

    res.json(
      rows.map((n) => ({
        id: String(n.id),
        type: n.type,
        title: n.title,
        message: n.message,
        link: null,
        is_read: n.isRead,
        created_at: n.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    next(err);
  }
});

// ─── POST /notifications/mark-all-read ───────────────────────────────────────

router.post("/mark-all-read", async (req: Request, res: Response, next: NextFunction) => {
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
