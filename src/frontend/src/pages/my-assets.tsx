import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Laptop,
  Shield,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Camera,
  Package,
  Loader2,
  Plus,
  RefreshCw,
  MapPin,
  Brain,
  Star,
  FileCheck,
  XCircle,
  TrendingUp,
  ClipboardList,
  Eye,
  Calendar,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { myAssetsApi, requestsApi } from "@/lib/api";
import { QUERY_KEYS, CONDITION_COLORS, PRIORITY_COLORS, AUDIT_STATUS_COLORS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import type { MyAsset, AssetRequest, AssetAudit } from "@/types";

// ─── Category icons ──────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  Laptop: "💻",
  Desktop: "🖥️",
  Monitor: "🖥",
  "Mobile Phone": "📱",
  Peripherals: "🖱️",
  Networking: "🌐",
  Server: "🗄️",
  Storage: "💾",
  "Software License": "📋",
  "Access Card": "🪪",
  "ID Card": "🪪",
  "Power Equipment": "🔌",
  Cables: "🔗",
  "Other IT Equipment": "⚙️",
};

// ─── Framer Motion variants ───────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 260, damping: 22 } },
};

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonAssetCard() {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-full bg-[hsl(var(--secondary))]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-[hsl(var(--secondary))]" />
          <div className="h-3 w-1/2 rounded bg-[hsl(var(--secondary))]" />
          <div className="flex gap-2">
            <div className="h-5 w-16 rounded-full bg-[hsl(var(--secondary))]" />
            <div className="h-5 w-20 rounded-full bg-[hsl(var(--secondary))]" />
          </div>
        </div>
      </div>
      <div className="mt-4 border-t border-[hsl(var(--border))] pt-3">
        <div className="h-7 w-24 rounded-lg bg-[hsl(var(--secondary))]" />
      </div>
    </div>
  );
}

// ─── Asset Card ───────────────────────────────────────────────────────────────

function AssetCard({ asset, onAudit }: { asset: MyAsset; onAudit: (a: MyAsset) => void }) {
  const icon = CATEGORY_ICONS[asset.category] ?? "📦";

  const daysToValidity = asset.validity_date
    ? Math.ceil((new Date(asset.validity_date).getTime() - Date.now()) / 86_400_000)
    : null;

  const daysToAudit = asset.next_audit_due
    ? Math.ceil((new Date(asset.next_audit_due).getTime() - Date.now()) / 86_400_000)
    : null;

  const validityBadge = (() => {
    if (asset.validity_status === "expired")
      return { text: "Expired", cls: "bg-red-500/15 text-red-400 border-red-500/30" };
    if (asset.validity_status === "expiring_soon")
      return {
        text: `Expires in ${daysToValidity}d`,
        cls: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      };
    return { text: "Valid", cls: "bg-green-500/15 text-green-400 border-green-500/30" };
  })();

  const auditBadge = (() => {
    if (asset.audit_status === "overdue")
      return { text: "Audit Overdue", cls: "bg-red-500/15 text-red-400 border-red-500/30", icon: AlertTriangle };
    if (asset.audit_status === "due_soon")
      return {
        text: `Due in ${daysToAudit}d`,
        cls: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        icon: Clock,
      };
    return { text: "Up to date", cls: "bg-green-500/15 text-green-400 border-green-500/30", icon: CheckCircle2 };
  })();

  const AuditIcon = auditBadge.icon;

  return (
    <motion.div
      variants={cardVariants}
      className="group relative flex flex-col rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden transition-all hover:border-[hsl(var(--primary))]/40 hover:shadow-lg hover:shadow-[hsl(var(--primary))]/5"
    >
      {/* Accent line top */}
      <div
        className={`h-0.5 w-full ${
          asset.validity_status === "expired"
            ? "bg-red-500"
            : asset.validity_status === "expiring_soon" || asset.audit_status === "overdue"
            ? "bg-amber-500"
            : "bg-[hsl(var(--primary))]"
        }`}
      />

      <div className="flex-1 p-5">
        {/* Header row */}
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10 text-3xl">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold leading-tight text-[hsl(var(--foreground))]">
                {asset.brand ? `${asset.brand} ` : ""}
                {asset.model ?? asset.category}
              </h3>
              <Badge className={`${CONDITION_COLORS[asset.condition]} shrink-0 text-xs`} variant="outline">
                {asset.condition}
              </Badge>
            </div>

            {/* Asset tag code badge */}
            <span className="mt-1 inline-block rounded-md bg-[hsl(var(--primary))]/10 px-2 py-0.5 font-mono text-xs font-medium text-[hsl(var(--primary))]">
              {asset.asset_tag}
            </span>
          </div>
        </div>

        {/* Meta chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-md bg-[hsl(var(--secondary))] px-2 py-0.5 text-xs text-[hsl(var(--muted-foreground))]">
            {asset.category}
            {asset.sub_category ? ` / ${asset.sub_category}` : ""}
          </span>
          {asset.location && (
            <span className="flex items-center gap-1 rounded-md bg-[hsl(var(--secondary))] px-2 py-0.5 text-xs text-[hsl(var(--muted-foreground))]">
              <MapPin className="h-3 w-3" />
              {asset.location}
            </span>
          )}
        </div>

        {/* Status badges row */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${validityBadge.cls}`}>
            <Shield className="h-3 w-3" />
            {validityBadge.text}
          </span>
          <span className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${auditBadge.cls}`}>
            <AuditIcon className="h-3 w-3" />
            {auditBadge.text}
          </span>
        </div>

        {/* Extra info */}
        <div className="mt-3 space-y-1">
          {asset.serial_number && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              <span className="font-medium">S/N:</span> {asset.serial_number}
            </p>
          )}
          {asset.warranty_expiry && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              <span className="font-medium">Warranty:</span>{" "}
              {new Date(asset.warranty_expiry).toLocaleDateString()}
            </p>
          )}
          {asset.validity_date && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              <span className="font-medium">Valid until:</span>{" "}
              {new Date(asset.validity_date).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/30 px-5 py-3">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {asset.assigned_date
            ? `Assigned ${new Date(asset.assigned_date).toLocaleDateString()}`
            : "Assignment date unknown"}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onAudit(asset)}
          className="h-7 gap-1.5 text-xs"
        >
          <Camera className="h-3 w-3" />
          Submit Audit
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Assets empty state ───────────────────────────────────────────────────────

function AssetsEmptyState({ onRaise }: { onRaise: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] py-20 text-center"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10">
        <Package className="h-10 w-10 text-[hsl(var(--primary))]/60" />
      </div>
      <div>
        <p className="text-lg font-semibold text-[hsl(var(--foreground))]">No assets assigned yet</p>
        <p className="mt-1 max-w-xs text-sm text-[hsl(var(--muted-foreground))]">
          IT assets assigned to you will appear here. Raise a request if you need equipment.
        </p>
      </div>
      <Button onClick={onRaise} className="mt-1 gap-2">
        <Plus className="h-4 w-4" />
        Raise a Request
      </Button>
    </motion.div>
  );
}

// ─── Request Card (for My Requests tab) ──────────────────────────────────────

const REQUEST_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }>; step: number }
> = {
  pending:   { label: "Pending Review", color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: Clock, step: 1 },
  approved:  { label: "Approved", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: CheckCircle2, step: 2 },
  rejected:  { label: "Rejected", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle, step: -1 },
  fulfilled: { label: "Fulfilled", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: Star, step: 3 },
  cancelled: { label: "Cancelled", color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: XCircle, step: -1 },
};

const PRIORITY_LEFT_BORDER: Record<string, string> = {
  low: "border-l-slate-400",
  normal: "border-l-blue-400",
  urgent: "border-l-amber-400",
  critical: "border-l-red-500",
};

const PRIORITY_HINT: Record<string, string> = {
  low: "Usually fulfilled within 5–7 business days",
  normal: "Usually fulfilled within 3–5 business days",
  urgent: "Usually fulfilled within 1–2 business days",
  critical: "Expedited — same or next business day",
};

const PROGRESS_STEPS = ["Submitted", "Under Review", "Decision", "Fulfilled"] as const;

function RequestProgressBar({ status }: { status: string }) {
  const cfg = REQUEST_STATUS_CONFIG[status];
  const rejected = status === "rejected" || status === "cancelled";
  const currentStep = rejected ? 2 : (cfg?.step ?? 0);

  return (
    <div className="mb-4 flex items-center gap-1.5">
      {PROGRESS_STEPS.map((label, idx) => {
        const stepNum = idx + 1; // 1-indexed match to cfg.step
        const done = !rejected && currentStep >= stepNum;
        const current = !rejected && currentStep === stepNum - 1 + 1; // same as stepNum
        const isRejectedStep = rejected && stepNum === 3;

        return (
          <div key={label} className="flex flex-1 items-center gap-1.5">
            <div className="flex flex-col items-center gap-0.5 min-w-0">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                  isRejectedStep
                    ? "bg-red-500/20 text-red-400"
                    : done
                    ? "bg-[hsl(var(--primary))] text-white"
                    : current
                    ? "border-2 border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
                    : "border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
                }`}
              >
                {isRejectedStep ? "✕" : done ? "✓" : stepNum}
              </div>
              <span className="hidden text-[9px] text-[hsl(var(--muted-foreground))] sm:block truncate max-w-[56px] text-center">
                {label}
              </span>
            </div>
            {idx < PROGRESS_STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 rounded-full transition-colors ${
                  done && !rejected ? "bg-[hsl(var(--primary))]" : "bg-[hsl(var(--border))]"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function RequestCard({ request }: { request: AssetRequest }) {
  const cfg = REQUEST_STATUS_CONFIG[request.status] ?? REQUEST_STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  const leftBorder = PRIORITY_LEFT_BORDER[request.priority] ?? "border-l-[hsl(var(--border))]";

  return (
    <motion.div
      variants={cardVariants}
      className={`rounded-xl border border-[hsl(var(--border))] border-l-4 ${leftBorder} bg-[hsl(var(--card))] p-5`}
    >
      <RequestProgressBar status={request.status} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cfg.color.split(" ")[0]}`}
          >
            <Icon className={`h-4 w-4 ${cfg.color.split(" ")[1]}`} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[hsl(var(--foreground))] leading-snug">
              {request.item_description}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
                {request.request_code}
              </span>
              <span className="text-[hsl(var(--muted-foreground))]">·</span>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                {request.category}
                {request.sub_category ? ` / ${request.sub_category}` : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge className={`${cfg.color} text-xs`} variant="outline">
            <Icon className="mr-1 h-3 w-3" />
            {cfg.label}
          </Badge>
          <Badge className={`${PRIORITY_COLORS[request.priority]} text-xs`} variant="outline">
            {request.priority}
          </Badge>
        </div>
      </div>

      {/* Reason */}
      <p className="mt-3 line-clamp-2 text-sm text-[hsl(var(--muted-foreground))]">{request.reason}</p>

      {/* Manager review notes */}
      {request.review_notes && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-[hsl(var(--secondary))] p-2.5 text-xs">
          <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--primary))]" />
          <div>
            <span className="font-medium text-[hsl(var(--foreground))]">Manager notes: </span>
            <span className="text-[hsl(var(--muted-foreground))]">{request.review_notes}</span>
          </div>
        </div>
      )}

      {/* Priority hint */}
      <p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]/70 italic">
        {PRIORITY_HINT[request.priority]}
      </p>

      {/* Timeline footer */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[hsl(var(--border))] pt-3 text-xs text-[hsl(var(--muted-foreground))]">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          Submitted: {new Date(request.created_at).toLocaleDateString()}
        </span>
        {request.reviewed_at && (
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Reviewed: {new Date(request.reviewed_at).toLocaleDateString()}
          </span>
        )}
        {request.fulfilled_at && (
          <span className="flex items-center gap-1 text-green-400">
            <Star className="h-3 w-3" />
            Fulfilled: {new Date(request.fulfilled_at).toLocaleDateString()}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Audit Card (for My Audits tab) ──────────────────────────────────────────

const FINAL_STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  verified: "bg-green-500/20 text-green-400 border-green-500/30",
  flagged: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  lost: "bg-red-500/20 text-red-400 border-red-500/30",
  damaged: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

function AuditCard({ audit }: { audit: AssetAudit }) {
  const aiStatusCls = AUDIT_STATUS_COLORS[audit.ai_status] ?? AUDIT_STATUS_COLORS.pending;
  const finalStatusCls = FINAL_STATUS_COLORS[audit.final_status] ?? FINAL_STATUS_COLORS.pending;

  return (
    <motion.div
      variants={cardVariants}
      className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
            <Brain className="h-4.5 w-4.5 text-blue-400" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-[hsl(var(--foreground))]">
                {audit.audit_code}
              </span>
              <Badge className={`${aiStatusCls} text-xs`} variant="outline">
                AI: {audit.ai_status.replace("_", " ")}
              </Badge>
              {audit.ai_confidence != null && (
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {Math.round(audit.ai_confidence * 100)}% confidence
                </span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
              <span className="font-mono">{audit.asset_tag}</span>
              {audit.category && (
                <>
                  <span>·</span>
                  <span>{audit.category}</span>
                </>
              )}
              {audit.model && (
                <>
                  <span>·</span>
                  <span>{audit.model}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <Badge className={`${finalStatusCls} shrink-0 text-xs`} variant="outline">
          {audit.final_status}
        </Badge>
      </div>

      {/* AI observations */}
      {audit.ai_observations && (
        <div className="mt-3 rounded-lg bg-blue-500/8 border border-blue-500/15 p-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-blue-400">
            <Brain className="h-3 w-3" /> AI Observations
          </p>
          <p className="mt-0.5 line-clamp-3 text-xs text-[hsl(var(--muted-foreground))]">
            {audit.ai_observations}
          </p>
        </div>
      )}

      {/* Human review notes */}
      {audit.human_review_notes && (
        <div className="mt-2 rounded-lg bg-[hsl(var(--secondary))] p-2.5 text-xs">
          <span className="font-medium text-[hsl(var(--foreground))]">Reviewer notes: </span>
          <span className="text-[hsl(var(--muted-foreground))]">{audit.human_review_notes}</span>
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[hsl(var(--border))] pt-3">
        <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
          <Calendar className="h-3 w-3" />
          Submitted: {new Date(audit.created_at).toLocaleDateString()}
        </div>
        {audit.completed_at && (
          <div className="text-xs text-[hsl(var(--muted-foreground))]">
            Completed: {new Date(audit.completed_at).toLocaleDateString()}
          </div>
        )}
        <Badge variant="outline" className="border-[hsl(var(--border))] text-xs text-[hsl(var(--muted-foreground))]">
          {audit.audit_type.replace("_", " ")}
        </Badge>
      </div>
    </motion.div>
  );
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

type Tab = "assets" | "requests" | "audits";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "assets",   label: "My Assets",   icon: Laptop },
  { id: "requests", label: "My Requests", icon: ClipboardList },
  { id: "audits",   label: "My Audits",   icon: FileCheck },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MyAssetsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("assets");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // ── Queries ──
  const { data: assetsData, isLoading: assetsLoading, refetch: refetchAssets } = useQuery({
    queryKey: QUERY_KEYS.MY_ASSETS,
    queryFn: () => myAssetsApi.list().then((r) => r.data),
  });

  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    queryKey: [...QUERY_KEYS.REQUESTS, statusFilter],
    queryFn: () =>
      requestsApi
        .list({ status: statusFilter === "all" ? undefined : statusFilter, page_size: 50 })
        .then((r) => r.data),
  });

  const { data: auditsData, isLoading: auditsLoading } = useQuery({
    queryKey: QUERY_KEYS.MY_ASSET_AUDITS,
    queryFn: () => myAssetsApi.audits().then((r) => r.data),
  });

  const assets = assetsData?.items ?? [];
  const requests = requestsData?.items ?? [];
  const audits = auditsData?.items ?? [];

  // ── Derived stats ──
  const expiringCount = assets.filter((a) => a.validity_status === "expiring_soon").length;
  const expiredCount  = assets.filter((a) => a.validity_status === "expired").length;
  const auditDueCount = assets.filter((a) => a.audit_status === "overdue" || a.audit_status === "due_soon").length;

  const requestCounts = {
    all:       requestsData?.total ?? 0,
    pending:   requests.filter((r) => r.status === "pending").length,
    approved:  requests.filter((r) => r.status === "approved").length,
    fulfilled: requests.filter((r) => r.status === "fulfilled").length,
    rejected:  requests.filter((r) => r.status === "rejected").length,
  };

  function handleAudit(asset: MyAsset) {
    navigate(`/asset-audit?asset_id=${asset.asset_id}&assignment_id=${asset.assignment_id}`);
  }

  // ── Stat cards data ──
  const statCards = [
    {
      label: "Total Assets",
      value: assets.length,
      icon: Laptop,
      colorText: "text-blue-400",
      colorBg: "bg-blue-500/10",
    },
    {
      label: "Expiring Soon",
      value: expiringCount,
      icon: AlertTriangle,
      colorText: "text-amber-400",
      colorBg: "bg-amber-500/10",
    },
    {
      label: "Audit Overdue",
      value: auditDueCount,
      icon: Clock,
      colorText: "text-orange-400",
      colorBg: "bg-orange-500/10",
    },
    {
      label: "Expired",
      value: expiredCount,
      icon: Shield,
      colorText: "text-red-400",
      colorBg: "bg-red-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">My Portal</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Welcome back, {user?.name}. Manage your assets, requests and audits here.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchAssets()}
            className="gap-2"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => navigate("/make-request")} className="gap-2">
            <Plus className="h-3.5 w-3.5" />
            New Request
          </Button>
        </div>
      </div>

      {/* ── Hero stat bar ── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {statCards.map((stat) => (
          <motion.div key={stat.label} variants={cardVariants}>
            <Card className="border-[hsl(var(--border))]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.colorBg}`}>
                    <stat.icon className={`h-5 w-5 ${stat.colorText}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold leading-none text-[hsl(var(--foreground))]">
                      {assetsLoading ? (
                        <span className="inline-block h-7 w-6 rounded bg-[hsl(var(--secondary))] animate-pulse" />
                      ) : (
                        stat.value
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Tab switcher ── */}
      <div className="flex gap-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/40 p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 px-3 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-[hsl(var(--card))] shadow-sm text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      <AnimatePresence mode="wait">
        {/* MY ASSETS */}
        {activeTab === "assets" && (
          <motion.div
            key="assets"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {assetsLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonAssetCard key={i} />
                ))}
              </div>
            ) : assets.length === 0 ? (
              <AssetsEmptyState onRaise={() => navigate("/make-request")} />
            ) : (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              >
                {assets.map((asset) => (
                  <AssetCard key={asset.assignment_id} asset={asset} onAudit={handleAudit} />
                ))}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* MY REQUESTS */}
        {activeTab === "requests" && (
          <motion.div
            key="requests"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            {/* Status filter pills */}
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { value: "all",       label: "All",       count: requestCounts.all },
                  { value: "pending",   label: "Pending",   count: requestCounts.pending },
                  { value: "approved",  label: "Approved",  count: requestCounts.approved },
                  { value: "fulfilled", label: "Fulfilled", count: requestCounts.fulfilled },
                  { value: "rejected",  label: "Rejected",  count: requestCounts.rejected },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                    statusFilter === opt.value
                      ? "bg-[hsl(var(--primary))] text-white shadow-sm"
                      : "border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))]/40 hover:text-[hsl(var(--foreground))]"
                  }`}
                >
                  {opt.label}
                  <span
                    className={`ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                      statusFilter === opt.value
                        ? "bg-white/25 text-white"
                        : "bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]"
                    }`}
                  >
                    {opt.count}
                  </span>
                </button>
              ))}
            </div>

            {requestsLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
              </div>
            ) : requests.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] py-16 text-center"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10">
                  <ClipboardList className="h-8 w-8 text-[hsl(var(--primary))]/60" />
                </div>
                <div>
                  <p className="font-semibold text-[hsl(var(--foreground))]">No requests found</p>
                  <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                    You haven't raised any IT asset requests yet.
                  </p>
                </div>
                <Button onClick={() => navigate("/make-request")} size="sm" className="gap-2">
                  <Plus className="h-3.5 w-3.5" />
                  Raise your first request
                </Button>
              </motion.div>
            ) : (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="space-y-3"
              >
                {requests.map((req) => (
                  <RequestCard key={req.id} request={req} />
                ))}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* MY AUDITS */}
        {activeTab === "audits" && (
          <motion.div
            key="audits"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {auditsLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
              </div>
            ) : audits.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] py-16 text-center"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
                  <Brain className="h-8 w-8 text-blue-400/60" />
                </div>
                <div>
                  <p className="font-semibold text-[hsl(var(--foreground))]">No audit history yet</p>
                  <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                    Submitted audits will appear here with AI analysis results.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/asset-audit")}
                  className="gap-2"
                >
                  <Camera className="h-3.5 w-3.5" />
                  Submit an Audit
                </Button>
              </motion.div>
            ) : (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="space-y-3"
              >
                {audits.map((audit) => (
                  <AuditCard key={audit.audit_id} audit={audit} />
                ))}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Quick action hint ── */}
      {activeTab === "assets" && assets.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3"
        >
          <TrendingUp className="h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Tip: Regular asset audits keep your records up-to-date and ensure smooth renewals.
            Use the <strong className="text-[hsl(var(--foreground))]">Submit Audit</strong> button on any asset card.
          </p>
        </motion.div>
      )}
    </div>
  );
}
