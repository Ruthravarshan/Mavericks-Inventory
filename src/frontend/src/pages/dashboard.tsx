import { useNavigate } from "react-router-dom";
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
} from "recharts";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import {
  useGetDashboardSummary,
  useGetDashboardActivity,
  useGetSystemHealth,
  useGetSystemStats,
} from "@/hooks/use-queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HealthBadge } from "@/components/health-badge";
import { formatRelativeTime, formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

const COLORS = ["#14b8a6", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  color = "teal",
  onClick,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: number; positive: boolean };
  color?: string;
  onClick?: () => void;
}) {
  const colorMap: Record<string, string> = {
    teal: "bg-teal-500/20 text-teal-400",
    blue: "bg-blue-500/20 text-blue-400",
    amber: "bg-amber-500/20 text-amber-400",
    red: "bg-red-500/20 text-red-400",
    green: "bg-green-500/20 text-green-400",
    purple: "bg-purple-500/20 text-purple-400",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        className={cn(
          "bg-slate-800/50 border-slate-700/50",
          onClick && "cursor-pointer hover:border-[hsl(var(--primary))]/40 transition-colors"
        )}
        onClick={onClick}
      >
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{title}</p>
              <p className="mt-2 text-3xl font-bold text-[hsl(var(--foreground))]">
                {typeof value === "number" ? formatNumber(value) : value}
              </p>
              {trend && (
                <div className="mt-1 flex items-center gap-1 text-xs">
                  {trend.positive ? (
                    <TrendingUp className="h-3 w-3 text-green-400" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-400" />
                  )}
                  <span className={trend.positive ? "text-green-400" : "text-red-400"}>
                    {trend.value}% from last month
                  </span>
                </div>
              )}
            </div>
            <div className={cn("rounded-lg p-3", colorMap[color] ?? colorMap.teal)}>
              <Icon className="h-5 w-5" />
            </div>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Executive Dashboard</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Your distribution overview</p>
        </div>
        <div className="flex gap-2">
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
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="My Distributions"
          value={summary?.my_distributions ?? 0}
          icon={ArrowRightLeft}
          color="teal"
          onClick={() => navigate("/distributions")}
        />
        <StatCard
          title="Pending Approval"
          value={summary?.my_pending ?? 0}
          icon={Clock}
          color="amber"
          onClick={() => navigate("/distributions")}
        />
        <StatCard
          title="Approved"
          value={summary?.my_approved ?? 0}
          icon={CheckSquare}
          color="green"
        />
        <StatCard
          title="Rejected"
          value={summary?.my_rejected ?? 0}
          icon={AlertTriangle}
          color="red"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Stock Availability */}
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-base">Stock Availability (Top 5 Categories)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={summary?.top_distributed_items?.slice(0, 5) ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="stock_name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                />
                <Bar dataKey="total_qty" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activity.slice(0, 6).map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))]/15">
                    <Activity className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[hsl(var(--foreground))]">{item.description}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{formatRelativeTime(item.created_at)}</p>
                  </div>
                </div>
              ))}
              {activity.length === 0 && (
                <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-8">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Manager Dashboard ────────────────────────────────────────────────────────

function ManagerDashboard() {
  const navigate = useNavigate();
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: activity = [] } = useGetDashboardActivity();

  if (isLoading) return <DashboardSkeleton />;

  const healthData = [
    { name: "Healthy", value: summary?.stock_health_summary.healthy ?? 0, color: "#22c55e" },
    { name: "Warning", value: summary?.stock_health_summary.warning ?? 0, color: "#eab308" },
    { name: "Critical", value: summary?.stock_health_summary.critical ?? 0, color: "#ef4444" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manager Dashboard</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Approval queue and anomaly overview</p>
        </div>
      </div>

      {/* Pending approvals hero */}
      <div
        className="cursor-pointer rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 transition-colors hover:border-amber-500/50"
        onClick={() => navigate("/approvals")}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-amber-400">Pending Approvals</p>
            <p className="mt-1 text-5xl font-bold text-white">{summary?.pending_approvals ?? 0}</p>
            <p className="mt-2 text-sm text-slate-400">
              Avg. {summary?.approval_velocity_hours?.toFixed(1) ?? "—"} hours processing time (30 days)
            </p>
          </div>
          <CheckSquare className="h-16 w-16 text-amber-500/30" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Active Anomalies"
          value={summary?.active_anomalies ?? 0}
          icon={AlertTriangle}
          color="amber"
          onClick={() => navigate("/anomalies")}
        />
        <StatCard
          title="Critical Anomalies"
          value={summary?.critical_anomalies ?? 0}
          icon={AlertTriangle}
          color="red"
          onClick={() => navigate("/anomalies")}
        />
        <StatCard
          title="Total Distributions"
          value={summary?.total_distributions ?? 0}
          icon={ArrowRightLeft}
          color="teal"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Stock Health Pie */}
        <Card className="bg-slate-800/50 border-slate-700/50">
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
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[220px] items-center justify-center text-[hsl(var(--muted-foreground))]">No stock data</div>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="bg-slate-800/50 border-slate-700/50">
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
    </div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

function AdminDashboard() {
  const navigate = useNavigate();
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: systemHealth } = useGetSystemHealth();
  const { data: stats } = useGetSystemStats();
  const { data: activity = [] } = useGetDashboardActivity();

  if (isLoading) return <DashboardSkeleton />;

  const statusColor = {
    healthy: "text-green-400 bg-green-500/20",
    degraded: "text-yellow-400 bg-yellow-500/20",
    down: "text-red-400 bg-red-500/20",
  };

  const distByStatus = summary?.distribution_by_status ?? [];
  const DIST_COLORS = ["#6b7280", "#0ea5e9", "#f59e0b", "#f97316", "#22c55e", "#ef4444"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">System overview and health</p>
        </div>
      </div>

      {/* System Health */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-base">System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {systemHealth?.services.map((svc) => (
              <div key={svc.name} className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{svc.name}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusColor[svc.status])}>
                    {svc.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{svc.response_time_ms}ms</p>
              </div>
            )) ?? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={stats?.total_users ?? 0} icon={Users} color="blue" />
        <StatCard title="Total Stocks" value={summary?.total_stocks ?? 0} icon={Database} color="teal" />
        <StatCard
          title="Pending Approvals"
          value={summary?.pending_approvals ?? 0}
          icon={CheckSquare}
          color="amber"
          onClick={() => navigate("/approvals")}
        />
        <StatCard
          title="Active Anomalies"
          value={summary?.active_anomalies ?? 0}
          icon={AlertTriangle}
          color="red"
          onClick={() => navigate("/anomalies")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Transaction breakdown */}
        <Card className="bg-slate-800/50 border-slate-700/50">
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
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[220px] items-center justify-center text-[hsl(var(--muted-foreground))]">No data</div>
            )}
          </CardContent>
        </Card>

        {/* Top distributed items */}
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-base">Top Distributed Items</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats?.top_distributed?.slice(0, 10) ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="stock_name" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }} />
                <Bar dataKey="total_qty" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Approval bottlenecks */}
      {stats?.pending_over_48h && stats.pending_over_48h.length > 0 && (
        <Card className="bg-slate-800/50 border-red-500/20 border">
          <CardHeader>
            <CardTitle className="text-base text-red-400">Approval Bottlenecks (&gt;48h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.pending_over_48h.map((item) => (
                <div key={item.transaction_code} className="flex items-center justify-between rounded-lg bg-red-500/5 px-3 py-2">
                  <div>
                    <span className="text-sm font-medium">{item.transaction_code}</span>
                    <span className="ml-2 text-sm text-[hsl(var(--muted-foreground))]">{item.stock_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">by {item.submitted_by}</span>
                    <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
                      {item.hours_pending}h pending
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent activity */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-base">Recent System Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {activity.slice(0, 8).map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-700/30">
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
  const { isAdmin, isManager, isL2 } = useAuth();

  if (isAdmin) return <AdminDashboard />;
  if (isManager || isL2) return <ManagerDashboard />;
  return <ExecutiveDashboard />;
}
