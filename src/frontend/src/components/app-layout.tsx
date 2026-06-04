import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  LogOut,
  Menu,
  X,
  ChevronRight,
  User,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import {
  useGetDashboardSummary,
  useListAnomalies,
  useGetNavVisibility,
} from "@/hooks/use-queries";
import { NotificationPanel } from "@/components/notification-panel";
import { ThemeCustomizer } from "@/components/theme-customizer";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/constants";
import { getRoleNav, type BadgeKey } from "@/lib/nav";

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
  const { data: navVisibility } = useGetNavVisibility();

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

  // Badge counts injected into shared nav definitions by key.
  const badges: Record<BadgeKey, number> = {
    pendingApprovals,
    criticalAnomalies,
  };

  // Admin-controlled per-role tab visibility (server-persisted). Items whose
  // href is in the role's hidden list are removed; empty sections are dropped.
  const hiddenForRole = navVisibility?.[userRole] ?? [];

  const sections = getRoleNav(userRole)
    .map((section) => ({
      label: section.label,
      items: section.items
        .filter((item) => !hiddenForRole.includes(item.href))
        .map((item) => ({
          label: item.label,
          icon: item.icon,
          href: item.href,
          badge: item.badgeKey ? badges[item.badgeKey] : undefined,
        })),
    }))
    .filter((section) => section.items.length > 0);

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
      <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] px-5 py-4">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{
            background: "hsl(var(--primary))",
            boxShadow: "0 4px 12px -4px hsl(var(--primary) / 0.5)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden>
            <path
              d="M9 22V10l7 8 7-8v12"
              stroke="hsl(var(--primary-foreground))"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div
            style={{ letterSpacing: "0.14em", fontSize: "13px", fontWeight: 700, lineHeight: 1 }}
            className="text-[hsl(var(--foreground))]"
          >
            MAVERICKS
          </div>
          <div
            style={{ letterSpacing: "0.16em", fontSize: "9px", marginTop: "4px" }}
            className="text-[hsl(var(--muted-foreground))]/70 uppercase font-semibold"
          >
            Asset Intelligence
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section, sectionIdx) => (
          <div key={section.label} className={sectionIdx > 0 ? "mt-4" : undefined}>
            <div className="mb-1.5 px-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]/60">
                {section.label}
              </span>
            </div>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const hrefPath = item.href.split("?")[0];
                const hrefQuery = item.href.includes("?") ? item.href.split("?")[1] : "";
                const isActive = item.href.includes("?")
                  ? location.pathname === hrefPath && location.search === "?" + hrefQuery
                  : location.pathname === hrefPath ||
                    (hrefPath !== "/dashboard" && location.pathname.startsWith(hrefPath));
                return (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors duration-150",
                        isActive
                          ? "bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))]"
                          : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]"
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[hsl(var(--primary))]" />
                      )}
                      <item.icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          isActive
                            ? "text-[hsl(var(--primary))]"
                            : "text-[hsl(var(--muted-foreground))]/80 group-hover:text-[hsl(var(--foreground))]"
                        )}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[hsl(var(--destructive))] px-1.5 text-[10px] font-bold text-white shadow-[0_2px_6px_-2px_hsl(var(--destructive)_/_0.6)]">
                          {item.badge > 99 ? "99+" : item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
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
      <aside className="hidden w-64 shrink-0 border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]/40 backdrop-blur-sm lg:block">
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
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/85 backdrop-blur-md px-4 sticky top-0 z-30">
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
        <main className="relative flex-1 overflow-y-auto p-6">
          {/* Ambient backdrop — mirrors the login glow, but very subtle */}
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 -z-10"
            style={{
              background: `
                radial-gradient(900px 600px at 88% -10%, hsl(var(--primary) / 0.06), transparent 60%),
                radial-gradient(700px 500px at -10% 110%, hsl(var(--info) / 0.05), transparent 65%)
              `,
            }}
          />
          <Outlet />
        </main>
      </div>

      <ThemeCustomizer />
    </div>
  );
}
