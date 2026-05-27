import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const holdStatusEnum = pgEnum("hold_status", ["active", "released"]);
export const holdScopeEnum = pgEnum("hold_scope", [
  "transaction",
  "stock_master",
  "user_records",
]);

export const legalHolds = pgTable("legal_holds", {
  id: serial("id").primaryKey(),
  holdReference: text("hold_reference").notNull().unique(),
  title: text("title").notNull(),
  scope: holdScopeEnum("scope").notNull(),
  status: holdStatusEnum("status").notNull().default("active"),
  recordsLocked: integer("records_locked").notNull().default(0),
  initiatedBy: integer("initiated_by").references(() => users.id),
  initiatedByName: text("initiated_by_name").notNull(),
  reason: text("reason").notNull(),
  caseNumber: text("case_number").notNull(),
  releasedBy: integer("released_by").references(() => users.id),
  releasedByName: text("released_by_name"),
  releasedAt: timestamp("released_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type LegalHold = typeof legalHolds.$inferSelect;
export type NewLegalHold = typeof legalHolds.$inferInsert;
