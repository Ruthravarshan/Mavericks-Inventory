import {
  pgTable,
  serial,
  text,
  integer,
  real,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { assets } from "./assets.js";
import { assetAssignments } from "./asset_assignments.js";

export const auditTypeEnum = pgEnum("audit_type", [
  "scheduled",
  "spot_check",
  "self_audit",
  "renewal",
]);

export const auditAiStatusEnum = pgEnum("audit_ai_status", [
  "pending",
  "processing",
  "verified",
  "needs_review",
  "failed",
]);

export const auditFinalStatusEnum = pgEnum("audit_final_status", [
  "pending",
  "verified",
  "flagged",
  "lost",
  "damaged",
]);

export const assetAudits = pgTable("asset_audits", {
  id: serial("id").primaryKey(),
  auditCode: text("audit_code").notNull().unique(),
  assetId: integer("asset_id").notNull().references(() => assets.id),
  assignmentId: integer("assignment_id").references(() => assetAssignments.id),
  conductedBy: integer("conducted_by").notNull().references(() => users.id),
  auditType: auditTypeEnum("audit_type").notNull().default("self_audit"),
  mediaUrls: text("media_urls"),
  mediaTypes: text("media_types"),
  aiStatus: auditAiStatusEnum("ai_status").notNull().default("pending"),
  aiConfidence: real("ai_confidence"),
  aiObservations: text("ai_observations"),
  aiAssetTagDetected: text("ai_asset_tag_detected"),
  aiConditionAssessment: text("ai_condition_assessment"),
  aiNeedsHumanReview: integer("ai_needs_human_review").default(0),
  humanReviewerId: integer("human_reviewer_id").references(() => users.id),
  humanReviewNotes: text("human_review_notes"),
  humanReviewedAt: timestamp("human_reviewed_at"),
  finalStatus: auditFinalStatusEnum("final_status").notNull().default("pending"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AssetAudit = typeof assetAudits.$inferSelect;
export type NewAssetAudit = typeof assetAudits.$inferInsert;
