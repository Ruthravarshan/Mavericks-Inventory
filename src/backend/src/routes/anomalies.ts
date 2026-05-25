import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { anomalies, activity } from "../db/schema/index.js";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

// ─── GET /anomalies ───────────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const statusFilter = req.query.status as string | undefined;
    const severityFilter = req.query.severity as string | undefined;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (statusFilter) {
      conditions.push(
        eq(anomalies.status, statusFilter as "active" | "acknowledged" | "resolved")
      );
    }

    if (severityFilter) {
      conditions.push(
        eq(anomalies.severity, severityFilter as "info" | "warning" | "critical")
      );
    }

    const rows = await db
      .select()
      .from(anomalies)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(anomalies.detectedAt))
      .limit(limit)
      .offset(offset);

    res.json({ data: rows, pagination: { page, limit, total: rows.length } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /anomalies/:id/acknowledge ─────────────────────────────────────────

router.post(
  "/:id/acknowledge",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error_code: "INVALID_ID", message: "Invalid ID" });
        return;
      }

      const [anomaly] = await db
        .select()
        .from(anomalies)
        .where(eq(anomalies.id, id))
        .limit(1);

      if (!anomaly) {
        res.status(404).json({ error_code: "NOT_FOUND", message: "Anomaly not found" });
        return;
      }

      if (anomaly.status !== "active") {
        res.status(400).json({
          error_code: "INVALID_STATE",
          message: "Only active anomalies can be acknowledged",
        });
        return;
      }

      await db
        .update(anomalies)
        .set({
          status: "acknowledged",
          acknowledgedBy: req.user!.name,
          acknowledgedAt: new Date(),
        })
        .where(eq(anomalies.id, id));

      await db.insert(activity).values({
        eventType: "anomaly_acknowledged",
        description: `Anomaly ${id} (${anomaly.anomalyType}) acknowledged by ${req.user!.name}`,
        actor: req.user!.email,
        entityType: "anomaly",
        entityId: id,
        ipAddress: req.ip,
      });

      res.json({ message: "Anomaly acknowledged" });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /anomalies/:id/resolve ──────────────────────────────────────────────

router.post(
  "/:id/resolve",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error_code: "INVALID_ID", message: "Invalid ID" });
        return;
      }

      const schema = z.object({
        resolutionNotes: z.string().min(10),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error_code: "VALIDATION_ERROR",
          message: "Resolution notes must be at least 10 characters",
          details: parsed.error.flatten(),
        });
        return;
      }

      const [anomaly] = await db
        .select()
        .from(anomalies)
        .where(eq(anomalies.id, id))
        .limit(1);

      if (!anomaly) {
        res.status(404).json({ error_code: "NOT_FOUND", message: "Anomaly not found" });
        return;
      }

      if (anomaly.status === "resolved") {
        res.status(400).json({
          error_code: "ALREADY_RESOLVED",
          message: "Anomaly is already resolved",
        });
        return;
      }

      await db
        .update(anomalies)
        .set({
          status: "resolved",
          resolvedBy: req.user!.name,
          resolvedAt: new Date(),
          resolutionNotes: parsed.data.resolutionNotes,
        })
        .where(eq(anomalies.id, id));

      await db.insert(activity).values({
        eventType: "anomaly_resolved",
        description: `Anomaly ${id} (${anomaly.anomalyType}) resolved by ${req.user!.name}`,
        actor: req.user!.email,
        entityType: "anomaly",
        entityId: id,
        newValue: JSON.stringify({ resolutionNotes: parsed.data.resolutionNotes }),
        ipAddress: req.ip,
      });

      res.json({ message: "Anomaly resolved" });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /anomalies/:id/dismiss ──────────────────────────────────────────────

router.post(
  "/:id/dismiss",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error_code: "INVALID_ID", message: "Invalid ID" });
        return;
      }

      const [anomaly] = await db
        .select()
        .from(anomalies)
        .where(eq(anomalies.id, id))
        .limit(1);

      if (!anomaly) {
        res.status(404).json({ error_code: "NOT_FOUND", message: "Anomaly not found" });
        return;
      }

      await db
        .update(anomalies)
        .set({ dismissed: true })
        .where(eq(anomalies.id, id));

      await db.insert(activity).values({
        eventType: "anomaly_dismissed",
        description: `Anomaly ${id} dismissed by ${req.user!.name}`,
        actor: req.user!.email,
        entityType: "anomaly",
        entityId: id,
        ipAddress: req.ip,
      });

      res.json({ message: "Anomaly dismissed" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
