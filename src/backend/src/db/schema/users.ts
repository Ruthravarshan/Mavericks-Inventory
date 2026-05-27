import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "user",
  "executive",
  "manager",
  "management_authority",
  "admin",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  employeeId: text("employee_id").notNull().unique(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("user"),
  department: text("department"),
  designation: text("designation"),
  location: text("location"),
  managerId: integer("manager_id"),
  onboardingDate: timestamp("onboarding_date"),
  isActive: boolean("is_active").notNull().default(true),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
