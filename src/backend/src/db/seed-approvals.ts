import "dotenv/config";
import { db } from "./index.js";
import {
  users,
  stocks,
  distributions,
  approvals,
  stockLedger,
} from "./schema/index.js";
import { eq, like, inArray, sql } from "drizzle-orm";
import logger from "../lib/logger.js";

/**
 * Demo seed for the Approval Workbench.
 *
 * Populates:
 *  - L1 Pending Queue   → distributions (l1_pending) + approvals (pending)
 *  - L2 Pending Queue   → distributions (l2_pending) + approvals (l1_approved, requiresL2)
 *  - Approval History   → distributions (approved / rejected)
 *  - Zero-Touch Log     → distributions (approved, Low risk, AI: Approve)
 *  - Override History   → distributions (approved despite AI: Reject)
 *
 * Idempotent: all rows use the TXN-DEMO-* transaction-code prefix and are
 * deleted + reinserted on each run. Safe to run repeatedly.
 */

const DEMO_PREFIX = "TXN-DEMO-";

// days-ago helper for submittedAt (drives SLA-breach badges in the UI)
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}

// distribution_date is stored as a plain YYYY-MM-DD string
function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type Plan = {
  code: string;
  stockCode: string;
  qty: number;
  createdByEmail: string;
  recipientType: "employee" | "project";
  recipientId: string;
  recipientName: string;
  purpose: string;
  location: string;
  distStatus: "l1_pending" | "l2_pending" | "approved" | "rejected";
  apprStatus?: "pending" | "l1_approved" | "approved" | "rejected";
  riskScore: number;
  riskLevel: "Low" | "Medium" | "High";
  rec: "Approve" | "Review" | "Reject";
  reasoning: string;
  confidence: number;
  requiresL2?: boolean;
  l1ApprovedByEmail?: string;
  l1Remarks?: string;
  submittedDaysAgo: number;
};

const PLANS: Plan[] = [
  // ─── L1 Pending Queue (approval: pending) ──────────────────────────────────
  {
    code: "001", stockCode: "MSE-001", qty: 5, createdByEmail: "employee@mavericks.com",
    recipientType: "employee", recipientId: "EMP-001", recipientName: "John Developer",
    purpose: "Replacement mice for the engineering pod after hardware refresh.",
    location: "Head Office", distStatus: "l1_pending", apprStatus: "pending",
    riskScore: 15, riskLevel: "Low", rec: "Approve",
    reasoning: "Routine low-quantity request from a verified employee with a consistent approval history. Well within available stock and below all anomaly thresholds.",
    confidence: 0.94, submittedDaysAgo: 1,
  },
  {
    code: "002", stockCode: "CAB-001", qty: 20, createdByEmail: "sarah@mavericks.com",
    recipientType: "project", recipientId: "PRJ-NET-12", recipientName: "Floor-3 Network Rollout",
    purpose: "CAT6 patch cables for the third-floor network re-cabling project.",
    location: "Warehouse C", distStatus: "l1_pending", apprStatus: "pending",
    riskScore: 22, riskLevel: "Low", rec: "Approve",
    reasoning: "Standard consumable request. Quantity is normal for a cabling project and stock levels are healthy (200 on hand).",
    confidence: 0.9, submittedDaysAgo: 2,
  },
  {
    code: "003", stockCode: "UPS-001", qty: 3, createdByEmail: "exec@mavericks.com",
    recipientType: "employee", recipientId: "EMP-EXEC-001", recipientName: "Executive User",
    purpose: "UPS units for the branch-office server cabinet.",
    location: "Branch A", distStatus: "l1_pending", apprStatus: "pending",
    riskScore: 25, riskLevel: "Low", rec: "Approve",
    reasoning: "Small replacement order with no risk indicators. Recipient and quantity are consistent with prior approved requests.",
    confidence: 0.88, submittedDaysAgo: 1,
  },
  {
    code: "004", stockCode: "MON-001", qty: 25, createdByEmail: "employee@mavericks.com",
    recipientType: "project", recipientId: "PRJ-DESK-07", recipientName: "Trading Desk Expansion",
    purpose: "Monitors for the new trading-desk workstations.",
    location: "Head Office", distStatus: "l1_pending", apprStatus: "pending",
    riskScore: 52, riskLevel: "Medium", rec: "Review",
    reasoning: "Quantity (25) is above the typical single-request average for monitors and would consume a large share of available stock. Recommend confirming the project allocation before approval.",
    confidence: 0.71, submittedDaysAgo: 3,
  },
  {
    code: "005", stockCode: "PRN-001", qty: 8, createdByEmail: "sarah@mavericks.com",
    recipientType: "employee", recipientId: "EMP-002", recipientName: "Sarah Designer",
    purpose: "Printers for the design studio refresh.",
    location: "Branch Office", distStatus: "l1_pending", apprStatus: "pending",
    riskScore: 48, riskLevel: "Medium", rec: "Review",
    reasoning: "Moderate quantity relative to stock on hand. Recipient has submitted multiple printer requests this quarter — verify the business need to rule out duplication.",
    confidence: 0.68, submittedDaysAgo: 4,
  },
  {
    code: "006", stockCode: "LAP-001", qty: 40, createdByEmail: "employee@mavericks.com",
    recipientType: "project", recipientId: "PRJ-ONB-22", recipientName: "Q3 Bulk Onboarding",
    purpose: "Laptops for incoming contractor cohort.",
    location: "Head Office", distStatus: "l1_pending", apprStatus: "pending",
    riskScore: 78, riskLevel: "High", rec: "Reject",
    reasoning: "Large laptop allocation (40 units) significantly exceeds normal distribution and would deplete healthy stock to near the minimum level. Justification is insufficient for a request of this size — recommend rejection or splitting into staged batches.",
    confidence: 0.83, submittedDaysAgo: 2,
  },
  {
    code: "007", stockCode: "NET-001", qty: 10, createdByEmail: "exec@mavericks.com",
    recipientType: "project", recipientId: "PRJ-NET-12", recipientName: "Floor-3 Network Rollout",
    purpose: "Network switches for the new floor distribution layer.",
    location: "Network Room", distStatus: "l1_pending", apprStatus: "pending",
    riskScore: 66, riskLevel: "High", rec: "Review",
    reasoning: "Network-switch stock is already flagged at warning health (60). Issuing 10 units would push it toward a critical level — review against the open procurement plan before approving.",
    confidence: 0.76, submittedDaysAgo: 1,
  },

  // ─── L2 Pending Queue (approval: l1_approved, requiresL2) ───────────────────
  {
    code: "008", stockCode: "SRV-001", qty: 3, createdByEmail: "employee@mavericks.com",
    recipientType: "project", recipientId: "PRJ-DC-03", recipientName: "Data-Centre Capacity",
    purpose: "Rack servers for the capacity-expansion programme.",
    location: "Data Centre", distStatus: "l2_pending", apprStatus: "l1_approved",
    riskScore: 72, riskLevel: "High", rec: "Review", requiresL2: true,
    l1ApprovedByEmail: "manager@mavericks.com",
    l1Remarks: "Technically valid and within DC norms. Escalating to L2 — Server category requires final sign-off by policy.",
    reasoning: "Server-category item requires L2 authorisation by policy regardless of quantity. The request is technically valid but carries high financial value, so final sign-off is escalated.",
    confidence: 0.79, submittedDaysAgo: 2,
  },
  {
    code: "009", stockCode: "LAP-001", qty: 60, createdByEmail: "sarah@mavericks.com",
    recipientType: "project", recipientId: "PRJ-ONB-22", recipientName: "Q3 Bulk Onboarding",
    purpose: "Bulk laptop allocation for company-wide refresh.",
    location: "Head Office", distStatus: "l2_pending", apprStatus: "l1_approved",
    riskScore: 85, riskLevel: "High", rec: "Reject", requiresL2: true,
    l1ApprovedByEmail: "manager@mavericks.com",
    l1Remarks: "Exceeds the 50-unit L2 threshold. Passing to L2 with concerns — stock impact is severe.",
    reasoning: "Quantity (60) exceeds the L2 escalation threshold of 50 and would critically deplete laptop stock below the minimum level. Strong written justification and phased delivery are required before any approval.",
    confidence: 0.86, submittedDaysAgo: 3,
  },

  // ─── Approval History + Zero-Touch + Override (distributions only) ──────────
  {
    code: "010", stockCode: "MSE-001", qty: 4, createdByEmail: "employee@mavericks.com",
    recipientType: "employee", recipientId: "EMP-001", recipientName: "John Developer",
    purpose: "Spare mouse for a new starter.",
    location: "Head Office", distStatus: "approved",
    riskScore: 12, riskLevel: "Low", rec: "Approve",
    reasoning: "Auto-cleared by the AI engine: minimal quantity, healthy stock, trusted recipient — no manual review required.",
    confidence: 0.96, submittedDaysAgo: 6,
  },
  {
    code: "011", stockCode: "CAB-001", qty: 15, createdByEmail: "sarah@mavericks.com",
    recipientType: "project", recipientId: "PRJ-NET-12", recipientName: "Floor-3 Network Rollout",
    purpose: "Additional patch cables.",
    location: "Warehouse C", distStatus: "approved",
    riskScore: 18, riskLevel: "Low", rec: "Approve",
    reasoning: "Auto-cleared by the AI engine: routine consumable, well within stock, no anomaly signals.",
    confidence: 0.93, submittedDaysAgo: 7,
  },
  {
    code: "012", stockCode: "MON-001", qty: 12, createdByEmail: "exec@mavericks.com",
    recipientType: "employee", recipientId: "EMP-EXEC-001", recipientName: "Executive User",
    purpose: "Monitors for the operations team.",
    location: "Branch A", distStatus: "approved",
    riskScore: 45, riskLevel: "Medium", rec: "Review",
    reasoning: "Flagged for review due to above-average quantity; approved by L1 after confirming the team allocation.",
    confidence: 0.7, submittedDaysAgo: 8,
  },
  {
    code: "013", stockCode: "LAP-001", qty: 30, createdByEmail: "employee@mavericks.com",
    recipientType: "project", recipientId: "PRJ-ONB-22", recipientName: "Q3 Bulk Onboarding",
    purpose: "Laptop request for onboarding.",
    location: "Head Office", distStatus: "rejected",
    riskScore: 80, riskLevel: "High", rec: "Reject",
    reasoning: "High quantity with weak justification and severe stock impact; rejected by L1 in line with the AI recommendation.",
    confidence: 0.84, submittedDaysAgo: 9,
  },
  {
    code: "014", stockCode: "SRV-001", qty: 2, createdByEmail: "manager@mavericks.com",
    recipientType: "project", recipientId: "PRJ-DC-03", recipientName: "Data-Centre Capacity",
    purpose: "Emergency server replacement after hardware failure.",
    location: "Data Centre", distStatus: "approved",
    riskScore: 75, riskLevel: "High", rec: "Reject",
    reasoning: "AI recommended rejection on financial-value grounds, but L2 overrode and approved given a verified production outage — recorded as a manual override.",
    confidence: 0.8, submittedDaysAgo: 5,
  },
];

async function seedApprovals() {
  logger.info("Seeding Approval Workbench demo data...");

  // ─── Resolve users + stocks ────────────────────────────────────────────────
  const userRows = await db
    .select({ id: users.id, email: users.email })
    .from(users);
  const userByEmail = new Map(userRows.map((u) => [u.email, u.id]));

  const stockRows = await db
    .select({
      id: stocks.id,
      code: stocks.stockCode,
      opening: stocks.openingQuantity,
      available: stocks.availableQuantity,
      category: stocks.category,
    })
    .from(stocks);
  const stockByCode = new Map(stockRows.map((s) => [s.code, s]));

  if (userRows.length === 0 || stockRows.length === 0) {
    logger.error("No users/stocks found. Run `npm run db:seed` first.");
    process.exit(1);
  }

  // ─── Heal available_quantity (seed.ts left it at 0) ─────────────────────────
  for (const s of stockRows) {
    if ((s.available ?? 0) === 0 && (s.opening ?? 0) > 0) {
      await db
        .update(stocks)
        .set({ availableQuantity: s.opening })
        .where(eq(stocks.id, s.id));
      s.available = s.opening;
    }
  }

  // ─── Idempotency: clear previous demo rows ──────────────────────────────────
  const existing = await db
    .select({ id: distributions.id })
    .from(distributions)
    .where(like(distributions.transactionCode, `${DEMO_PREFIX}%`));
  if (existing.length > 0) {
    const ids = existing.map((d) => d.id);
    await db.delete(approvals).where(inArray(approvals.distributionId, ids));
    await db.delete(stockLedger).where(
      like(stockLedger.source, "demo_approval%")
    );
    await db.delete(distributions).where(inArray(distributions.id, ids));
    logger.info(`Cleared ${ids.length} existing demo distributions`);
  }

  let inserted = 0;

  for (const p of PLANS) {
    const stock = stockByCode.get(p.stockCode);
    const createdBy = userByEmail.get(p.createdByEmail);
    if (!stock || !createdBy) {
      logger.warn(`Skipping ${DEMO_PREFIX}${p.code}: missing stock/user`);
      continue;
    }

    const submittedAt = daysAgo(p.submittedDaysAgo);
    const transactionCode = `${DEMO_PREFIX}${p.code}`;

    // ── distribution row ──
    const [dist] = await db
      .insert(distributions)
      .values({
        transactionCode,
        stockId: stock.id,
        qtyRequested: p.qty,
        distributionDate: dateStr(submittedAt),
        recipientType: p.recipientType,
        recipientId: p.recipientId,
        recipientName: p.recipientName,
        location: p.location,
        purpose: p.purpose,
        status: p.distStatus,
        aiRiskScore: String(p.riskScore),
        aiRecommendation: p.rec,
        aiReasoning: p.reasoning,
        aiConfidence: p.confidence,
        createdBy,
        submittedBy: createdBy,
        submittedAt,
        createdAt: submittedAt,
        updatedAt: submittedAt,
      })
      .returning();

    // ── approval row (only for pending L1 / L2 queues) ──
    if (p.apprStatus) {
      const l1By = p.l1ApprovedByEmail ? userByEmail.get(p.l1ApprovedByEmail) : null;
      await db.insert(approvals).values({
        distributionId: dist.id,
        status: p.apprStatus,
        aiRecommendation: p.rec,
        aiRiskScore: String(p.riskScore),
        aiRiskLevel: p.riskLevel,
        aiReasoning: p.reasoning,
        aiConfidence: p.confidence,
        requiresL2: p.requiresL2 ?? false,
        approvedBy: p.apprStatus === "l1_approved" ? l1By ?? null : null,
        approvedAt: p.apprStatus === "l1_approved" ? submittedAt : null,
        remarks: p.apprStatus === "l1_approved" ? p.l1Remarks ?? null : null,
        createdAt: submittedAt,
        updatedAt: submittedAt,
      });
    }

    // ── stock balance bookkeeping ──
    if (p.distStatus === "l1_pending" || p.distStatus === "l2_pending") {
      // pending → reserve the quantity
      await db
        .update(stocks)
        .set({ reservedQuantity: sql`${stocks.reservedQuantity} + ${p.qty}` })
        .where(eq(stocks.id, stock.id));
    } else if (p.distStatus === "approved") {
      // approved → decrement available + write a ledger entry
      await db
        .update(stocks)
        .set({ availableQuantity: sql`GREATEST(${stocks.availableQuantity} - ${p.qty}, 0)` })
        .where(eq(stocks.id, stock.id));
      await db.insert(stockLedger).values({
        stockId: stock.id,
        movementType: "out",
        quantity: p.qty,
        runningBalance: Math.max((stock.available ?? 0) - p.qty, 0),
        distributionId: dist.id,
        performedBy: "Demo Seed",
        performedAt: submittedAt,
        source: "demo_approval",
        remarks: `Approved distribution ${transactionCode}`,
      });
      stock.available = Math.max((stock.available ?? 0) - p.qty, 0);
    }

    inserted++;
  }

  logger.info(`✓ Seeded ${inserted} demo distributions/approvals`);
  logger.info("  L1 Pending queue:  7 items (Low/Medium/High mix)");
  logger.info("  L2 Pending queue:  2 items (Server + qty>50)");
  logger.info("  History/Zero-Touch/Override: 5 items");
  process.exit(0);
}

seedApprovals().catch((err) => {
  logger.error({ err }, "Approval seed failed");
  process.exit(1);
});
