import {
  pgTable,
  serial,
  integer,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { stocks } from "./stocks.js";
import { users } from "./users.js";

export const reconciliationCounts = pgTable("reconciliation_counts", {
  id: serial("id").primaryKey(),
  stockId: integer("stock_id")
    .notNull()
    .references(() => stocks.id),
  physicalQty: real("physical_qty").notNull(),
  countedBy: integer("counted_by").references(() => users.id),
  countedByName: text("counted_by_name"),
  countedAt: timestamp("counted_at").notNull().defaultNow(),
  notes: text("notes"),
});

export type ReconciliationCount = typeof reconciliationCounts.$inferSelect;
export type NewReconciliationCount = typeof reconciliationCounts.$inferInsert;
