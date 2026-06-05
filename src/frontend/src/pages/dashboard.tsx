import { useNavigate, Navigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRightLeft,
  CheckSquare,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Upload,
  BarChart3,
  Plus,
  Clock,
  Activity,
  Users,
  Database,
  ChevronRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
  LineChart,
  Line,
} from "recharts";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  useGetDashboardSummary,
  useGetDashboardActivity,
  useGetSystemStats,
  useGetHealthScores,
} from "@/hooks/use-queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime, formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";


const CHART_TOOLTIP = {
  contentStyle: {
    backgroundColor: "hsl(var(--chart-tooltip-bg))",
    border: "1px solid hsl(var(--chart-tooltip-border))",
    borderRadius: "8px",
    color: "hsl(var(--chart-tooltip-text))",
    boxShadow: "0 8px 24px -6px rgba(0,0,0,0.4)",
  },
  labelStyle: { color: "hsl(var(--chart-text))", fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: "hsl(var(--chart-tooltip-text))" },
};

// ─── Shared editorial hero ────────────────────────────────────────────────────
// Inherits the visual language from the login page: eyebrow micro-label,
// large display heading with tight tracking, signature 5-color palette strip.

function DashboardHero({
  eyebrow,
  title,
  subtitle,
  highlight,
  actions,
  liveLabel,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  highlight?: string;
  actions?: React.ReactNode;
  liveLabel?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 backdrop-blur-sm"
      style={{
        boxShadow:
          "0 1px 0 0 hsl(var(--foreground) / 0.04) inset, 0 12px 32px -16px hsl(0 0% 0% / 0.5)",
      }}
    >
      {/* Ambient glow inside the hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, hsl(var(--primary) / 0.18), transparent 70%)",
          filter: "blur(20px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-20 h-64 w-64 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, hsl(var(--info) / 0.12), transparent 70%)",
          filter: "blur(24px)",
        }}
      />

      <div className="relative px-6 py-7 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <div
                className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--primary))]"
              >
                <Sparkles className="h-3 w-3" />
                {eyebrow}
              </div>
              {liveLabel && (
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                  <span
                    className="mvx-pulse-soft inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: "hsl(var(--success))" }}
                  />
                  {liveLabel}
                </div>
              )}
            </div>

            <h1
              className="numeral-display mt-5 text-3xl font-semibold leading-[1.05] tracking-[-0.025em] sm:text-[40px]"
            >
              {title}
              {highlight && (
                <>
                  {" "}
                  <span className="text-[hsl(var(--primary))]">{highlight}</span>
                </>
              )}
            </h1>

            {subtitle && (
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                {subtitle}
              </p>
            )}

            {/* Signature palette strip — same motif as login */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.25, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformOrigin: "left" }}
              className="mt-6 flex h-[3px] w-44 overflow-hidden rounded-full"
              aria-hidden
            >
              <div className="flex-1" style={{ background: "hsl(var(--foreground))" }} />
              <div className="flex-1" style={{ background: "hsl(var(--foreground) / 0.55)" }} />
              <div className="flex-1" style={{ background: "hsl(var(--muted-foreground))" }} />
              <div className="flex-1" style={{ background: "hsl(var(--primary))" }} />
              <div className="flex-1" style={{ background: "hsl(var(--primary) / 0.55)" }} />
            </motion.div>
          </div>

          {actions && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function useCountUp(target: number, duration = 900) {
  const [count, setCount] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (typeof target !== "number") return;
    const start = performance.now();
    const from = 0;
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(from + (target - from) * eased));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);

  return count;
}

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  color = "teal",
  onClick,
  index = 0,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: number; positive: boolean };
  color?: string;
  onClick?: () => void;
  index?: number;
}) {
  const colorMap: Record<string, string> = {
    primary: "bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]",
    teal:    "bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]",
    blue:    "bg-[hsl(var(--info))]/15 text-[hsl(var(--info))]",
    amber:   "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]",
    red:     "bg-[hsl(var(--destructive))]/15 text-[hsl(var(--destructive))]",
    green:   "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]",
    purple:  "bg-violet-500/20 text-violet-400",
  };

  const numericValue = typeof value === "number" ? value : NaN;
  const animated = useCountUp(isNaN(numericValue) ? 0 : numericValue);
  const displayValue = isNaN(numericValue) ? value : formatNumber(animated);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
    >
      <Card
        className={cn(
          "group relative overflow-hidden border-[hsl(var(--border))] bg-gradient-to-b from-[hsl(var(--card))] to-[hsl(var(--card))]/85 transition-all",
          onClick && "cursor-pointer hover:border-[hsl(var(--primary))]/40 hover:shadow-lg hover:shadow-[hsl(var(--primary))]/10"
        )}
        onClick={onClick}
      >
        {/* Subtle top hairline highlight */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(var(--foreground) / 0.08), transparent)",
          }}
        />
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                {title}
              </p>
              <p className="numeral-display mt-3 text-[34px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-[hsl(var(--foreground))]">
                {displayValue}
              </p>
              {trend && (
                <div className="mt-2 flex items-center gap-1 text-xs">
                  {trend.positive ? (
                    <TrendingUp className="h-3 w-3 text-[hsl(var(--success))]" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-[hsl(var(--destructive))]" />
                  )}
                  <span className={trend.positive ? "text-[hsl(var(--success))]" : "text-[hsl(var(--destructive))]"}>
                    {trend.value}% from last month
                  </span>
                </div>
              )}
            </div>
            <motion.div
              whileHover={{ rotate: 6, scale: 1.06 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                colorMap[color] ?? colorMap.primary
              )}
            >
              <Icon className="h-5 w-5" />
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Executive Dashboard ──────────────────────────────────────────────────────

function ExecutiveDashboard() {
  const navigate = useNavigate();
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: activity = [] } = useGetDashboardActivity();

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <DashboardHero
        eyebrow="EXECUTIVE WORKSPACE"
        title="Your distribution"
        highlight="overview."
        subtitle="Track every transaction you've initiated. Approve, audit, and renew with confidence."
        liveLabel="LIVE"
        actions={
          <>
            <Button size="sm" onClick={() => navigate("/distributions/new")}>
              <Plus className="h-4 w-4" />
              New Distribution
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/upload")}>
              <Upload className="h-4 w-4" />
              Upload
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/reports")}>
              <BarChart3 className="h-4 w-4" />
              Reports
            </Button>
          </>
        }
      />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          index={0}
          title="My Distributions"
          value={summary?.my_distributions ?? 0}
          icon={ArrowRightLeft}
          color="primary"
          onClick={() => navigate("/distributions")}
        />
        <StatCard
          index={1}
          title="Pending Approval"
          value={summary?.my_pending ?? 0}
          icon={Clock}
          color="amber"
          onClick={() => navigate("/distributions")}
        />
        <StatCard
          index={2}
          title="Approved"
          value={summary?.my_approved ?? 0}
          icon={CheckSquare}
          color="green"
        />
        <StatCard
          index={3}
          title="Rejected"
          value={summary?.my_rejected ?? 0}
          icon={AlertTriangle}
          color="red"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Stock Availability */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}>
          <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
            <CardHeader>
              <CardTitle className="text-base">Stock Availability (Top 5 Categories)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={summary?.top_distributed_items?.slice(0, 5) ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" />
                  <XAxis dataKey="stock_name" tick={{ fill: "hsl(var(--chart-text))", fontSize: 11 }} stroke="hsl(var(--chart-grid))" />
                  <YAxis tick={{ fill: "hsl(var(--chart-text))", fontSize: 11 }} stroke="hsl(var(--chart-grid))" />
                  <Tooltip {...CHART_TOOLTIP} />
                  <Bar dataKey="total_qty" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activity */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38, duration: 0.4 }}>
          <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
            <CardHeader>
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activity.slice(0, 6).map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.45 + i * 0.05, duration: 0.3 }}
                    className="flex items-start gap-3"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))]/15">
                      <Activity className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[hsl(var(--foreground))]">{item.description}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{formatRelativeTime(item.created_at)}</p>
                    </div>
                  </motion.div>
                ))}
                {activity.length === 0 && (
                  <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-8">No recent activity</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Resource charts (shared) ─────────────────────────────────────────────────

// Available stock vs the required minimum (reorder) level, per top stock.
// Surfaces where the org is short on resources at a glance.
function AvailableVsRequiredCard() {
  const { data: scores = [], isLoading } = useGetHealthScores();

  const data = [...scores]
    .sort((a, b) => b.min_level - a.min_level)
    .slice(0, 8)
    .map((s) => ({
      name: s.stock_name.length > 14 ? s.stock_name.slice(0, 13) + "…" : s.stock_name,
      Available: s.available_qty,
      Required: s.min_level,
      short: s.available_qty < s.min_level,
    }));

  const shortfalls = scores.filter((s) => s.available_qty < s.min_level).length;

  return (
    <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Resources: Available vs Required</CardTitle>
          {shortfalls > 0 && (
            <span className="rounded-full bg-[hsl(var(--destructive))]/15 px-2 py-0.5 text-xs font-medium text-[hsl(var(--destructive))]">
              {shortfalls} below minimum
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[240px]" />
        ) : data.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" />
              <XAxis dataKey="name" tick={{ fill: "hsl(var(--chart-text))", fontSize: 10 }} stroke="hsl(var(--chart-grid))" interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fill: "hsl(var(--chart-text))", fontSize: 11 }} stroke="hsl(var(--chart-grid))" />
              <Tooltip {...CHART_TOOLTIP} />
              <Legend wrapperStyle={{ fontSize: 12, color: "hsl(var(--chart-text))" }} />
              <Line
                type="monotone"
                dataKey="Available"
                stroke="hsl(var(--info))"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "hsl(var(--info))" }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="Required"
                stroke="hsl(var(--warning))"
                strokeWidth={2.5}
                strokeDasharray="5 4"
                dot={{ r: 3, fill: "hsl(var(--warning))" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[240px] items-center justify-center text-[hsl(var(--muted-foreground))]">
            No stock-level data
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Resource movement over time — distribution volume trend.
function ResourceFlowCard({ trend }: { trend: { date: string; count: number }[] }) {
  const data = (trend ?? []).map((t) => ({
    date: t.date?.slice(5) ?? t.date,
    Distributions: t.count,
  }));

  return (
    <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
      <CardHeader>
        <CardTitle className="text-base">Resource Flow (Distribution Trend)</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="flowFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" />
              <XAxis dataKey="date" tick={{ fill: "hsl(var(--chart-text))", fontSize: 10 }} stroke="hsl(var(--chart-grid))" />
              <YAxis tick={{ fill: "hsl(var(--chart-text))", fontSize: 11 }} stroke="hsl(var(--chart-grid))" allowDecimals={false} />
              <Tooltip {...CHART_TOOLTIP} />
              <Area type="monotone" dataKey="Distributions" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#flowFill)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[240px] items-center justify-center text-[hsl(var(--muted-foreground))]">
            No trend data yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Manager Dashboard ────────────────────────────────────────────────────────

function ManagerDashboard() {
  const navigate = useNavigate();
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: activity = [] } = useGetDashboardActivity();

  if (isLoading) return <DashboardSkeleton />;

  const healthData = [
    { name: "Healthy", value: summary?.stock_health_summary.healthy ?? 0, color: "hsl(var(--success))" },
    { name: "Warning", value: summary?.stock_health_summary.warning ?? 0, color: "hsl(var(--warning))" },
    { name: "Critical", value: summary?.stock_health_summary.critical ?? 0, color: "hsl(var(--destructive))" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <DashboardHero
        eyebrow="MANAGER WORKBENCH"
        title="Approval queue,"
        highlight="at a glance."
        subtitle="Pending decisions, surfaced anomalies, and stock health — everything you need to act on, in one view."
        liveLabel="LIVE"
      />

      {/* Pending approvals hero — editorial treatment */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ y: -2 }}
        onClick={() => navigate("/approvals")}
        className="group relative cursor-pointer overflow-hidden rounded-2xl border border-[hsl(var(--primary))]/30 bg-gradient-to-br from-[hsl(var(--primary))]/12 via-[hsl(var(--card))] to-[hsl(var(--card))] p-7 transition-colors hover:border-[hsl(var(--primary))]/55"
        style={{
          boxShadow:
            "0 1px 0 0 hsl(var(--foreground) / 0.05) inset, 0 12px 32px -16px hsl(0 0% 0% / 0.5)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, hsl(var(--primary) / 0.22), transparent 70%)",
            filter: "blur(18px)",
          }}
        />
        <div className="relative flex items-center justify-between gap-6">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--primary))]">
              PENDING APPROVALS
            </div>
            <p className="numeral-display mt-3 text-[64px] font-semibold leading-none tracking-[-0.04em] text-[hsl(var(--foreground))]">
              {summary?.pending_approvals ?? 0}
            </p>
            <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
              Avg.{" "}
              <span className="font-semibold text-[hsl(var(--foreground))]">
                {summary?.approval_velocity_hours?.toFixed(1) ?? "—"} hours
              </span>{" "}
              processing time (last 30 days)
            </p>
          </div>
          <div
            className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--primary))]/15 sm:flex"
            style={{ boxShadow: "0 8px 24px -8px hsl(var(--primary) / 0.45)" }}
          >
            <CheckSquare className="h-9 w-9 text-[hsl(var(--primary))]" />
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          index={0}
          title="Active Anomalies"
          value={summary?.active_anomalies ?? 0}
          icon={AlertTriangle}
          color="amber"
          onClick={() => navigate("/anomalies")}
        />
        <StatCard
          index={1}
          title="Critical Anomalies"
          value={summary?.critical_anomalies ?? 0}
          icon={AlertTriangle}
          color="red"
          onClick={() => navigate("/anomalies")}
        />
        <StatCard
          index={2}
          title="Total Distributions"
          value={summary?.total_distributions ?? 0}
          icon={ArrowRightLeft}
          color="primary"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Stock Health Pie */}
        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
          <CardHeader>
            <CardTitle className="text-base">Stock Health Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {healthData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={healthData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {healthData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip {...CHART_TOOLTIP} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[220px] items-center justify-center text-[hsl(var(--muted-foreground))]">No stock data</div>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
          <CardHeader>
            <CardTitle className="text-base">Recent Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activity.slice(0, 6).map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))]/15">
                    <Activity className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{item.description}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{formatRelativeTime(item.created_at)}</p>
                  </div>
                </div>
              ))}
              {activity.length === 0 && (
                <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resource availability charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AvailableVsRequiredCard />
        <ResourceFlowCard trend={summary?.transaction_trend ?? []} />
      </div>
    </div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

function AdminDashboard() {
  const navigate = useNavigate();
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: stats } = useGetSystemStats();
  const { data: activity = [] } = useGetDashboardActivity();

  if (isLoading) return <DashboardSkeleton />;

  const distByStatus = summary?.distribution_by_status ?? [];
  const DIST_COLORS = [
    "hsl(var(--muted-foreground))",
    "hsl(var(--info))",
    "hsl(var(--warning))",
    "hsl(var(--primary))",
    "hsl(var(--success))",
    "hsl(var(--destructive))",
  ];

  return (
    <div className="space-y-6">
      <DashboardHero
        eyebrow="SYSTEM ADMINISTRATION"
        title="Operations,"
        highlight="under control."
        subtitle="Service health, user activity, and the full audit trail — observed live across every subsystem."
        liveLabel="LIVE"
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard index={0} title="Total Users" value={stats?.total_users ?? 0} icon={Users} color="blue" />
        <StatCard index={1} title="Total Stocks" value={summary?.total_stocks ?? 0} icon={Database} color="primary" />
        <StatCard
          index={2}
          title="Pending Approvals"
          value={summary?.pending_approvals ?? 0}
          icon={CheckSquare}
          color="amber"
          onClick={() => navigate("/approvals")}
        />
        <StatCard
          index={3}
          title="Active Anomalies"
          value={summary?.active_anomalies ?? 0}
          icon={AlertTriangle}
          color="red"
          onClick={() => navigate("/anomalies")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Transaction breakdown */}
        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
          <CardHeader>
            <CardTitle className="text-base">Distribution by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {distByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={distByStatus} cx="50%" cy="50%" outerRadius={80} dataKey="count" nameKey="status">
                    {distByStatus.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={DIST_COLORS[index % DIST_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...CHART_TOOLTIP} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[220px] items-center justify-center text-[hsl(var(--muted-foreground))]">No data</div>
            )}
          </CardContent>
        </Card>

        {/* Top distributed items */}
        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
          <CardHeader>
            <CardTitle className="text-base">Top Distributed Items</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats?.top_distributed?.slice(0, 10) ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" />
                <XAxis dataKey="stock_name" tick={{ fill: "hsl(var(--chart-text))", fontSize: 10 }} stroke="hsl(var(--chart-grid))" />
                <YAxis tick={{ fill: "hsl(var(--chart-text))", fontSize: 11 }} stroke="hsl(var(--chart-grid))" />
                <Tooltip {...CHART_TOOLTIP} />
                <Bar dataKey="total_qty" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Resource availability charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AvailableVsRequiredCard />
        <ResourceFlowCard trend={summary?.transaction_trend ?? []} />
      </div>

      {/* Approval bottlenecks */}
      {stats?.pending_over_48h && stats.pending_over_48h.length > 0 && (
        <Card className="border-[hsl(var(--destructive))]/30 bg-[hsl(var(--card))]">
          <CardHeader>
            <CardTitle className="text-base text-[hsl(var(--destructive))]">Approval Bottlenecks (&gt;48h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.pending_over_48h.map((item) => (
                <button
                  key={item.transaction_code}
                  type="button"
                  onClick={() => navigate(`/approvals?q=${encodeURIComponent(item.transaction_code)}`)}
                  className="flex w-full items-center justify-between rounded-lg bg-[hsl(var(--destructive))]/8 px-3 py-2 text-left transition-colors hover:bg-[hsl(var(--destructive))]/15 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--destructive))]/40"
                  title="Open in Approval Workbench"
                >
                  <div>
                    <span className="text-sm font-medium">{item.transaction_code}</span>
                    <span className="ml-2 text-sm text-[hsl(var(--muted-foreground))]">{item.stock_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">by {item.submitted_by}</span>
                    <span className="rounded-full bg-[hsl(var(--destructive))]/15 px-2 py-0.5 text-xs font-medium text-[hsl(var(--destructive))]">
                      {item.hours_pending}h pending
                    </span>
                    <ChevronRight className="h-4 w-4 text-[hsl(var(--destructive))]" />
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent activity */}
      <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
        <CardHeader>
          <CardTitle className="text-base">Recent System Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {activity.slice(0, 8).map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-[hsl(var(--secondary))]/30">
                <Activity className="h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />
                <span className="flex-1 text-sm">{item.description}</span>
                <span className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]">
                  {formatRelativeTime(item.created_at)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { isAdmin, isManager, isL2, isUser } = useAuth();

  if (isUser) return <Navigate to="/my-assets" replace />;
  if (isAdmin) return <AdminDashboard />;
  if (isManager || isL2) return <ManagerDashboard />;
  return <ExecutiveDashboard />;
}
