import {
  LayoutDashboard,
  CheckSquare,
  Package,
  ArrowRightLeft,
  AlertTriangle,
  Brain,
  BarChart3,
  FileText,
  Upload,
  Settings,
  Laptop,
  Users,
  PlusCircle,
  Camera,
  ClipboardList,
  Tag,
  History,
  BookOpen,
  TrendingUp,
  Lock,
  Zap,
  ShieldCheck,
  RefreshCw,
  Scale,
  Boxes,
} from "lucide-react";

/**
 * Shared navigation definitions.
 *
 * Single source of truth consumed by both the app sidebar (app-layout.tsx) and
 * the admin "Access Control" tab, which lets an admin toggle which tabs each
 * role can see. Badge counts are injected at render time via `badgeKey`.
 */

export type BadgeKey = "pendingApprovals" | "criticalAnomalies";

export interface NavItemDef {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badgeKey?: BadgeKey;
}

export interface NavSectionDef {
  label: string;
  items: NavItemDef[];
}

const employeeSections: NavSectionDef[] = [
  {
    label: "WORKSPACE",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
      { label: "My Inventory", icon: Laptop, href: "/my-assets" },
      { label: "Create Request", icon: PlusCircle, href: "/make-request" },
      { label: "My Requests", icon: ClipboardList, href: "/my-requests" },
      { label: "Submit Audit", icon: Camera, href: "/asset-audit" },
    ],
  },
  {
    label: "CATALOG",
    items: [{ label: "Stock Catalog", icon: Package, href: "/stocks" }],
  },
];

const executiveSections: NavSectionDef[] = [
  {
    label: "WORKSPACE",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
      { label: "My Inventory", icon: Laptop, href: "/my-assets" },
      { label: "Create Transaction", icon: PlusCircle, href: "/make-request" },
      { label: "My Requests", icon: ClipboardList, href: "/my-requests" },
      { label: "Submit Audit", icon: Camera, href: "/asset-audit" },
    ],
  },
  {
    label: "CATALOG",
    items: [
      { label: "Stock Catalog", icon: Package, href: "/stocks" },
      { label: "Distributions", icon: ArrowRightLeft, href: "/distributions" },
    ],
  },
];

const managerSections: NavSectionDef[] = [
  {
    label: "WORKSPACE",
    items: [{ label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" }],
  },
  {
    label: "APPROVALS",
    items: [
      { label: "Approval Workbench", icon: CheckSquare, href: "/approvals", badgeKey: "pendingApprovals" },
      { label: "Approval History", icon: History, href: "/approvals?tab=history" },
      { label: "Anomalies", icon: AlertTriangle, href: "/anomalies", badgeKey: "criticalAnomalies" },
    ],
  },
  {
    label: "INVENTORY",
    items: [
      { label: "Stock Master", icon: Package, href: "/stocks" },
      { label: "Stock Ledger", icon: BookOpen, href: "/ledger" },
      { label: "Distributions", icon: ArrowRightLeft, href: "/distributions" },
      { label: "Asset Registry", icon: Tag, href: "/assets" },
    ],
  },
  {
    label: "PEOPLE",
    items: [
      { label: "Employees", icon: Users, href: "/employees" },
      { label: "Asset Requests", icon: ClipboardList, href: "/manage-requests", badgeKey: "pendingApprovals" },
    ],
  },
  {
    label: "ANALYTICS",
    items: [
      { label: "AI Insights", icon: Brain, href: "/insights" },
      { label: "Reports", icon: BarChart3, href: "/reports" },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { label: "Audit Log", icon: FileText, href: "/audit-log" },
      { label: "Bulk Upload", icon: Upload, href: "/upload" },
    ],
  },
];

const l2Sections: NavSectionDef[] = [
  {
    label: "WORKSPACE",
    items: [{ label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" }],
  },
  {
    label: "FINAL APPROVALS",
    items: [
      { label: "Exception Queue", icon: CheckSquare, href: "/approvals", badgeKey: "pendingApprovals" },
      { label: "Override History", icon: History, href: "/approvals?tab=history" },
      { label: "Zero-Touch Log", icon: Zap, href: "/approvals?tab=zero-touch" },
      { label: "Anomalies", icon: AlertTriangle, href: "/anomalies", badgeKey: "criticalAnomalies" },
    ],
  },
  {
    label: "OVERSIGHT",
    items: [
      { label: "KPI Analytics", icon: TrendingUp, href: "/insights" },
      { label: "Reports", icon: BarChart3, href: "/reports" },
    ],
  },
  {
    label: "INVENTORY",
    items: [
      { label: "Stock Master", icon: Package, href: "/stocks" },
      { label: "Stock Ledger", icon: BookOpen, href: "/ledger" },
      { label: "Distributions", icon: ArrowRightLeft, href: "/distributions" },
    ],
  },
  {
    label: "PEOPLE",
    items: [{ label: "Employees", icon: Users, href: "/employees" }],
  },
  {
    label: "OPERATIONS",
    items: [{ label: "Audit Log", icon: FileText, href: "/audit-log" }],
  },
];

const adminSections: NavSectionDef[] = [
  {
    label: "WORKSPACE",
    items: [{ label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" }],
  },
  {
    label: "APPROVALS",
    items: [
      { label: "Approval Workbench", icon: CheckSquare, href: "/approvals", badgeKey: "pendingApprovals" },
      { label: "Anomalies", icon: AlertTriangle, href: "/anomalies", badgeKey: "criticalAnomalies" },
    ],
  },
  {
    label: "INVENTORY",
    items: [
      { label: "Stock Master", icon: Package, href: "/stocks" },
      { label: "Stock Ledger", icon: BookOpen, href: "/ledger" },
      { label: "Distributions", icon: ArrowRightLeft, href: "/distributions" },
      { label: "Asset Registry", icon: Tag, href: "/assets" },
      { label: "Reconciliation", icon: RefreshCw, href: "/reconciliation" },
    ],
  },
  {
    label: "PEOPLE",
    items: [
      { label: "Employees", icon: Users, href: "/employees" },
      { label: "Asset Requests", icon: ClipboardList, href: "/manage-requests", badgeKey: "pendingApprovals" },
    ],
  },
  {
    label: "ANALYTICS",
    items: [
      { label: "AI Insights", icon: Brain, href: "/insights" },
      { label: "Reports", icon: BarChart3, href: "/reports" },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { label: "Bulk Upload", icon: Upload, href: "/upload" },
      { label: "Audit Log", icon: FileText, href: "/audit-log" },
      { label: "Legal Holds", icon: Lock, href: "/legal-holds" },
    ],
  },
  {
    label: "ADMINISTRATION",
    items: [{ label: "System Admin", icon: Settings, href: "/admin" }],
  },
];

const auditorSections: NavSectionDef[] = [
  {
    label: "AUDIT & COMPLIANCE",
    items: [
      { label: "Transactions", icon: ArrowRightLeft, href: "/distributions" },
      { label: "Approval Records", icon: CheckSquare, href: "/approvals" },
      { label: "AI Decision Log", icon: Brain, href: "/insights" },
      { label: "Stock Ledger", icon: BookOpen, href: "/ledger" },
      { label: "Legal Holds", icon: Lock, href: "/legal-holds" },
      { label: "Audit Trail", icon: ShieldCheck, href: "/audit-log" },
    ],
  },
  {
    label: "REPORTS",
    items: [
      { label: "All Reports", icon: BarChart3, href: "/reports" },
      { label: "Exception Analysis", icon: Scale, href: "/reports?type=exceptions" },
    ],
  },
  {
    label: "MASTER DATA",
    items: [
      { label: "Stock Master", icon: Package, href: "/stocks" },
      { label: "Asset Registry", icon: Boxes, href: "/assets" },
      { label: "Employees", icon: Users, href: "/employees" },
    ],
  },
];

export const ROLE_NAV: Record<string, NavSectionDef[]> = {
  user: employeeSections,
  executive: executiveSections,
  manager: managerSections,
  management_authority: l2Sections,
  admin: adminSections,
  auditor: auditorSections,
};

/** Roles that have a configurable sidebar (used by the admin Access Control tab). */
export const CONFIGURABLE_ROLES = [
  "user",
  "executive",
  "manager",
  "management_authority",
  "auditor",
] as const;

export function getRoleNav(role: string): NavSectionDef[] {
  return ROLE_NAV[role] ?? employeeSections;
}
