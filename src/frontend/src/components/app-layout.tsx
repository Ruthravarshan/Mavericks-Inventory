import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
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
  LogOut,
  Menu,
  X,
  ChevronRight,
  Laptop,
  Users,
  PlusCircle,
  Camera,
  ClipboardList,
  Tag,
  User,
  Palette,
  History,
  BookOpen,
  TrendingUp,
  Activity,
  Lock,
  Zap,
  Database,
  ShieldCheck,
  RefreshCw,
  Scale,
  GitBranch,
  Boxes,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import { useGetDashboardSummary, useListAnomalies } from "@/hooks/use-queries";
import { NotificationPanel } from "@/components/notification-panel";
import { ThemeCustomizer } from "@/components/theme-customizer";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/constants";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: number;
  roles?: string[];
}

interface NavSection {
  label: string;
  items: NavItem[];
}

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { openCustomizer } = useTheme();

  const { data: summary } = useGetDashboardSummary();
  const { data: anomaliesData } = useListAnomalies({ severity: "critical", status: "active" });

  const criticalAnomalies = anomaliesData?.items.length ?? 0;
  const pendingApprovals = summary?.pending_approvals ?? 0;

  const userRole = user?.role ?? "";

  // Close profile dropdown on outside click
  useEffect(() => {
    if (!profileOpen) return;
    function handlePointerDown(e: PointerEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [profileOpen]);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  // ── Employee (user) ──────────────────────────────────────────────
  const employeeSections: NavSection[] = [
    {
      label: "WORKSPACE",
      items: [
        { label: "Dashboard",         icon: LayoutDashboard, href: "/dashboard" },
        { label: "My Inventory",      icon: Laptop,          href: "/my-assets" },
        { label: "Create Request",    icon: PlusCircle,      href: "/make-request" },
        { label: "My Requests",       icon: ClipboardList,   href: "/my-requests" },
        { label: "Submit Audit",      icon: Camera,          href: "/asset-audit" },
      ],
    },
    {
      label: "CATALOG",
      items: [
        { label: "Stock Catalog",     icon: Package,         href: "/stocks" },
      ],
    },
  ];

  // ── Executive ─────────────────────────────────────────────────────
  const executiveSections: NavSection[] = [
    {
      label: "WORKSPACE",
      items: [
        { label: "Dashboard",         icon: LayoutDashboard, href: "/dashboard" },
        { label: "My Inventory",      icon: Laptop,          href: "/my-assets" },
        { label: "Create Transaction",icon: PlusCircle,      href: "/make-request" },
        { label: "My Requests",       icon: ClipboardList,   href: "/my-requests" },
        { label: "Submit Audit",      icon: Camera,          href: "/asset-audit" },
      ],
    },
    {
      label: "CATALOG",
      items: [
        { label: "Stock Catalog",     icon: Package,         href: "/stocks" },
        { label: "Distributions",     icon: ArrowRightLeft,  href: "/distributions" },
      ],
    },
  ];

  // ── Manager (L1 Approver) ─────────────────────────────────────────
  const managerSections: NavSection[] = [
    {
      label: "WORKSPACE",
      items: [
        { label: "Dashboard",         icon: LayoutDashboard, href: "/dashboard" },
      ],
    },
    {
      label: "APPROVALS",
      items: [
        { label: "Approval Workbench",icon: CheckSquare,     href: "/approvals",      badge: pendingApprovals },
        { label: "Approval History",  icon: History,         href: "/approvals?tab=history" },
        { label: "Anomalies",         icon: AlertTriangle,   href: "/anomalies",      badge: criticalAnomalies },
      ],
    },
    {
      label: "INVENTORY",
      items: [
        { label: "Stock Master",      icon: Package,         href: "/stocks" },
        { label: "Stock Ledger",      icon: BookOpen,        href: "/ledger" },
        { label: "Distributions",     icon: ArrowRightLeft,  href: "/distributions" },
        { label: "Asset Registry",    icon: Tag,             href: "/assets" },
      ],
    },
    {
      label: "PEOPLE",
      items: [
        { label: "Employees",         icon: Users,           href: "/employees" },
        { label: "Asset Requests",    icon: ClipboardList,   href: "/manage-requests", badge: pendingApprovals },
      ],
    },
    {
      label: "ANALYTICS",
      items: [
        { label: "AI Insights",       icon: Brain,           href: "/insights" },
        { label: "Reports",           icon: BarChart3,       href: "/reports" },
      ],
    },
    {
      label: "OPERATIONS",
      items: [
        { label: "Audit Log",         icon: FileText,        href: "/audit-log" },
        { label: "Bulk Upload",       icon: Upload,          href: "/upload" },
      ],
    },
  ];

  // ── Management Authority (L2 Final Approver) ──────────────────────
  const l2Sections: NavSection[] = [
    {
      label: "WORKSPACE",
      items: [
        { label: "Dashboard",         icon: LayoutDashboard, href: "/dashboard" },
      ],
    },
    {
      label: "FINAL APPROVALS",
      items: [
        { label: "Exception Queue",   icon: CheckSquare,     href: "/approvals",      badge: pendingApprovals },
        { label: "Override History",  icon: History,         href: "/approvals?tab=history" },
        { label: "Zero-Touch Log",    icon: Zap,             href: "/approvals?tab=zero-touch" },
        { label: "Anomalies",         icon: AlertTriangle,   href: "/anomalies",      badge: criticalAnomalies },
      ],
    },
    {
      label: "OVERSIGHT",
      items: [
        { label: "KPI Analytics",     icon: TrendingUp,      href: "/insights" },
        { label: "Reports",           icon: BarChart3,       href: "/reports" },
      ],
    },
    {
      label: "INVENTORY",
      items: [
        { label: "Stock Master",      icon: Package,         href: "/stocks" },
        { label: "Stock Ledger",      icon: BookOpen,        href: "/ledger" },
        { label: "Distributions",     icon: ArrowRightLeft,  href: "/distributions" },
      ],
    },
    {
      label: "PEOPLE",
      items: [
        { label: "Employees",         icon: Users,           href: "/employees" },
      ],
    },
    {
      label: "OPERATIONS",
      items: [
        { label: "Audit Log",         icon: FileText,        href: "/audit-log" },
      ],
    },
  ];

  // ── Admin (System Administrator) ─────────────────────────────────
  const adminSections: NavSection[] = [
    {
      label: "WORKSPACE",
      items: [
        { label: "Dashboard",         icon: LayoutDashboard, href: "/dashboard" },
      ],
    },
    {
      label: "APPROVALS",
      items: [
        { label: "Approval Workbench",icon: CheckSquare,     href: "/approvals",      badge: pendingApprovals },
        { label: "Anomalies",         icon: AlertTriangle,   href: "/anomalies",      badge: criticalAnomalies },
      ],
    },
    {
      label: "INVENTORY",
      items: [
        { label: "Stock Master",      icon: Package,         href: "/stocks" },
        { label: "Stock Ledger",      icon: BookOpen,        href: "/ledger" },
        { label: "Distributions",     icon: ArrowRightLeft,  href: "/distributions" },
        { label: "Asset Registry",    icon: Tag,             href: "/assets" },
        { label: "Reconciliation",    icon: RefreshCw,       href: "/reconciliation" },
      ],
    },
    {
      label: "PEOPLE",
      items: [
        { label: "Employees",         icon: Users,           href: "/employees" },
        { label: "Asset Requests",    icon: ClipboardList,   href: "/manage-requests", badge: pendingApprovals },
      ],
    },
    {
      label: "ANALYTICS",
      items: [
        { label: "AI Insights",       icon: Brain,           href: "/insights" },
        { label: "Reports",           icon: BarChart3,       href: "/reports" },
      ],
    },
    {
      label: "AUTOMATION",
      items: [
        { label: "AI Policy Center",  icon: Zap,             href: "/admin?tab=policy" },
        { label: "Workflow Rules",    icon: GitBranch,       href: "/admin?tab=workflow" },
        { label: "Monitoring",        icon: Activity,        href: "/admin?tab=monitoring" },
      ],
    },
    {
      label: "DATA MANAGEMENT",
      items: [
        { label: "Catalog Admin",     icon: Database,        href: "/admin?tab=catalog" },
        { label: "User Management",   icon: Users,           href: "/admin?tab=users" },
        { label: "Bulk Upload",       icon: Upload,          href: "/upload" },
      ],
    },
    {
      label: "COMPLIANCE",
      items: [
        { label: "Audit Log",         icon: FileText,        href: "/audit-log" },
        { label: "Legal Holds",       icon: Lock,            href: "/legal-holds" },
        { label: "Administration",    icon: Settings,        href: "/admin" },
      ],
    },
  ];

  // ── Auditor (Read-Only Compliance) ────────────────────────────────
  const auditorSections: NavSection[] = [
    {
      label: "AUDIT & COMPLIANCE",
      items: [
        { label: "Transactions",      icon: ArrowRightLeft,  href: "/distributions" },
        { label: "Approval Records",  icon: CheckSquare,     href: "/approvals" },
        { label: "AI Decision Log",   icon: Brain,           href: "/insights" },
        { label: "Stock Ledger",      icon: BookOpen,        href: "/ledger" },
        { label: "Legal Holds",       icon: Lock,            href: "/legal-holds" },
        { label: "Audit Trail",       icon: ShieldCheck,     href: "/audit-log" },
      ],
    },
    {
      label: "REPORTS",
      items: [
        { label: "All Reports",       icon: BarChart3,       href: "/reports" },
        { label: "Exception Analysis",icon: Scale,           href: "/reports?type=exceptions" },
      ],
    },
    {
      label: "MASTER DATA",
      items: [
        { label: "Stock Master",      icon: Package,         href: "/stocks" },
        { label: "Asset Registry",    icon: Boxes,           href: "/assets" },
        { label: "Employees",         icon: Users,           href: "/employees" },
      ],
    },
  ];

  function getSections(): NavSection[] {
    if (userRole === "admin")                return adminSections;
    if (userRole === "management_authority") return l2Sections;
    if (userRole === "manager")              return managerSections;
    if (userRole === "executive")            return executiveSections;
    if (userRole === "auditor")              return auditorSections;
    return employeeSections; // "user"
  }

  const sections = getSections();

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((p: string) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const Sidebar = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4">
        <div>
          <div
            style={{ letterSpacing: "0.2em", fontSize: "14px", fontWeight: 800, lineHeight: 1 }}
            className="text-[hsl(var(--foreground))]"
          >
            MVX
          </div>
          <div
            style={{ letterSpacing: "0.16em", fontSize: "9px", marginTop: "4px" }}
            className="text-[hsl(var(--muted-foreground))]/60 uppercase"
          >
            Asset Intelligence
          </div>
        </div>
        <div className="flex flex-col gap-[3px]" aria-hidden>
          {(["#93a3b1", "#7c898b", "#636564"] as const).map((c) => (
            <div key={c} style={{ width: "16px", height: "2px", background: c }} />
          ))}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section, sectionIdx) => {
          // Compute a base delay for animation staggering
          const baseDelay = sections
            .slice(0, sectionIdx)
            .reduce((acc, s) => acc + s.items.length, 0);

          return (
            <div key={section.label} className={sectionIdx > 0 ? "mt-4" : undefined}>
              <div className="mb-1.5 px-3">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]/60">
                  {section.label}
                </span>
              </div>
              <ul className="space-y-0.5">
                {section.items.map((item, itemIdx) => {
                  const isActive =
                    location.pathname === item.href ||
                    (item.href !== "/dashboard" &&
                      location.pathname.startsWith(item.href));
                  return (
                    <motion.li
                      key={item.href}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: (baseDelay + itemIdx) * 0.04,
                        duration: 0.3,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      <Link
                        to={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                          isActive
                            ? "bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]"
                            : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]"
                        )}
                      >
                        <item.icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isActive && "text-[hsl(var(--primary))]"
                          )}
                        />
                        <span className="flex-1">{item.label}</span>
                        {item.badge !== undefined && item.badge > 0 && (
                          <motion.span
                            key={item.badge}
                            initial={{ scale: 0.6, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
                          >
                            {item.badge > 99 ? "99+" : item.badge}
                          </motion.span>
                        )}
                        {isActive && (
                          <ChevronRight className="h-3 w-3 text-[hsl(var(--primary))]" />
                        )}
                      </Link>
                    </motion.li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* User info card */}
      <div className="border-t border-[hsl(var(--border))] p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))]/20 text-sm font-bold text-[hsl(var(--primary))]">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-[hsl(var(--foreground))]">
              {user?.name}
            </div>
            {user?.department ? (
              <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                {user.department}
              </div>
            ) : (
              <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                {user?.email}
              </div>
            )}
            <span className="mt-1 inline-flex items-center rounded-full bg-[hsl(var(--primary))]/15 px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--primary))]">
              {ROLE_LABELS[userRole] ?? userRole}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-[hsl(var(--muted-foreground))] hover:bg-red-500/10 hover:text-red-400"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );

  // Build breadcrumb
  const pathParts = location.pathname.split("/").filter(Boolean);
  const breadcrumbs = pathParts.map((part, i) => ({
    label: part.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    href: "/" + pathParts.slice(0, i + 1).join("/"),
  }));

  return (
    <div className="flex h-screen overflow-hidden bg-[hsl(var(--background))]">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] lg:block">
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-transform lg:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="absolute right-2 top-2">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Sidebar />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Breadcrumb */}
            <nav className="flex items-center gap-1 text-sm">
              {breadcrumbs.map((crumb, i) => (
                <span key={crumb.href} className="flex items-center gap-1">
                  {i > 0 && (
                    <ChevronRight className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                  )}
                  <span
                    className={cn(
                      i === breadcrumbs.length - 1
                        ? "font-medium text-[hsl(var(--foreground))]"
                        : "text-[hsl(var(--muted-foreground))]"
                    )}
                  >
                    {crumb.label}
                  </span>
                </span>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={openCustomizer}
              title="Theme Studio"
            >
              <Palette className="h-4 w-4" />
            </Button>
            <NotificationPanel />

            {/* Profile dropdown */}
            <div ref={profileRef} className="relative">
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--primary))]/20 text-xs font-bold text-[hsl(var(--primary))] transition-all hover:bg-[hsl(var(--primary))]/30 hover:ring-2 hover:ring-[hsl(var(--primary))]/40 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40"
                aria-label="Open profile menu"
              >
                {initials}
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg"
                  >
                    {/* User info header */}
                    <div className="border-b border-[hsl(var(--border))] px-3 py-3">
                      <div className="text-sm font-medium text-[hsl(var(--foreground))] truncate">
                        {user?.name}
                      </div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                        {user?.email}
                      </div>
                      <span className="mt-1.5 inline-flex items-center rounded-full bg-[hsl(var(--primary))]/15 px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--primary))]">
                        {ROLE_LABELS[userRole] ?? userRole}
                      </span>
                    </div>

                    {/* Menu items */}
                    <div className="p-1">
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          navigate("/profile");
                        }}
                        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--secondary))]"
                      >
                        <User className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                        View Profile
                      </button>
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          void handleLogout();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      <ThemeCustomizer />
    </div>
  );
}
