import {
  pgTable,
  serial,
  text,
  real,
  boolean,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const stockStatusEnum = pgEnum("stock_status", [
  "draft",
  "active",
  "inactive",
]);

export const stocks = pgTable("stocks", {
  id: serial("id").primaryKey(),
  stockCode: text("stock_code").notNull().unique(),
  stockName: text("stock_name").notNull(),
  category: text("category").notNull(),
  subCategory: text("sub_category"),
  unitOfMeasure: text("unit_of_measure").notNull(),
  openingQuantity: real("opening_quantity").notNull().default(0),
  availableQuantity: real("available_quantity").notNull().default(0),
  reservedQuantity: real("reserved_quantity").notNull().default(0),
  minStockLevel: real("min_stock_level").notNull().default(0),
  location: text("location"),
  description: text("description"),
  assetTagPrefix: text("asset_tag_prefix"),
  status: stockStatusEnum("status").notNull().default("draft"),
  healthScore: real("health_score").notNull().default(100),
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id),
  updatedBy: integer("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export type Stock = typeof stocks.$inferSelect;
export type NewStock = typeof stocks.$inferInsert;
