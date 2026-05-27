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

export const requestPriorityEnum = pgEnum("request_priority", [
  "low",
  "normal",
  "urgent",
  "critical",
]);

export const requestStatusEnum = pgEnum("request_status", [
  "pending",
  "approved",
  "rejected",
  "fulfilled",
  "cancelled",
]);

export const assetRequests = pgTable("asset_requests", {
  id: serial("id").primaryKey(),
  requestCode: text("request_code").notNull().unique(),
  requestedBy: integer("requested_by").notNull().references(() => users.id),
  category: text("category").notNull(),
  subCategory: text("sub_category"),
  itemDescription: text("item_description").notNull(),
  reason: text("reason").notNull(),
  priority: requestPriorityEnum("priority").notNull().default("normal"),
  status: requestStatusEnum("status").notNull().default("pending"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  fulfilledAssetId: integer("fulfilled_asset_id").references(() => assets.id),
  fulfilledAt: timestamp("fulfilled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AssetRequest = typeof assetRequests.$inferSelect;
export type NewAssetRequest = typeof assetRequests.$inferInsert;
