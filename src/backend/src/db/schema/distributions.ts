import {
  pgTable,
  serial,
  text,
  real,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { stocks } from "./stocks.js";

export const recipientTypeEnum = pgEnum("recipient_type", [
  "employee",
  "project",
]);

export const distributionStatusEnum = pgEnum("distribution_status", [
  "draft",
  "submitted",
  "l1_pending",
  "l2_pending",
  "approved",
  "rejected",
]);

export const distributions = pgTable("distributions", {
  id: serial("id").primaryKey(),
  transactionCode: text("transaction_code").notNull().unique(),
  stockId: integer("stock_id")
    .notNull()
    .references(() => stocks.id),
  qtyRequested: real("qty_requested").notNull(),
  distributionDate: text("distribution_date").notNull(),
  recipientType: recipientTypeEnum("recipient_type").notNull(),
  recipientId: text("recipient_id").notNull(),
  recipientName: text("recipient_name").notNull(),
  location: text("location"),
  purpose: text("purpose"),
  status: distributionStatusEnum("status").notNull().default("draft"),
  aiRiskScore: text("ai_risk_score"),
  aiRecommendation: text("ai_recommendation"),
  aiReasoning: text("ai_reasoning"),
  aiConfidence: real("ai_confidence"),
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id),
  submittedBy: integer("submitted_by").references(() => users.id),
  submittedAt: timestamp("submitted_at"),
  updatedBy: integer("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Distribution = typeof distributions.$inferSelect;
export type NewDistribution = typeof distributions.$inferInsert;
