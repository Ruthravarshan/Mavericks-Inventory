import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Laptop,
  AlertTriangle,
  Clock,
  Calendar,
  MapPin,
  Building2,
  Loader2,
  Shield,
  Tag,
  Hash,
  RotateCcw,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { employeesApi } from "@/lib/api";
import { QUERY_KEYS, CONDITION_COLORS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { EmployeeAsset } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarBg(name: string): string {
  const palettes = [
    "bg-blue-500/20 text-blue-400",
    "bg-purple-500/20 text-purple-400",
    "bg-emerald-500/20 text-emerald-400",
    "bg-amber-500/20 text-amber-400",
    "bg-rose-500/20 text-rose-400",
    "bg-cyan-500/20 text-cyan-400",
    "bg-indigo-500/20 text-indigo-400",
    "bg-orange-500/20 text-orange-400",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palettes[Math.abs(hash) % palettes.length];
}

function getCategoryIcon(category: string): string {
  if (category === "Laptop" || category === "Desktop") return "💻";
  if (category === "Monitor") return "🖥️";
  if (category === "Mobile Phone") return "📱";
  if (category === "Software License") return "📋";
  if (category === "ID Card" || category === "Access Card") return "🪪";
  if (category === "Networking") return "🌐";
  return "⚙️";
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonHero() {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
      <div className="flex items-start gap-5">
        <div className="h-20 w-20 animate-pulse rounded-full bg-[hsl(var(--secondary))]" />
        <div className="flex-1 space-y-3">
          <div className="h-6 w-1/3 animate-pulse rounded bg-[hsl(var(--secondary))]" />
          <div className="h-4 w-1/4 animate-pulse rounded bg-[hsl(var(--secondary))]" />
          <div className="flex gap-2">
            <div className="h-5 w-24 animate-pulse rounded-full bg-[hsl(var(--secondary))]" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-[hsl(var(--secondary))]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonAssetCard() {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 animate-pulse rounded-lg bg-[hsl(var(--secondary))]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/5 animate-pulse rounded bg-[hsl(var(--secondary))]" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-[hsl(var(--secondary))]" />
          <div className="flex gap-2">
            <div className="h-5 w-16 animate-pulse rounded-full bg-[hsl(var(--secondary))]" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-[hsl(var(--secondary))]" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Asset Card ───────────────────────────────────────────────────────────────

function AssetCard({ asset, isPast = false }: { asset: EmployeeAsset; isPast?: boolean }) {
  const now = new Date();
  const isExpired = asset.validity_date && new Date(asset.validity_date) < now;
  const isExpiringSoon =
    asset.days_to_expiry !== null && asset.days_to_expiry > 0 && asset.days_to_expiry <= 30;
  const isAuditOverdue = asset.audit_overdue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 transition-colors ${
        isPast ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Category icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--secondary))] text-xl">
          {getCategoryIcon(asset.category)}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Model + badges */}
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-[hsl(var(--foreground))]">
              {asset.brand ? `${asset.brand} ` : ""}
              {asset.model ?? asset.category}
            </p>
            {/* Condition badge with dot */}
            <div className="flex items-center gap-1">
              <span
                className={`h-2 w-2 rounded-full ${
                  asset.condition === "new"
                    ? "bg-emerald-400"
                    : asset.condition === "good"
                    ? "bg-green-400"
                    : asset.condition === "fair"
                    ? "bg-yellow-400"
                    : asset.condition === "poor"
                    ? "bg-orange-400"
                    : "bg-red-400"
                }`}
              />
              <Badge className={CONDITION_COLORS[asset.condition]} variant="outline">
                {asset.condition}
              </Badge>
            </div>
          </div>

          {/* Asset tag + serial */}
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
            <span className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              <span className="font-mono font-semibold text-[hsl(var(--foreground))]/70">
                {asset.asset_tag}
              </span>
            </span>
            {asset.serial_number && (
              <span className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                {asset.serial_number}
              </span>
            )}
            {asset.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {asset.location}
              </span>
            )}
          </div>

          {/* Status badges row */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {isPast && (
              <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30" variant="outline">
                <RotateCcw className="mr-1 h-3 w-3" />
                {asset.status === "returned" ? "Returned" : "Past"}
              </Badge>
            )}
            {isExpired && !isPast && (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30" variant="outline">
                Expired
              </Badge>
            )}
            {isExpiringSoon && !isExpired && !isPast && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30" variant="outline">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Expiring in {asset.days_to_expiry}d
              </Badge>
            )}
            {isAuditOverdue && !isPast && (
              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30" variant="outline">
                <Clock className="mr-1 h-3 w-3" />
                Audit Overdue
              </Badge>
            )}
          </div>

          {/* Date details */}
          <div className="mt-2.5 flex flex-wrap gap-3 text-xs text-[hsl(var(--muted-foreground))]">
            {asset.assigned_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Assigned: {new Date(asset.assigned_date).toLocaleDateString()}
              </span>
            )}
            {asset.validity_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Valid until: {new Date(asset.validity_date).toLocaleDateString()}
              </span>
            )}
            {asset.warranty_expiry && (
              <span className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Warranty: {new Date(asset.warranty_expiry).toLocaleDateString()}
              </span>
            )}
            {asset.next_audit_due && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Next audit: {new Date(asset.next_audit_due).toLocaleDateString()}
              </span>
            )}
            {asset.last_audit_date && (
              <span className="flex items-center gap-1">
                Last audited: {new Date(asset.last_audit_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: assetsData, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.EMPLOYEES, id, "assets"],
    queryFn: () => employeesApi.getAssets(id!).then((r) => r.data),
    enabled: !!id,
  });

  const employeeAssets = assetsData?.items ?? [];
  const activeAssets = employeeAssets.filter((a) => a.status === "active");
  const pastAssets = employeeAssets.filter((a) => a.status !== "active");
  const auditOverdueCount = activeAssets.filter((a) => a.audit_overdue).length;
  const expiringCount = activeAssets.filter(
    (a) => a.days_to_expiry !== null && a.days_to_expiry <= 30 && a.days_to_expiry > 0
  ).length;

  // Try to derive name from asset data as fallback
  // The employee name is not directly in assetsData, so we use a generic placeholder
  const employeeName = (assetsData as { employee_name?: string })?.employee_name ?? "Employee";
  const employeeEmail = (assetsData as { employee_email?: string })?.employee_email;
  const department = (assetsData as { department?: string })?.department;
  const designation = (assetsData as { designation?: string })?.designation;
  const location = (assetsData as { location?: string })?.location;
  const employeeId = (assetsData as { employee_id?: string })?.employee_id;
  const onboardingDate = (assetsData as { onboarding_date?: string })?.onboarding_date;

  const avatarClass = getAvatarBg(employeeName);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/employees")}
          className="gap-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Employees
        </Button>
      </div>

      {/* Hero section */}
      {isLoading ? (
        <SkeletonHero />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"
        >
          <div className="flex flex-wrap items-start gap-5">
            {/* Avatar */}
            <div
              className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-2xl font-bold ${avatarClass}`}
            >
              {getInitials(employeeName)}
            </div>

            {/* Name + info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{employeeName}</h1>
              {designation && (
                <p className="mt-0.5 text-[hsl(var(--muted-foreground))]">{designation}</p>
              )}
              {employeeEmail && (
                <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">{employeeEmail}</p>
              )}

              {/* Info chips */}
              <div className="mt-3 flex flex-wrap gap-2">
                {department && (
                  <span className="flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-1 text-sm text-[hsl(var(--muted-foreground))]">
                    <Building2 className="h-3.5 w-3.5" />
                    {department}
                  </span>
                )}
                {location && (
                  <span className="flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-1 text-sm text-[hsl(var(--muted-foreground))]">
                    <MapPin className="h-3.5 w-3.5" />
                    {location}
                  </span>
                )}
                {employeeId && (
                  <span className="flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-1 font-mono text-xs text-[hsl(var(--muted-foreground))]">
                    {employeeId}
                  </span>
                )}
                {onboardingDate && (
                  <span className="flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-1 text-sm text-[hsl(var(--muted-foreground))]">
                    <Calendar className="h-3.5 w-3.5" />
                    Joined {new Date(onboardingDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                  </span>
                )}
              </div>

              {/* Inline stats */}
              <div className="mt-4 flex flex-wrap gap-4 border-t border-[hsl(var(--border))] pt-4">
                <div className="text-center">
                  <p className="text-xl font-bold text-[hsl(var(--foreground))]">{activeAssets.length}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Active Assets</p>
                </div>
                <div className="w-px bg-[hsl(var(--border))]" />
                <div className="text-center">
                  <p
                    className={`text-xl font-bold ${
                      auditOverdueCount > 0 ? "text-red-400" : "text-[hsl(var(--foreground))]"
                    }`}
                  >
                    {auditOverdueCount}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Audit Overdue</p>
                </div>
                <div className="w-px bg-[hsl(var(--border))]" />
                <div className="text-center">
                  <p
                    className={`text-xl font-bold ${
                      expiringCount > 0 ? "text-amber-400" : "text-[hsl(var(--foreground))]"
                    }`}
                  >
                    {expiringCount}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Expiring Soon</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Asset sections */}
      {isLoading ? (
        <div className="space-y-3">
          <div className="h-5 w-40 animate-pulse rounded bg-[hsl(var(--secondary))]" />
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonAssetCard key={i} />
          ))}
        </div>
      ) : activeAssets.length === 0 && pastAssets.length === 0 ? (
        <Card className="border-dashed border-[hsl(var(--border))]">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--secondary))]">
              <Laptop className="h-7 w-7 text-[hsl(var(--muted-foreground))]/50" />
            </div>
            <div className="text-center">
              <p className="font-medium text-[hsl(var(--foreground))]">No assets assigned</p>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                This employee has no current or past asset assignments
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Active assignments */}
          {activeAssets.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  Currently Assigned
                </h2>
                <span className="rounded-full bg-[hsl(var(--primary))]/15 px-2 py-0.5 text-xs font-semibold text-[hsl(var(--primary))]">
                  {activeAssets.length}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {activeAssets.map((asset) => (
                  <AssetCard key={asset.assignment_id} asset={asset} />
                ))}
              </div>
            </div>
          )}

          {/* Past assignments */}
          {pastAssets.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  Past Assignments
                </h2>
                <span className="rounded-full bg-[hsl(var(--secondary))] px-2 py-0.5 text-xs font-semibold text-[hsl(var(--muted-foreground))]">
                  {pastAssets.length}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {pastAssets.map((asset) => (
                  <AssetCard key={asset.assignment_id} asset={asset} isPast />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
