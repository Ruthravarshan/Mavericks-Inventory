export const API_BASE_URL = "/api/v1";

export const ROLES = {
  USER: "user",
  ADMIN: "admin",
  EXECUTIVE: "executive",
  MANAGER: "manager",
  L2: "management_authority",
  AUDITOR: "auditor",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<string, string> = {
  user: "IT Employee",
  admin: "System Admin",
  executive: "Executive",
  manager: "IT Manager",
  management_authority: "L2 Authority",
  auditor: "Auditor",
};

export const DISTRIBUTION_STATUSES = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  L1_PENDING: "l1_pending",
  L2_PENDING: "l2_pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  l1_pending: "L1 Pending",
  l2_pending: "L2 Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  submitted: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  l1_pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  l2_pending: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
};

export const RISK_COLORS: Record<string, string> = {
  Low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  High: "bg-red-500/20 text-red-400 border-red-500/30",
};

export const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export const HEALTH_COLORS = {
  healthy: "bg-green-500/20 text-green-400 border-green-500/30",
  warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
};

export const STOCK_CATEGORIES = [
  "Laptop",
  "Desktop",
  "Monitor",
  "Mobile Phone",
  "Peripherals",
  "Networking",
  "Server",
  "Storage",
  "Software License",
  "Access Card",
  "ID Card",
  "Power Equipment",
  "Cables",
  "Other IT Equipment",
];

export const ASSET_CONDITIONS = ["new", "good", "fair", "poor", "damaged"] as const;
export const ASSET_STATUSES = ["available", "assigned", "under_maintenance", "retired", "lost"] as const;
export const REQUEST_PRIORITIES = ["low", "normal", "urgent", "critical"] as const;
export const AUDIT_TYPES = ["scheduled", "spot_check", "self_audit", "renewal"] as const;

export const CONDITION_LABELS: Record<string, string> = {
  new: "New",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  damaged: "Damaged",
};

export const CONDITION_COLORS: Record<string, string> = {
  new: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  good: "bg-green-500/20 text-green-400 border-green-500/30",
  fair: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  poor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  damaged: "bg-red-500/20 text-red-400 border-red-500/30",
};

export const ASSET_STATUS_COLORS: Record<string, string> = {
  available: "bg-green-500/20 text-green-400 border-green-500/30",
  assigned: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  under_maintenance: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  retired: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  lost: "bg-red-500/20 text-red-400 border-red-500/30",
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  normal: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  urgent: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
};

export const AUDIT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  processing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  verified: "bg-green-500/20 text-green-400 border-green-500/30",
  needs_review: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
};

export const UNITS_OF_MEASURE = [
  "Pieces",
  "Boxes",
  "Kg",
  "Liters",
  "Meters",
  "Sets",
  "Packs",
  "Units",
  "Rolls",
  "Sheets",
];

export const LOCATIONS = [
  "Warehouse A",
  "Warehouse B",
  "Store Room 1",
  "Store Room 2",
  "Head Office",
  "Branch Office",
  "Main Store",
];

export const PAGE_SIZE = 20;

export const QUERY_KEYS = {
  DASHBOARD_SUMMARY: ["dashboard", "summary"],
  DASHBOARD_ACTIVITY: ["dashboard", "activity"],
  HEALTH_SCORES: ["health", "scores"],
  STOCKS: ["stocks"],
  DISTRIBUTIONS: ["distributions"],
  APPROVALS: ["approvals"],
  ANOMALIES: ["anomalies"],
  NOTIFICATIONS: ["notifications"],
  ADMIN_USERS: ["admin", "users"],
  SYSTEM_HEALTH: ["system", "health"],
  AUDIT_LOG: ["audit", "log"],
  LEDGER: ["ledger"],
  INVENTORY_HEALTH: ["inventory", "health"],
  UPLOAD_JOBS: ["upload", "jobs"],
  ASSETS: ["assets"],
  MY_ASSETS: ["my-assets"],
  MY_ASSET_HISTORY: ["my-assets", "history"],
  MY_ASSET_AUDITS: ["my-assets", "audits"],
  REQUESTS: ["requests"],
  ASSET_AUDITS: ["asset-audit"],
  EMPLOYEES: ["employees"],
};
