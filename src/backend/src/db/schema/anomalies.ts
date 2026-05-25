import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { stocks } from "./stocks.js";

export const anomalySeverityEnum = pgEnum("anomaly_severity", [
  "info",
  "warning",
  "critical",
]);

export const anomalyStatusEnum = pgEnum("anomaly_status", [
  "active",
  "acknowledged",
  "resolved",
]);

export const anomalies = pgTable("anomalies", {
  id: serial("id").primaryKey(),
  stockId: integer("stock_id").references(() => stocks.id),
  anomalyType: text("anomaly_type").notNull(),
  severity: anomalySeverityEnum("severity").notNull(),
  description: text("description").notNull(),
  explanation: text("explanation"),
  recommendedAction: text("recommended_action"),
  dismissed: boolean("dismissed").notNull().default(false),
  status: anomalyStatusEnum("status").notNull().default("active"),
  acknowledgedBy: text("acknowledged_by"),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedBy: text("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  detectedAt: timestamp("detected_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Anomaly = typeof anomalies.$inferSelect;
export type NewAnomaly = typeof anomalies.$inferInsert;
