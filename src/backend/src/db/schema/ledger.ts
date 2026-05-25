import {
  pgTable,
  serial,
  text,
  real,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { stocks } from "./stocks.js";
import { distributions } from "./distributions.js";

export const movementTypeEnum = pgEnum("movement_type", [
  "in",
  "out",
  "opening",
  "adjustment",
]);

export const stockLedger = pgTable("stock_ledger", {
  id: serial("id").primaryKey(),
  stockId: integer("stock_id")
    .notNull()
    .references(() => stocks.id),
  movementType: movementTypeEnum("movement_type").notNull(),
  quantity: real("quantity").notNull(),
  runningBalance: real("running_balance").notNull(),
  distributionId: integer("distribution_id").references(
    () => distributions.id
  ),
  uploadJobId: integer("upload_job_id"),
  performedBy: text("performed_by").notNull(),
  performedAt: timestamp("performed_at").notNull().defaultNow(),
  source: text("source").notNull(),
  remarks: text("remarks"),
});

export type StockLedger = typeof stockLedger.$inferSelect;
export type NewStockLedger = typeof stockLedger.$inferInsert;
