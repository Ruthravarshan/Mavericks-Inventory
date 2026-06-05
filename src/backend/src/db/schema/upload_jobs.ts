import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const uploadTypeEnum = pgEnum("upload_type", [
  "stock_master",
  "distribution",
]);

export const uploadStatusEnum = pgEnum("upload_status", [
  "queued",
  "processing",
  "completed",
  "failed",
]);

export const uploadJobs = pgTable("upload_jobs", {
  id: serial("id").primaryKey(),
  uploadedBy: integer("uploaded_by")
    .notNull()
    .references(() => users.id),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url"),
  fileHash: text("file_hash"),
  uploadType: uploadTypeEnum("upload_type").notNull(),
  status: uploadStatusEnum("status").notNull().default("queued"),
  rowsTotal: integer("rows_total").notNull().default(0),
  rowsValid: integer("rows_valid").notNull().default(0),
  rowsCorrected: integer("rows_corrected").notNull().default(0),
  rowsFailed: integer("rows_failed").notNull().default(0),
  errorReportUrl: text("error_report_url"),
  errorReportJson: text("error_report_json"),
  correctionsJson: text("corrections_json"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export type UploadJob = typeof uploadJobs.$inferSelect;
export type NewUploadJob = typeof uploadJobs.$inferInsert;
