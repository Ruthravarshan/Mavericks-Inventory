import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import {
  approvals,
  distributions,
  stocks,
  stockLedger,
  activity,
  notifications,
  users,
} from "../db/schema/index.js";
import { eq, and, inArray, sql } from "drizzle-orm";
import { requireRole } from "../middleware/rbac.js";

const router = Router();

const L2_REQUIRED_CATEGORIES = ["Server"];
const L2_REQUIRED_QTY_THRESHOLD = 50;

function requiresL2(qty: number, category: string): boolean {
  return qty > L2_REQUIRED_QTY_THRESHOLD || L2_REQUIRED_CATEGORIES.includes(category);
}

async function getStockForDistribution(stockId: number) {
  const [stock] = await db
    .select()
    .from(stocks)
    .where(eq(stocks.id, stockId))
    .limit(1);
  return stock;
}

async function notifySubmitter(
  distributionId: number,
  type: string,
  title: string,
  message: string
) {
  const [dist] = await db
    .select({ createdBy: distributions.createdBy, transactionCode: distributions.transactionCode })
    .from(distributions)
    .where(eq(distributions.id, distributionId))
    .limit(1);

  if (dist) {
    await db.insert(notifications).values({
      userId: dist.createdBy,
      type,
      title,
      message,
      relatedEntityType: "distribution",
      relatedEntityId: distributionId,
    });
  }
}

// ─── GET /approvals ───────────────────────────────────────────────────────────

router.get(
  "/",
  requireRole("manager", "management_authority", "admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const statusFilter = req.query.status as string | undefined;
      const levelFilter = req.query.level as string | undefined;
      const riskFilter = req.query.risk_level as string | undefined;
      const page = Math.max(1, Number(req.query.page ?? 1));
      const page_size = Math.min(100, Math.max(1, Number(req.query.page_size ?? 20)));
      const offset = (page - 1) * page_size;

      const conditions = [];

      // Map level filter to approval status
      if (levelFilter === "l1") {
        conditions.push(eq(approvals.status, "pending"));
      } else if (levelFilter === "l2") {
        conditions.push(eq(approvals.status, "l1_approved"));
      } else if (statusFilter) {
        // Map frontend status strings to DB enum values
        const statusMap: Record<string, "pending" | "l1_approved" | "approved" | "rejected"> = {
          "pending": "pending",
          "l1_pending": "pending",
          "l2_pending": "l1_approved",
          "approved": "approved",
          "rejected": "rejected",
        };
        const dbStatus = statusMap[statusFilter];
        if (dbStatus) conditions.push(eq(approvals.status, dbStatus));
      }

      if (riskFilter) {
        conditions.push(sql`LOWER(ai_risk_level) = LOWER(${riskFilter})`);
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [{ total }] = await db
        .select({ total: sql<number>`COUNT(*)` })
        .from(approvals)
        .where(whereClause);

      const rows = await db
        .select({
          id: approvals.id,
          distributionId: approvals.distributionId,
          status: approvals.status,
          aiRecommendation: approvals.aiRecommendation,
          aiRiskScore: approvals.aiRiskScore,
          aiRiskLevel: approvals.aiRiskLevel,
          aiReasoning: approvals.aiReasoning,
          requiresL2: approvals.requiresL2,
          l2Status: approvals.l2Status,
          approvedBy: approvals.approvedBy,
          approvedAt: approvals.approvedAt,
          remarks: approvals.remarks,
          l2ApprovedBy: approvals.l2ApprovedBy,
          l2ApprovedAt: approvals.l2ApprovedAt,
          l2Remarks: approvals.l2Remarks,
          createdAt: approvals.createdAt,
          updatedAt: approvals.updatedAt,
          // Distribution fields via JOIN
          transactionCode: distributions.transactionCode,
          qtyRequested: distributions.qtyRequested,
          recipientName: distributions.recipientName,
          recipientType: distributions.recipientType,
          purpose: distributions.purpose,
          location: distributions.location,
          distributionDate: distributions.distributionDate,
          submittedAt: distributions.submittedAt,
          stockId: distributions.stockId,
          createdBy: distributions.createdBy,
        })
        .from(approvals)
        .leftJoin(distributions, eq(approvals.distributionId, distributions.id))
        .where(whereClause)
        .orderBy(sql`${approvals.createdAt} DESC`)
        .limit(page_size)
        .offset(offset);

      // Get stock details (name, code, uom)
      const stockIds = [...new Set(rows.map((r) => r.stockId).filter(Boolean))];
      let stockMap: Record<number, { name: string; code: string; uom: string }> = {};
      if (stockIds.length > 0) {
        const stockRows = await db
          .select({ id: stocks.id, stockName: stocks.stockName, stockCode: stocks.stockCode, unitOfMeasure: stocks.unitOfMeasure })
          .from(stocks)
          .where(inArray(stocks.id, stockIds as number[]));
        stockMap = Object.fromEntries(stockRows.map((s) => [s.id, { name: s.stockName, code: s.stockCode, uom: s.unitOfMeasure }]));
      }

      // Get creator names via distributions.createdBy
      const creatorIds = [...new Set(rows.map((r) => r.createdBy).filter((id): id is number => id != null))];
      let userNameMap: Record<number, string> = {};
      if (creatorIds.length > 0) {
        const userRows = await db.select({ id: users.id, name: users.fullName }).from(users).where(inArray(users.id, creatorIds));
        userNameMap = Object.fromEntries(userRows.map((u) => [u.id, u.name]));
      }

      const items = rows.map((r) => {
        const createdBy = r.createdBy;
        return {
          id: String(r.id),
          distribution_id: String(r.distributionId),
          transaction_code: r.transactionCode ?? "",
          stock_name: r.stockId ? (stockMap[r.stockId]?.name ?? "") : "",
          stock_code: r.stockId ? (stockMap[r.stockId]?.code ?? "") : "",
          qty_requested: r.qtyRequested ?? 0,
          uom: r.stockId ? (stockMap[r.stockId]?.uom ?? "") : "",
          recipient_name: r.recipientName ?? "",
          recipient_type: r.recipientType ?? "",
          purpose: r.purpose ?? "",
          location: r.location ?? "",
          distribution_date: r.distributionDate ?? "",
          status: r.status,
          risk_score: Number(r.aiRiskScore ?? 0),
          risk_level: (r.aiRiskLevel ?? "Low") as "Low" | "Medium" | "High",
          ai_recommendation: (r.aiRecommendation || "Review") as "Approve" | "Review" | "Reject",
          ai_reasoning: r.aiReasoning ?? "",
          submitted_at: r.submittedAt?.toISOString() ?? "",
          days_pending: r.submittedAt
            ? Math.floor((Date.now() - r.submittedAt.getTime()) / 86400000)
            : 0,
          l1_approved_by: r.approvedBy ? String(r.approvedBy) : null,
          l1_approved_at: r.approvedAt?.toISOString() ?? null,
          l1_remarks: r.remarks ?? null,
          l2_approved_by: r.l2ApprovedBy ? String(r.l2ApprovedBy) : null,
          l2_approved_at: r.l2ApprovedAt?.toISOString() ?? null,
          l2_remarks: r.l2Remarks ?? null,
          created_by_name: createdBy ? (userNameMap[createdBy] ?? "") : "",
        };
      });

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
  }
);


// ─── GET /approvals/:id ───────────────────────────────────────────────────────

router.get(
  "/:id",
  requireRole("manager", "management_authority", "admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error_code: "INVALID_ID", message: "Invalid approval ID" });
        return;
      }

      const [approval] = await db
        .select()
        .from(approvals)
        .where(eq(approvals.id, id))
        .limit(1);

      if (!approval) {
        res.status(404).json({ error_code: "NOT_FOUND", message: "Approval not found" });
        return;
      }

      const [dist] = await db
        .select()
        .from(distributions)
        .where(eq(distributions.id, approval.distributionId))
        .limit(1);

      const stock = dist ? await getStockForDistribution(dist.stockId) : null;

      res.json({ ...approval, distribution: dist, stock });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /approvals/:id/approve (L1) ────────────────────────────────────────

router.post(
  "/:id/l1-approve",
  requireRole("manager", "admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error_code: "INVALID_ID", message: "Invalid ID" });
        return;
      }

      const remarks = (req.body.remarks as string) ?? "";

      const [approval] = await db
        .select()
        .from(approvals)
        .where(eq(approvals.id, id))
        .limit(1);

      if (!approval) {
        res.status(404).json({ error_code: "NOT_FOUND", message: "Approval not found" });
        return;
      }

      if (approval.status !== "pending") {
        res.status(400).json({
          error_code: "ALREADY_PROCESSED",
          message: "This approval has already been processed",
        });
        return;
      }

      const [dist] = await db
        .select()
        .from(distributions)
        .where(eq(distributions.id, approval.distributionId))
        .limit(1);

      if (!dist) {
        res.status(404).json({ error_code: "DISTRIBUTION_NOT_FOUND", message: "Distribution not found" });
        return;
      }

      const stock = await getStockForDistribution(dist.stockId);
      if (!stock) {
        res.status(404).json({ error_code: "STOCK_NOT_FOUND", message: "Stock not found" });
        return;
      }

      const needsL2 = requiresL2(dist.qtyRequested, stock.category);

      if (needsL2) {
        // L1 approved, escalate to L2
        await db.update(approvals).set({
          status: "l1_approved",
          remarks,
          approvedBy: req.user!.id,
          approvedAt: new Date(),
          requiresL2: true,
          updatedAt: new Date(),
        }).where(eq(approvals.id, id));

        await db.update(distributions).set({
          status: "l2_pending",
          updatedAt: new Date(),
        }).where(eq(distributions.id, dist.id));

        // Notify L2 authorities
        const l2Users = await db.select({ id: users.id }).from(users).where(
          and(eq(users.isActive, true), sql`role IN ('management_authority', 'admin')`)
        );

        if (l2Users.length > 0) {
          await db.insert(notifications).values(
            l2Users.map((u) => ({
              userId: u.id,
              type: "l2_approval_required",
              title: "L2 Approval Required",
              message: `Distribution ${dist.transactionCode} has been L1 approved and requires L2 sign-off.`,
              relatedEntityType: "approval",
              relatedEntityId: id,
            }))
          );
        }

        await db.insert(activity).values({
          eventType: "approval_l1_approved",
          description: `Approval ${id} (dist: ${dist.transactionCode}) L1 approved, escalated to L2`,
          actor: req.user!.email,
          entityType: "approval",
          entityId: id,
          ipAddress: req.ip,
        });

        res.json({ message: "L1 approved, escalated to L2", requiresL2: true });
        return;
      }

      // Full approval — deduct stock
      const newAvailable = stock.availableQuantity - dist.qtyRequested;
      const newReserved = Math.max(0, stock.reservedQuantity - dist.qtyRequested);

      await db.update(stocks).set({
        availableQuantity: newAvailable,
        reservedQuantity: newReserved,
        healthScore: calcHealthScore(newAvailable, stock.minStockLevel),
        updatedAt: new Date(),
      }).where(eq(stocks.id, stock.id));

      // Ledger OUT entry
      await db.insert(stockLedger).values({
        stockId: stock.id,
        movementType: "out",
        quantity: dist.qtyRequested,
        runningBalance: newAvailable,
        distributionId: dist.id,
        performedBy: req.user!.name,
        performedAt: new Date(),
        source: "distribution_approval",
        remarks: `Approved by ${req.user!.name}. Distribution: ${dist.transactionCode}`,
      });

      await db.update(approvals).set({
        status: "approved",
        remarks,
        approvedBy: req.user!.id,
        approvedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(approvals.id, id));

      await db.update(distributions).set({
        status: "approved",
        updatedAt: new Date(),
      }).where(eq(distributions.id, dist.id));

      await notifySubmitter(dist.id, "distribution_approved", "Distribution Approved", `Your distribution ${dist.transactionCode} has been approved.`);

      await db.insert(activity).values({
        eventType: "distribution_approved",
        description: `Distribution ${dist.transactionCode} approved by ${req.user!.name}`,
        actor: req.user!.email,
        entityType: "distribution",
        entityId: dist.id,
        ipAddress: req.ip,
      });

      res.json({ message: "Distribution approved successfully" });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /approvals/:id/reject ───────────────────────────────────────────────

router.post(
  "/:id/l1-reject",
  requireRole("manager", "admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error_code: "INVALID_ID", message: "Invalid ID" });
        return;
      }

      const remarks = (req.body.remarks as string) ?? "";

      if (remarks.length < 20) {
        res.status(400).json({
          error_code: "REMARKS_TOO_SHORT",
          message: "Rejection remarks must be at least 20 characters",
        });
        return;
      }

      const [approval] = await db
        .select()
        .from(approvals)
        .where(eq(approvals.id, id))
        .limit(1);

      if (!approval) {
        res.status(404).json({ error_code: "NOT_FOUND", message: "Approval not found" });
        return;
      }

      if (approval.status !== "pending") {
        res.status(400).json({
          error_code: "ALREADY_PROCESSED",
          message: "This approval has already been processed",
        });
        return;
      }

      const [dist] = await db
        .select()
        .from(distributions)
        .where(eq(distributions.id, approval.distributionId))
        .limit(1);

      if (!dist) {
        res.status(404).json({ error_code: "DISTRIBUTION_NOT_FOUND", message: "Distribution not found" });
        return;
      }

      // Release reserved quantity
      const [stock] = await db.select().from(stocks).where(eq(stocks.id, dist.stockId)).limit(1);
      if (stock) {
        await db.update(stocks).set({
          reservedQuantity: Math.max(0, stock.reservedQuantity - dist.qtyRequested),
          updatedAt: new Date(),
        }).where(eq(stocks.id, stock.id));
      }

      await db.update(approvals).set({
        status: "rejected",
        remarks,
        approvedBy: req.user!.id,
        approvedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(approvals.id, id));

      await db.update(distributions).set({
        status: "rejected",
        updatedAt: new Date(),
      }).where(eq(distributions.id, dist.id));

      await notifySubmitter(dist.id, "distribution_rejected", "Distribution Rejected", `Your distribution ${dist.transactionCode} was rejected. Reason: ${remarks}`);

      await db.insert(activity).values({
        eventType: "distribution_rejected",
        description: `Distribution ${dist.transactionCode} rejected by ${req.user!.name}`,
        actor: req.user!.email,
        entityType: "distribution",
        entityId: dist.id,
        newValue: JSON.stringify({ remarks }),
        ipAddress: req.ip,
      });

      res.json({ message: "Distribution rejected" });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /approvals/:id/l2-approve ──────────────────────────────────────────

router.post(
  "/:id/l2-approve",
  requireRole("management_authority", "admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error_code: "INVALID_ID", message: "Invalid ID" });
        return;
      }

      const remarks = (req.body.remarks as string) ?? "";

      const [approval] = await db
        .select()
        .from(approvals)
        .where(eq(approvals.id, id))
        .limit(1);

      if (!approval) {
        res.status(404).json({ error_code: "NOT_FOUND", message: "Approval not found" });
        return;
      }

      if (!approval.requiresL2) {
        res.status(400).json({
          error_code: "L2_NOT_REQUIRED",
          message: "L2 approval is not required for this distribution",
        });
        return;
      }

      if (approval.status !== "l1_approved") {
        res.status(400).json({
          error_code: "NOT_L1_APPROVED",
          message: "Distribution must be L1 approved before L2 approval",
        });
        return;
      }

      const [dist] = await db
        .select()
        .from(distributions)
        .where(eq(distributions.id, approval.distributionId))
        .limit(1);

      if (!dist) {
        res.status(404).json({ error_code: "DISTRIBUTION_NOT_FOUND", message: "Distribution not found" });
        return;
      }

      const stock = await getStockForDistribution(dist.stockId);
      if (!stock) {
        res.status(404).json({ error_code: "STOCK_NOT_FOUND", message: "Stock not found" });
        return;
      }

      const newAvailable = stock.availableQuantity - dist.qtyRequested;
      const newReserved = Math.max(0, stock.reservedQuantity - dist.qtyRequested);

      await db.update(stocks).set({
        availableQuantity: newAvailable,
        reservedQuantity: newReserved,
        healthScore: calcHealthScore(newAvailable, stock.minStockLevel),
        updatedAt: new Date(),
      }).where(eq(stocks.id, stock.id));

      await db.insert(stockLedger).values({
        stockId: stock.id,
        movementType: "out",
        quantity: dist.qtyRequested,
        runningBalance: newAvailable,
        distributionId: dist.id,
        performedBy: req.user!.name,
        performedAt: new Date(),
        source: "l2_approval",
        remarks: `L2 approved by ${req.user!.name}. Distribution: ${dist.transactionCode}`,
      });

      await db.update(approvals).set({
        status: "approved",
        l2Status: "approved",
        l2ApprovedBy: req.user!.id,
        l2ApprovedAt: new Date(),
        l2Remarks: remarks,
        updatedAt: new Date(),
      }).where(eq(approvals.id, id));

      await db.update(distributions).set({
        status: "approved",
        updatedAt: new Date(),
      }).where(eq(distributions.id, dist.id));

      await notifySubmitter(dist.id, "distribution_approved", "Distribution L2 Approved", `Your distribution ${dist.transactionCode} has been fully approved (L2).`);

      await db.insert(activity).values({
        eventType: "distribution_l2_approved",
        description: `Distribution ${dist.transactionCode} L2 approved by ${req.user!.name}`,
        actor: req.user!.email,
        entityType: "distribution",
        entityId: dist.id,
        ipAddress: req.ip,
      });

      res.json({ message: "L2 approval granted" });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /approvals/:id/l2-reject ────────────────────────────────────────────

router.post(
  "/:id/l2-reject",
  requireRole("management_authority", "admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error_code: "INVALID_ID", message: "Invalid ID" });
        return;
      }

      const remarks = (req.body.remarks as string) ?? "";

      if (remarks.length < 10) {
        res.status(400).json({
          error_code: "REMARKS_TOO_SHORT",
          message: "L2 rejection remarks must be at least 10 characters",
        });
        return;
      }

      const [approval] = await db
        .select()
        .from(approvals)
        .where(eq(approvals.id, id))
        .limit(1);

      if (!approval) {
        res.status(404).json({ error_code: "NOT_FOUND", message: "Approval not found" });
        return;
      }

      if (approval.status !== "l1_approved") {
        res.status(400).json({
          error_code: "INVALID_STATE",
          message: "L2 rejection only possible on l1_approved distributions",
        });
        return;
      }

      const [dist] = await db
        .select()
        .from(distributions)
        .where(eq(distributions.id, approval.distributionId))
        .limit(1);

      if (!dist) {
        res.status(404).json({ error_code: "DISTRIBUTION_NOT_FOUND", message: "Distribution not found" });
        return;
      }

      const stock = await getStockForDistribution(dist.stockId);
      if (stock) {
        await db.update(stocks).set({
          reservedQuantity: Math.max(0, stock.reservedQuantity - dist.qtyRequested),
          updatedAt: new Date(),
        }).where(eq(stocks.id, stock.id));
      }

      await db.update(approvals).set({
        status: "rejected",
        l2Status: "rejected",
        l2ApprovedBy: req.user!.id,
        l2ApprovedAt: new Date(),
        l2Remarks: remarks,
        updatedAt: new Date(),
      }).where(eq(approvals.id, id));

      await db.update(distributions).set({
        status: "rejected",
        updatedAt: new Date(),
      }).where(eq(distributions.id, dist.id));

      await notifySubmitter(dist.id, "distribution_rejected", "Distribution L2 Rejected", `Your distribution ${dist.transactionCode} was rejected at L2. Reason: ${remarks}`);

      await db.insert(activity).values({
        eventType: "distribution_l2_rejected",
        description: `Distribution ${dist.transactionCode} L2 rejected by ${req.user!.name}`,
        actor: req.user!.email,
        entityType: "distribution",
        entityId: dist.id,
        newValue: JSON.stringify({ remarks }),
        ipAddress: req.ip,
      });

      res.json({ message: "L2 rejection applied" });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /approvals/bulk-approve ─────────────────────────────────────────────

router.post(
  "/bulk-approve",
  requireRole("manager", "admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idsSchema = z.object({ ids: z.array(z.coerce.number().int().positive()) });
      const parsed = idsSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          error_code: "VALIDATION_ERROR",
          message: "ids must be an array of integers",
        });
        return;
      }

      const { ids: approvalIds } = parsed.data;

      const approvalsToProcess = await db
        .select()
        .from(approvals)
        .where(
          and(
            inArray(approvals.id, approvalIds),
            eq(approvals.status, "pending")
          )
        );

      const processed: number[] = [];
      const skipped: number[] = [];

      for (const approval of approvalsToProcess) {
        // Only bulk-approve low-risk
        if (
          approval.aiRiskLevel !== "Low" &&
          approval.aiRiskLevel !== "low"
        ) {
          skipped.push(approval.id);
          continue;
        }

        const [dist] = await db
          .select()
          .from(distributions)
          .where(eq(distributions.id, approval.distributionId))
          .limit(1);

        if (!dist) {
          skipped.push(approval.id);
          continue;
        }

        const stock = await getStockForDistribution(dist.stockId);
        if (!stock) {
          skipped.push(approval.id);
          continue;
        }

        const newAvailable = stock.availableQuantity - dist.qtyRequested;
        const newReserved = Math.max(0, stock.reservedQuantity - dist.qtyRequested);

        await db.update(stocks).set({
          availableQuantity: newAvailable,
          reservedQuantity: newReserved,
          healthScore: calcHealthScore(newAvailable, stock.minStockLevel),
          updatedAt: new Date(),
        }).where(eq(stocks.id, stock.id));

        await db.insert(stockLedger).values({
          stockId: stock.id,
          movementType: "out",
          quantity: dist.qtyRequested,
          runningBalance: newAvailable,
          distributionId: dist.id,
          performedBy: req.user!.name,
          performedAt: new Date(),
          source: "bulk_approval",
          remarks: `Bulk approved by ${req.user!.name}`,
        });

        await db.update(approvals).set({
          status: "approved",
          approvedBy: req.user!.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(approvals.id, approval.id));

        await db.update(distributions).set({
          status: "approved",
          updatedAt: new Date(),
        }).where(eq(distributions.id, dist.id));

        await notifySubmitter(dist.id, "distribution_approved", "Distribution Approved (Bulk)", `Distribution ${dist.transactionCode} was bulk approved.`);

        processed.push(approval.id);
      }

      await db.insert(activity).values({
        eventType: "bulk_approval",
        description: `Bulk approved ${processed.length} distributions by ${req.user!.name}`,
        actor: req.user!.email,
        entityType: "approval",
        newValue: JSON.stringify({ processed, skipped }),
        ipAddress: req.ip,
      });

      res.json({
        approved: processed.length,
        failed: skipped.length,
        message: `Approved ${processed.length}, skipped ${skipped.length} (high/medium risk or already processed)`,
      });
    } catch (err) {
      next(err);
    }
  }
);

function calcHealthScore(availableQuantity: number, minStockLevel: number): number {
  if (minStockLevel <= 0) return 100;
  if (availableQuantity >= minStockLevel * 1.5) return 85;
  if (availableQuantity >= minStockLevel) return 60;
  return 25;
}

export default router;
