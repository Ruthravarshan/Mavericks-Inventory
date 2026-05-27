import "dotenv/config";
import { db } from "./index.js";
import { legalHolds } from "./schema/index.js";

async function main() {
  const existing = await db.select({ id: legalHolds.id }).from(legalHolds);
  if (existing.length > 0) {
    console.log(`Legal holds already seeded (${existing.length} records). Skipping.`);
    process.exit(0);
  }

  await db.insert(legalHolds).values([
    {
      holdReference: "LH-2026-001",
      title: "Q1 Audit Investigation",
      scope: "transaction",
      status: "active",
      recordsLocked: 47,
      initiatedByName: "Compliance Team",
      reason: "Regulatory audit requires preservation of all Q1 transaction records.",
      caseNumber: "AUD-2026-Q1",
      createdAt: new Date("2026-03-15"),
      updatedAt: new Date("2026-03-15"),
    },
    {
      holdReference: "LH-2026-002",
      title: "Mumbai Office Equipment Review",
      scope: "stock_master",
      status: "active",
      recordsLocked: 12,
      initiatedByName: "Legal Dept",
      reason: "Pending insurance claim — Mumbai office equipment affected by incident.",
      caseNumber: "INS-2026-042",
      createdAt: new Date("2026-04-02"),
      updatedAt: new Date("2026-04-02"),
    },
    {
      holdReference: "LH-2025-008",
      title: "FY2025 Year-End Freeze",
      scope: "transaction",
      status: "released",
      recordsLocked: 234,
      initiatedByName: "Finance Team",
      reason: "Year-end audit freeze for FY2025 records.",
      caseNumber: "FIN-2025-YE",
      releasedByName: "CFO",
      releasedAt: new Date("2026-02-28"),
      createdAt: new Date("2025-12-31"),
      updatedAt: new Date("2026-02-28"),
    },
    {
      holdReference: "LH-2026-003",
      title: "Bangalore Asset Discrepancy",
      scope: "user_records",
      status: "active",
      recordsLocked: 8,
      initiatedByName: "Internal Audit",
      reason:
        "Suspected irregularities in asset distribution records — Bangalore hub.",
      caseNumber: "INT-2026-019",
      createdAt: new Date("2026-05-01"),
      updatedAt: new Date("2026-05-01"),
    },
  ]);

  console.log("✓ Seeded 4 legal holds into database.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
