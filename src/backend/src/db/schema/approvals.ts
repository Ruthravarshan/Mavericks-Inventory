import {
  pgTable,
  serial,
  text,
  real,
  integer,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { distributions } from "./distributions.js";

export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "l1_approved",
  "approved",
  "rejected",
]);

export const approvals = pgTable("approvals", {
  id: serial("id").primaryKey(),
  distributionId: integer("distribution_id")
    .notNull()
    .unique()
    .references(() => distributions.id),
  status: approvalStatusEnum("status").notNull().default("pending"),
  remarks: text("remarks"),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  aiRecommendation: text("ai_recommendation").notNull().default(""),
  aiRiskScore: text("ai_risk_score").notNull().default(""),
  aiRiskLevel: text("ai_risk_level").notNull().default(""),
  aiReasoning: text("ai_reasoning").notNull().default(""),
  aiConfidence: real("ai_confidence").notNull().default(0),
  requiresL2: boolean("requires_l2").notNull().default(false),
  l2Status: text("l2_status"),
  l2ApprovedBy: integer("l2_approved_by").references(() => users.id),
  l2ApprovedAt: timestamp("l2_approved_at"),
  l2Remarks: text("l2_remarks"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Approval = typeof approvals.$inferSelect;
export type NewApproval = typeof approvals.$inferInsert;
