import { useState } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useGetDashboardSummary, useListAnomalies } from "@/hooks/use-queries";
import { NotificationBell } from "@/components/notification-bell";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/constants";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: number;
  roles?: string[];
}

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const { data: summary } = useGetDashboardSummary();
  const { data: anomaliesData } = useListAnomalies({ severity: "critical", status: "active" });

  const criticalAnomalies = anomaliesData?.items.length ?? 0;
  const pendingApprovals = summary?.pending_approvals ?? 0;

  const navItems: NavItem[] = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    {
      label: "Approvals",
      icon: CheckSquare,
      href: "/approvals",
      badge: pendingApprovals,
      roles: ["system_admin", "management_l1", "management_authority"],
    },
    { label: "Stock Master", icon: Package, href: "/stocks" },
    { label: "Distributions", icon: ArrowRightLeft, href: "/distributions" },
    {
      label: "Anomalies",
      icon: AlertTriangle,
      href: "/anomalies",
      badge: criticalAnomalies,
    },
    { label: "AI Insights", icon: Brain, href: "/insights" },
    { label: "Reports", icon: BarChart3, href: "/reports" },
    {
      label: "Audit Log",
      icon: FileText,
      href: "/audit-log",
      roles: ["system_admin", "management_l1"],
    },
    {
      label: "Bulk Upload",
      icon: Upload,
      href: "/upload",
      roles: ["system_admin", "executive"],
    },
    {
      label: "Administration",
      icon: Settings,
      href: "/admin",
      roles: ["system_admin"],
    },
  ];

  const visibleNavItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(user?.role ?? "");
  });

  const userRole = user?.role ?? "";

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const Sidebar = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--primary))]">
          <Brain className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="text-sm font-bold text-white">Mavericks AI</div>
          <div className="text-xs text-[hsl(var(--muted-foreground))]">Inventory Intelligence</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {visibleNavItems.map((item) => {
            const isActive =
              location.pathname === item.href ||
              (item.href !== "/dashboard" && location.pathname.startsWith(item.href));
            return (
              <li key={item.href}>
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
                  <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-[hsl(var(--primary))]")} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                  {isActive && (
                    <ChevronRight className="h-3 w-3 text-[hsl(var(--primary))]" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User info */}
      <div className="border-t border-[hsl(var(--border))] p-4">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))]/20 text-sm font-bold text-[hsl(var(--primary))]">
            {user?.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
              {user?.name}
            </div>
            <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">
              {user?.email}
            </div>
            <span className="mt-1 inline-flex items-center rounded-full bg-[hsl(var(--primary))]/15 px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--primary))]">
              {ROLE_LABELS[userRole] ?? userRole}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-[hsl(var(--muted-foreground))] hover:text-red-400"
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
      <aside className="hidden w-64 shrink-0 border-r border-[hsl(var(--border))] lg:block">
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
          "fixed inset-y-0 left-0 z-50 w-64 border-r border-[hsl(var(--border))] bg-[hsl(var(--background))] transition-transform lg:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="absolute right-2 top-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
          >
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
                        ? "text-[hsl(var(--foreground))] font-medium"
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
            <NotificationBell />
            {/* Role indicator on mobile */}
            <span className="hidden rounded-full bg-[hsl(var(--primary))]/15 px-2 py-0.5 text-xs font-medium text-[hsl(var(--primary))] sm:inline-flex">
              {ROLE_LABELS[userRole] ?? userRole}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
