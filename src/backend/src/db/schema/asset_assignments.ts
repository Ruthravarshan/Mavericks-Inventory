import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { assets } from "./assets.js";

export const assignmentStatusEnum = pgEnum("assignment_status", [
  "active",
  "returned",
  "expired",
  "lost",
]);

export const assetAssignments = pgTable("asset_assignments", {
  id: serial("id").primaryKey(),
  assignmentCode: text("assignment_code").notNull().unique(),
  assetId: integer("asset_id").notNull().references(() => assets.id),
  employeeId: integer("employee_id").notNull().references(() => users.id),
  assignedDate: timestamp("assigned_date").notNull().defaultNow(),
  validityDate: timestamp("validity_date"),
  returnedDate: timestamp("returned_date"),
  lastAuditDate: timestamp("last_audit_date"),
  nextAuditDue: timestamp("next_audit_due"),
  status: assignmentStatusEnum("status").notNull().default("active"),
  purpose: text("purpose"),
  notes: text("notes"),
  assignedBy: integer("assigned_by").notNull().references(() => users.id),
  returnedTo: integer("returned_to").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AssetAssignment = typeof assetAssignments.$inferSelect;
export type NewAssetAssignment = typeof assetAssignments.$inferInsert;
