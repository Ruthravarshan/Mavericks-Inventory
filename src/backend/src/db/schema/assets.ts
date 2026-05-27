import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { stocks } from "./stocks.js";

export const assetConditionEnum = pgEnum("asset_condition", [
  "new",
  "good",
  "fair",
  "poor",
  "damaged",
]);

export const assetStatusEnum = pgEnum("asset_status", [
  "available",
  "assigned",
  "under_maintenance",
  "retired",
  "lost",
]);

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  assetTag: text("asset_tag").notNull().unique(),
  serialNumber: text("serial_number"),
  stockId: integer("stock_id").references(() => stocks.id),
  category: text("category").notNull(),
  subCategory: text("sub_category"),
  brand: text("brand"),
  model: text("model"),
  description: text("description"),
  condition: assetConditionEnum("condition").notNull().default("new"),
  status: assetStatusEnum("status").notNull().default("available"),
  location: text("location"),
  purchaseDate: timestamp("purchase_date"),
  warrantyExpiry: timestamp("warranty_expiry"),
  purchasePrice: text("purchase_price"),
  invoiceNumber: text("invoice_number"),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id),
  updatedBy: integer("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
