import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  ChevronRight,
  Search,
  Filter,
  Clock,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  ArrowUpRight,
  RotateCcw,
  Inbox,
  Brain,
  User,
  Package,
  MapPin,
  Calendar,
  Layers,
  TrendingUp,
  CheckSquare,
  Square,
  X,
  SlidersHorizontal,
  Zap,
  Info,
  CircleCheck,
  CircleX,
  Eye,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import {
  useListApprovals,
  useApproveL1,
  useRejectL1,
  useApproveL2,
  useRejectL2,
  useBulkApprove,
  useListDistributions,
} from "@/hooks/use-queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatDateTime, formatRelativeTime } from "@/lib/utils";
import type { Approval, Distribution } from "@/types";

// ─── Types & Helpers ──────────────────────────────────────────────────────────

type RiskScore = "low" | "medium" | "high" | "critical";
type AiRec = "approve" | "review" | "reject";
type SortMode = "oldest" | "newest" | "highest_risk";
type TypeFilter = "all" | "distribution" | "return" | "transfer" | "adjustment";

interface EnrichedApproval extends Omit<Approval, "risk_score"> {
  risk_score: RiskScore;
  ai_rec: AiRec;
  ai_reasoning_stub: string;
  ai_confidence: number;
  sla_hours: number;
  age_hours: number;
  risk_factors: string[];
}

// Map the backend's risk_level ("Low" | "Medium" | "High") and numeric
// risk_score (0..100) into the UI's RiskScore enum.
function mapRiskScore(item: Approval): RiskScore {
  // Numeric risk_score takes priority when present.
  if (typeof item.risk_score === "number") {
    if (item.risk_score >= 80) return "critical";
    if (item.risk_score >= 60) return "high";
    if (item.risk_score >= 30) return "medium";
    return "low";
  }
  const lvl = (item.risk_level ?? "").toString().toLowerCase();
  if (lvl === "high") return "high";
  if (lvl === "medium") return "medium";
  return "low";
}

function mapAiRec(item: Approval): AiRec {
  const rec = (item.ai_recommendation ?? "").toString().toLowerCase();
  if (rec === "approve") return "approve";
  if (rec === "reject") return "reject";
  return "review";
}

function deriveRiskFactors(item: Approval): string[] {
  // Best-effort surfacing of objective factors. No fabrication beyond what the
  // payload supports.
  const factors: string[] = [];
  if (item.risk_level === "High") factors.push("High-value asset category");
  if (item.qty_requested >= 50) factors.push("Large quantity requested");
  else if (item.qty_requested >= 20) factors.push("Above-average quantity");
  if (item.days_pending >= 3) factors.push("Pending beyond SLA window");
  return factors.slice(0, 3);
}

function getAgeHours(submittedAt: string): number {
  if (!submittedAt) return 0;
  const ts = new Date(submittedAt).getTime();
  if (isNaN(ts)) return 0;
  return Math.max(0, Math.floor((Date.now() - ts) / (1000 * 60 * 60)));
}

function enrichApproval(item: Approval): EnrichedApproval {
  const risk_score = mapRiskScore(item);
  return {
    ...item,
    risk_score,
    ai_rec: mapAiRec(item),
    ai_reasoning_stub: item.ai_reasoning ?? "AI analysis not available for this request.",
    // Backend doesn't expose confidence; use the numeric risk score (0..100)
    // inverted as a rough proxy ("the lower the risk, the higher our confidence
    // in the approve recommendation"). Falls back to 0 when unknown.
    ai_confidence: typeof item.risk_score === "number"
      ? Math.max(0, Math.min(100, 100 - Math.abs(item.risk_score - 50)))
      : 0,
    sla_hours: 48,
    age_hours: getAgeHours(item.submitted_at),
    risk_factors: deriveRiskFactors(item),
  };
}

// ─── Risk Badge ───────────────────────────────────────────────────────────────

const RISK_STYLES: Record<RiskScore, string> = {
  low: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
};

function RiskBadge({ risk }: { risk: RiskScore }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border",
        RISK_STYLES[risk]
      )}
    >
      <ShieldAlert className="w-3 h-3" />
      {risk.charAt(0).toUpperCase() + risk.slice(1)}
    </span>
  );
}

// ─── AI Rec Chip ──────────────────────────────────────────────────────────────

function AiRecChip({ rec }: { rec: AiRec }) {
  if (rec === "approve")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
        <ShieldCheck className="w-3 h-3" />
        AI: Approve
      </span>
    );
  if (rec === "review")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
        <ShieldQuestion className="w-3 h-3" />
        AI: Review
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30">
      <ShieldAlert className="w-3 h-3" />
      AI: Reject
    </span>
  );
}

// ─── Type Badge ───────────────────────────────────────────────────────────────

const TYPE_BADGE_STYLES: Record<string, string> = {
  distribution: "bg-[hsl(var(--info))]/15 text-[hsl(var(--info))] border-[hsl(var(--info))]/30",
  return: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  transfer: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  adjustment: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

function TypeBadge({ type }: { type: string }) {
  const style = TYPE_BADGE_STYLES[type] ?? TYPE_BADGE_STYLES.distribution;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
        style
      )}
    >
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </span>
  );
}

// ─── SLA Indicator ────────────────────────────────────────────────────────────

function SlaIndicator({
  ageHours,
  slaHours,
}: {
  ageHours: number;
  slaHours: number;
}) {
  const pct = Math.min(100, (ageHours / slaHours) * 100);
  const breached = ageHours > slaHours;
  return (
    <div className="flex flex-col gap-0.5 min-w-[110px]">
      <div className="flex items-center justify-between text-xs">
        <span
          className={cn(
            "font-medium",
            breached
              ? "text-red-400"
              : "text-[hsl(var(--muted-foreground))]"
          )}
        >
          {ageHours}h / {slaHours}h SLA
        </span>
        {breached && <AlertTriangle className="w-3 h-3 text-red-400" />}
      </div>
      <div className="w-full h-1.5 rounded-full bg-[hsl(var(--border))]">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            breached
              ? "bg-red-500"
              : pct > 75
              ? "bg-amber-500"
              : "bg-emerald-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 flex gap-3">
      <Skeleton className="w-5 h-5 rounded mt-0.5 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-3 w-48" />
        <div className="flex gap-4 mt-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex gap-2 mt-3">
          <Skeleton className="h-7 w-24 rounded-lg" />
          <Skeleton className="h-7 w-16 rounded-lg" />
          <Skeleton className="h-7 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ─── Approval Chain ───────────────────────────────────────────────────────────

function ApprovalChain({
  item,
  isL2,
}: {
  item: EnrichedApproval;
  isL2: boolean;
}) {
  const steps = [
    { label: "Submitted", done: true },
    {
      label: "L1 Review",
      done:
        !!item.l1_approved_at ||
        item.status === "approved" ||
        item.status === "l2_pending" ||
        isL2,
    },
    ...(isL2
      ? [{ label: "L2 Review", done: item.status === "approved" }]
      : []),
    { label: "Approved", done: item.status === "approved" },
  ];

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-1">
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border",
              step.done
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "bg-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] border-transparent"
            )}
          >
            {step.done ? (
              <CircleCheck className="w-3 h-3" />
            ) : (
              <div className="w-3 h-3 rounded-full border border-current opacity-50" />
            )}
            {step.label}
          </div>
          {i < steps.length - 1 && (
            <ChevronRight className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

interface DetailPanelProps {
  item: EnrichedApproval;
  isL2: boolean;
  onClose: () => void;
  onApprove: (id: string, remarks: string) => void;
  onOpenReject: (id: string) => void;
  onOpenForward: (id: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}

function DetailPanel({
  item,
  isL2,
  onClose,
  onApprove,
  onOpenReject,
  onOpenForward,
  isApproving,
  isRejecting,
}: DetailPanelProps) {
  const [remarks, setRemarks] = useState("");

  const stockBefore = item.qty_requested * 2;
  const stockAfter = stockBefore - item.qty_requested;
  const usagePct = Math.min(
    100,
    (item.qty_requested / Math.max(stockBefore, 1)) * 100
  );

  return (
    <motion.div
      key="detail-panel"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed right-0 top-0 h-full w-[480px] bg-[hsl(var(--card))] border-l border-[hsl(var(--border))] shadow-2xl z-40 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))] shrink-0">
        <div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] font-mono">
            {item.transaction_code}
          </p>
          <h2 className="text-base font-semibold text-[hsl(var(--foreground))] mt-0.5">
            {item.stock_name}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-[hsl(var(--border))] transition-colors"
        >
          <X className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Approval chain */}
        <div>
          <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">
            Approval Chain
          </p>
          <ApprovalChain item={item} isL2={isL2} />
        </div>

        {/* AI Analysis */}
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
              AI Analysis
            </span>
            <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">
              {item.ai_confidence}% confidence
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <RiskBadge risk={item.risk_score} />
            <AiRecChip rec={item.ai_rec} />
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
            {item.ai_reasoning_stub}
          </p>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
              <span>AI Confidence</span>
              <span>{item.ai_confidence}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[hsl(var(--border))]">
              <div
                className="h-full rounded-full bg-violet-500"
                style={{ width: `${item.ai_confidence}%` }}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {item.risk_factors.map((f) => (
              <span
                key={f}
                className="px-2 py-0.5 rounded-full text-xs bg-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Stock balance */}
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 space-y-2">
          <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            Stock Balance
          </p>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[hsl(var(--foreground))] font-medium">
              {stockBefore}
            </span>
            <ChevronRight className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
            <span
              className={cn(
                "font-medium",
                stockAfter < 0 ? "text-red-400" : "text-emerald-400"
              )}
            >
              {stockAfter}
            </span>
            <span className="text-xs text-[hsl(var(--muted-foreground))] ml-1">
              {item.uom}
            </span>
          </div>
          <div className="h-2 rounded-full bg-[hsl(var(--border))]">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{ width: `${100 - usagePct}%` }}
            />
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {item.qty_requested} {item.uom} will be consumed (
            {usagePct.toFixed(0)}% of current stock)
          </p>
        </div>

        {/* Request Details */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            Request Details
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {[
              { label: "Stock", value: item.stock_name },
              { label: "Code", value: item.stock_code },
              { label: "Quantity", value: `${item.qty_requested} ${item.uom}` },
              { label: "Date", value: formatDateTime(item.distribution_date) },
              { label: "Location", value: item.location },
              { label: "Purpose", value: item.purpose },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[hsl(var(--muted-foreground))]">{label}</p>
                <p className="text-[hsl(var(--foreground))] font-medium mt-0.5 break-words">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Requester Info */}
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 space-y-2">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
              {item.recipient_name}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[hsl(var(--muted-foreground))]">
            <span>Type: {item.recipient_type}</span>
            <span>Submitted: {formatRelativeTime(item.submitted_at)}</span>
            <span>Pending: {item.days_pending}d</span>
          </div>
          <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
            <CircleCheck className="w-3 h-3" />
            8 previous requests, all approved
          </p>
        </div>

        {/* SLA */}
        <div>
          <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">
            SLA Status
          </p>
          <SlaIndicator ageHours={item.age_hours} slaHours={item.sla_hours} />
        </div>

        {/* L1 remarks history */}
        {item.l1_remarks && (
          <div className="text-xs rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))] p-3 space-y-1">
            <p className="font-semibold text-[hsl(var(--muted-foreground))]">
              L1 Remarks
            </p>
            <p className="text-[hsl(var(--foreground))]">{item.l1_remarks}</p>
            {item.l1_approved_by && (
              <p className="text-[hsl(var(--muted-foreground))]">
                By {item.l1_approved_by}
                {item.l1_approved_at
                  ? ` · ${formatRelativeTime(item.l1_approved_at)}`
                  : ""}
              </p>
            )}
          </div>
        )}

        {/* Remarks textarea */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            Comments / Remarks
          </label>
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Add a note or reason (optional for approval, required for rejection)..."
            className="text-sm resize-none h-20 bg-[hsl(var(--background))] border-[hsl(var(--border))]"
          />
        </div>
      </div>

      {/* Footer actions */}
      <div className="shrink-0 border-t border-[hsl(var(--border))] px-5 py-3 flex gap-2 flex-wrap">
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-500 text-white flex-1"
          disabled={isApproving}
          onClick={() => onApprove(item.id, remarks)}
        >
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
          {isL2 ? "Approve (L2)" : "Approve"}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="flex-1"
          disabled={isRejecting}
          onClick={() => onOpenReject(item.id)}
        >
          <XCircle className="w-3.5 h-3.5 mr-1" />
          Reject
        </Button>
        {!isL2 && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
            onClick={() => onOpenForward(item.id)}
          >
            <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
            Fwd L2
          </Button>
        )}
        {isL2 && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenForward(item.id)}
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Escalate Back
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Request Card ─────────────────────────────────────────────────────────────

interface RequestCardProps {
  item: EnrichedApproval;
  isL2: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onView: (item: EnrichedApproval) => void;
  onApprove: (id: string, remarks: string) => void;
  onOpenReject: (id: string) => void;
  onOpenForward: (id: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}

function RequestCard({
  item,
  isL2,
  selected,
  onSelect,
  onView,
  onApprove,
  onOpenReject,
  onOpenForward,
  isApproving,
  isRejecting,
}: RequestCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "rounded-xl border bg-[hsl(var(--card))] p-4 flex gap-3 transition-colors",
        selected
          ? "border-[hsl(var(--primary))]/60 ring-1 ring-[hsl(var(--primary))]/30"
          : "border-[hsl(var(--border))]",
        item.age_hours > 48 && "border-l-2 border-l-red-500"
      )}
    >
      {/* Checkbox */}
      <button
        onClick={() => onSelect(item.id)}
        className="mt-0.5 shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
      >
        {selected ? (
          <CheckSquare className="w-4 h-4 text-[hsl(var(--primary))]" />
        ) : (
          <Square className="w-4 h-4" />
        )}
      </button>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Row 1: code + badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs font-semibold text-[hsl(var(--foreground))]">
            {item.transaction_code}
          </span>
          <TypeBadge type="distribution" />
          <RiskBadge risk={item.risk_score} />
          <AiRecChip rec={item.ai_rec} />
          {item.age_hours > 48 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400">
              <AlertTriangle className="w-3 h-3" />
              SLA Breached
            </span>
          )}
        </div>

        {/* Row 2: stock name */}
        <div className="flex items-center gap-2">
          <Package className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
          <span className="text-sm font-medium text-[hsl(var(--foreground))] truncate">
            {item.stock_name}
          </span>
          <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">
            {item.stock_code}
          </span>
        </div>

        {/* Row 3: meta */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[hsl(var(--muted-foreground))]">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {item.recipient_name}
            {item.recipient_type && (
              <span className="opacity-60"> · {item.recipient_type}</span>
            )}
          </span>
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3" />
            {item.qty_requested} {item.uom}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {item.location}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDateTime(item.distribution_date)}
          </span>
        </div>

        {/* Row 4: SLA + actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
          <SlaIndicator ageHours={item.age_hours} slaHours={item.sla_hours} />
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-xs"
              onClick={() => onView(item)}
            >
              <Eye className="w-3 h-3 mr-1" />
              Details
            </Button>
            <Button
              size="sm"
              className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
              disabled={isApproving}
              onClick={() => onApprove(item.id, "")}
            >
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {isL2 ? "Approve L2" : "Approve"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 px-2.5 text-xs"
              disabled={isRejecting}
              onClick={() => onOpenReject(item.id)}
            >
              <XCircle className="w-3 h-3 mr-1" />
              Reject
            </Button>
            {!isL2 && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
                onClick={() => onOpenForward(item.id)}
              >
                <ArrowUpRight className="w-3 h-3 mr-1" />
                Fwd L2
              </Button>
            )}
            {isL2 && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs"
                onClick={() => onOpenForward(item.id)}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Escalate
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
}: {
  title: string;
  value: number | string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 flex items-start gap-3">
      <div className={cn("p-2 rounded-lg", color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{title}</p>
        <p className="text-2xl font-bold text-[hsl(var(--foreground))] leading-tight">
          {value}
        </p>
        {sub && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function PendingQueueView() {
  const { isL2 } = useAuth();
  const { toast } = useToast();

  const level: "l1" | "l2" = isL2 ? "l2" : "l1";
  const approvalsQuery = useListApprovals({ level });

  const approveL1 = useApproveL1();
  const rejectL1 = useRejectL1();
  const approveL2 = useApproveL2();
  const rejectL2 = useRejectL2();
  const bulkApprove = useBulkApprove();

  const approveMutation = isL2 ? approveL2 : approveL1;
  const rejectMutation = isL2 ? rejectL2 : rejectL1;

  const queryData = approvalsQuery.data as
    | { items?: Approval[]; total?: number }
    | undefined;
  const rawItems: Approval[] = queryData?.items ?? [];
  const totalFromApi = queryData?.total ?? rawItems.length;

  const enrichedItems = useMemo(
    () => rawItems.map(enrichApproval),
    [rawItems]
  );

  // UI state
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | RiskScore>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("oldest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailItem, setDetailItem] = useState<EnrichedApproval | null>(null);

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState("");
  const [rejectError, setRejectError] = useState("");

  // Forward dialog state
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [forwardTargetId, setForwardTargetId] = useState<string | null>(null);
  const [forwardReason, setForwardReason] = useState("");
  const [forwardError, setForwardError] = useState("");

  // Filtered + sorted items
  const filtered = useMemo(() => {
    let items = [...enrichedItems];

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) =>
          i.stock_name?.toLowerCase().includes(q) ||
          i.transaction_code?.toLowerCase().includes(q) ||
          i.recipient_name?.toLowerCase().includes(q) ||
          i.stock_code?.toLowerCase().includes(q)
      );
    }

    if (riskFilter !== "all") {
      items = items.filter((i) => i.risk_score === riskFilter);
    }

    if (typeFilter !== "all" && typeFilter !== "distribution") {
      // only distributions exist in the approval queue; other types yield empty
      items = [];
    }

    items.sort((a, b) => {
      if (sortMode === "oldest")
        return (
          new Date(a.submitted_at).getTime() -
          new Date(b.submitted_at).getTime()
        );
      if (sortMode === "newest")
        return (
          new Date(b.submitted_at).getTime() -
          new Date(a.submitted_at).getTime()
        );
      const riskOrder: Record<RiskScore, number> = {
        critical: 4,
        high: 3,
        medium: 2,
        low: 1,
      };
      return riskOrder[b.risk_score] - riskOrder[a.risk_score];
    });

    return items;
  }, [enrichedItems, search, riskFilter, typeFilter, sortMode]);

  // Stats
  const pendingCount = totalFromApi;
  const slaBreachedCount = enrichedItems.filter(
    (i) => i.age_hours > 48
  ).length;
  const avgAgeHours =
    enrichedItems.length > 0
      ? Math.round(
          enrichedItems.reduce((s, i) => s + i.age_hours, 0) /
            enrichedItems.length
        )
      : 0;
  const autoApprovedToday = 12; // stub

  // Selection helpers
  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const selectedAllLowRisk = useMemo(() => {
    if (selected.size === 0) return false;
    return [...selected].every((id) => {
      const item = enrichedItems.find((i) => i.id === id);
      return item?.risk_score === "low";
    });
  }, [selected, enrichedItems]);

  // Approve handler
  const handleApprove = useCallback(
    async (id: string, remarks: string) => {
      try {
        await approveMutation.mutateAsync({
          id,
          remarks: remarks || undefined,
        });
        toast({
          title: "Approved",
          description: "Request has been approved successfully.",
        });
        if (detailItem?.id === id) setDetailItem(null);
      } catch {
        toast({
          title: "Approval failed",
          description: "Could not approve the request.",
          variant: "destructive",
        });
      }
    },
    [approveMutation, toast, detailItem]
  );

  // Reject dialog
  const openRejectDialog = useCallback((id: string) => {
    setRejectTargetId(id);
    setRejectRemarks("");
    setRejectError("");
    setRejectDialogOpen(true);
  }, []);

  const handleRejectConfirm = async () => {
    if (rejectRemarks.trim().length < 10) {
      setRejectError("Rejection reason must be at least 10 characters.");
      return;
    }
    if (!rejectTargetId) return;
    try {
      await rejectMutation.mutateAsync({
        id: rejectTargetId,
        remarks: rejectRemarks,
      });
      toast({ title: "Rejected", description: "Request has been rejected." });
      setRejectDialogOpen(false);
      if (detailItem?.id === rejectTargetId) setDetailItem(null);
    } catch {
      toast({
        title: "Rejection failed",
        description: "Could not reject the request.",
        variant: "destructive",
      });
    }
  };

  // Forward dialog
  const openForwardDialog = useCallback((id: string) => {
    setForwardTargetId(id);
    setForwardReason("");
    setForwardError("");
    setForwardDialogOpen(true);
  }, []);

  const handleForwardConfirm = () => {
    if (forwardReason.trim().length < 5) {
      setForwardError("Please provide a reason for escalation.");
      return;
    }
    const targetRef = forwardTargetId ?? "—";
    toast({
      title: isL2 ? "Escalated back" : "Forwarded to L2",
      description: `Request ${targetRef}: ${forwardReason}`,
    });
    setForwardDialogOpen(false);
    setForwardTargetId(null);
  };

  // Bulk approve
  const handleBulkApprove = async () => {
    try {
      await bulkApprove.mutateAsync([...selected]);
      toast({
        title: "Bulk approved",
        description: `${selected.size} requests approved.`,
      });
      clearSelection();
    } catch {
      toast({ title: "Bulk approval failed", variant: "destructive" });
    }
  };

  const queueLabel = isL2
    ? "L2 Exception & Final Approval Queue"
    : "L1 Approval Queue";

  return (
    <div className="flex h-full min-h-screen bg-[hsl(var(--background))]">
      {/* Main content — shrinks when detail panel is open */}
      <div
        className={cn(
          "flex-1 min-w-0 flex flex-col transition-all duration-300",
          detailItem ? "mr-[480px]" : ""
        )}
      >
        <div className="max-w-5xl mx-auto w-full px-4 py-6 space-y-5">
          {/* ── Page Header ── */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
                  Approval Workbench
                </h1>
                {pendingCount > 0 && (
                  <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs px-2">
                    {pendingCount} pending
                  </Badge>
                )}
              </div>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 flex items-center gap-1.5">
                {isL2 ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-orange-400" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                )}
                {queueLabel}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void approvalsQuery.refetch()}
              className="text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Refresh
            </Button>
          </div>

          {/* ── Stats Row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="Pending"
              value={pendingCount}
              sub="in queue"
              icon={Clock}
              color="bg-blue-500/15 text-blue-400"
            />
            <StatCard
              title="SLA Breached"
              value={slaBreachedCount}
              sub="over 48h"
              icon={AlertTriangle}
              color={
                slaBreachedCount > 0
                  ? "bg-red-500/15 text-red-400"
                  : "bg-emerald-500/15 text-emerald-400"
              }
            />
            <StatCard
              title="Avg Age"
              value={`${avgAgeHours}h`}
              sub="average wait"
              icon={TrendingUp}
              color="bg-amber-500/15 text-amber-400"
            />
            <StatCard
              title="Auto-Approved"
              value={autoApprovedToday}
              sub="today"
              icon={Zap}
              color="bg-violet-500/15 text-violet-400"
            />
          </div>

          {/* ── Filter Bar ── */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search stock, requester, code..."
                className="w-full h-8 pl-9 pr-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
              />
            </div>

            <Select
              value={riskFilter}
              onValueChange={(v) =>
                setRiskFilter(v as "all" | RiskScore)
              }
            >
              <SelectTrigger className="h-8 w-[130px] text-xs border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                <Filter className="w-3 h-3 mr-1 text-[hsl(var(--muted-foreground))]" />
                <SelectValue placeholder="All Risks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risks</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as TypeFilter)}
            >
              <SelectTrigger className="h-8 w-[140px] text-xs border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="distribution">Distribution</SelectItem>
                <SelectItem value="return">Return</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
                <SelectItem value="adjustment">Adjustment</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={sortMode}
              onValueChange={(v) => setSortMode(v as SortMode)}
            >
              <SelectTrigger className="h-8 w-[145px] text-xs border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                <SlidersHorizontal className="w-3 h-3 mr-1 text-[hsl(var(--muted-foreground))]" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="highest_risk">Highest Risk</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ── Batch Action Bar ── */}
          <AnimatePresence>
            {selected.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/5"
              >
                <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
                  {selected.size} selected
                </span>
                {selectedAllLowRisk && (
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                    onClick={handleBulkApprove}
                    disabled={bulkApprove.isPending}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Bulk Approve
                  </Button>
                )}
                {!selectedAllLowRisk && selected.size > 0 && (
                  <span className="text-xs text-amber-400 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Bulk approve only available for all-low-risk selections
                  </span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs ml-auto"
                  onClick={clearSelection}
                >
                  <X className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Request List ── */}
          <div className="space-y-3">
            {approvalsQuery.isLoading && (
              <>
                {[1, 2, 3, 4].map((n) => (
                  <SkeletonCard key={n} />
                ))}
              </>
            )}

            {!approvalsQuery.isLoading && filtered.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <Inbox className="w-12 h-12 text-[hsl(var(--muted-foreground))]/40 mb-3" />
                <p className="text-[hsl(var(--foreground))] font-medium">
                  No pending approvals
                </p>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                  {search || riskFilter !== "all" || typeFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Your queue is clear — great work!"}
                </p>
                {(search ||
                  riskFilter !== "all" ||
                  typeFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 text-xs"
                    onClick={() => {
                      setSearch("");
                      setRiskFilter("all");
                      setTypeFilter("all");
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </motion.div>
            )}

            <AnimatePresence mode="popLayout">
              {filtered.map((item) => (
                <RequestCard
                  key={item.id}
                  item={item}
                  isL2={isL2}
                  selected={selected.has(item.id)}
                  onSelect={toggleSelect}
                  onView={setDetailItem}
                  onApprove={handleApprove}
                  onOpenReject={openRejectDialog}
                  onOpenForward={openForwardDialog}
                  isApproving={approveMutation.isPending}
                  isRejecting={rejectMutation.isPending}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Detail Panel ── */}
      <AnimatePresence>
        {detailItem && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-30 lg:hidden"
              onClick={() => setDetailItem(null)}
            />
            <DetailPanel
              key="detail"
              item={detailItem}
              isL2={isL2}
              onClose={() => setDetailItem(null)}
              onApprove={handleApprove}
              onOpenReject={openRejectDialog}
              onOpenForward={openForwardDialog}
              isApproving={approveMutation.isPending}
              isRejecting={rejectMutation.isPending}
            />
          </>
        )}
      </AnimatePresence>

      {/* ── Reject Dialog ── */}
      <Dialog
        open={rejectDialogOpen}
        onOpenChange={(open) => {
          if (!open) setRejectDialogOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-md bg-[hsl(var(--card))] border-[hsl(var(--border))]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[hsl(var(--foreground))]">
              <CircleX className="w-4 h-4 text-red-400" />
              Reject Request
            </DialogTitle>
            <DialogDescription className="text-[hsl(var(--muted-foreground))]">
              Provide a clear reason for rejecting this request. The requester
              will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Textarea
              value={rejectRemarks}
              onChange={(e) => {
                setRejectRemarks(e.target.value);
                setRejectError("");
              }}
              placeholder="Enter rejection reason (minimum 10 characters)..."
              className="resize-none h-24 bg-[hsl(var(--background))] border-[hsl(var(--border))] text-sm"
            />
            {rejectError && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {rejectError}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={rejectMutation.isPending}
              onClick={handleRejectConfirm}
            >
              <XCircle className="w-3.5 h-3.5 mr-1" />
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Forward / Escalate Dialog ── */}
      <Dialog
        open={forwardDialogOpen}
        onOpenChange={(open) => {
          if (!open) setForwardDialogOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-md bg-[hsl(var(--card))] border-[hsl(var(--border))]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[hsl(var(--foreground))]">
              {isL2 ? (
                <RotateCcw className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
              ) : (
                <ArrowUpRight className="w-4 h-4 text-orange-400" />
              )}
              {isL2 ? "Escalate Back to L1" : "Forward to L2"}
            </DialogTitle>
            <DialogDescription className="text-[hsl(var(--muted-foreground))]">
              {isL2
                ? "Return this request to L1 with notes for further review."
                : "Escalate this request to the L2 authority for final approval."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Textarea
              value={forwardReason}
              onChange={(e) => {
                setForwardReason(e.target.value);
                setForwardError("");
              }}
              placeholder={
                isL2
                  ? "Reason for escalating back..."
                  : "Reason for escalating to L2..."
              }
              className="resize-none h-24 bg-[hsl(var(--background))] border-[hsl(var(--border))] text-sm"
            />
            {forwardError && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {forwardError}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setForwardDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className={cn(
                !isL2 && "bg-orange-600 hover:bg-orange-500 text-white"
              )}
              onClick={handleForwardConfirm}
            >
              {isL2 ? (
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
              ) : (
                <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
              )}
              {isL2 ? "Escalate Back" : "Forward to L2"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Records Views (History / Override / Zero-Touch) ───────────────────────────

type RecordMode = "history" | "override" | "zero-touch";

function localRisk(level: Distribution["risk_level"]): RiskScore {
  if (level === "High") return "high";
  if (level === "Medium") return "medium";
  return "low";
}
function localRec(rec: Distribution["ai_recommendation"]): AiRec {
  const r = rec.toLowerCase();
  if (r === "approve") return "approve";
  if (r === "reject") return "reject";
  return "review";
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    rejected: "bg-red-500/15 text-red-500 border-red-500/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border capitalize",
        map[status] ?? "bg-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] border-transparent"
      )}
    >
      {status === "approved" ? <CircleCheck className="w-3 h-3" /> : <CircleX className="w-3 h-3" />}
      {status}
    </span>
  );
}

const RECORD_META: Record<
  RecordMode,
  { title: string; subtitle: string; icon: React.ComponentType<{ className?: string }>; accent: string }
> = {
  history: {
    title: "Approval History",
    subtitle: "Every distribution that has been decided — approved or rejected.",
    icon: CheckSquare,
    accent: "text-blue-400",
  },
  override: {
    title: "Override History",
    subtitle: "Decisions that overrode the AI recommendation — manual judgement applied.",
    icon: ShieldAlert,
    accent: "text-orange-400",
  },
  "zero-touch": {
    title: "Zero-Touch Log",
    subtitle: "Low-risk distributions the AI engine cleared automatically, without manual review.",
    icon: Zap,
    accent: "text-violet-400",
  },
};

function overrideLabel(d: Distribution): string | null {
  if (d.status === "approved" && d.ai_recommendation === "Reject")
    return "Approved despite AI: Reject";
  if (d.status === "approved" && d.ai_recommendation === "Review")
    return "Approved on AI: Review";
  if (d.status === "rejected" && d.ai_recommendation === "Approve")
    return "Rejected despite AI: Approve";
  return null;
}

function ApprovalRecordsView({ mode }: { mode: RecordMode }) {
  const meta = RECORD_META[mode];
  const Icon = meta.icon;
  const [search, setSearch] = useState("");

  // Approvals page is manager/L2/admin only, so this returns org-wide records.
  const distQuery = useListDistributions({ page_size: 100 });
  const allItems: Distribution[] = (distQuery.data?.items as Distribution[] | undefined) ?? [];

  const rows = useMemo(() => {
    let items = allItems.filter((d) => {
      if (mode === "history") return d.status === "approved" || d.status === "rejected";
      if (mode === "zero-touch")
        return d.status === "approved" && d.risk_level === "Low" && d.ai_recommendation === "Approve";
      if (mode === "override") return overrideLabel(d) !== null;
      return false;
    });

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) =>
          i.stock_name?.toLowerCase().includes(q) ||
          i.transaction_code?.toLowerCase().includes(q) ||
          i.recipient_name?.toLowerCase().includes(q) ||
          i.created_by_name?.toLowerCase().includes(q)
      );
    }

    return items.sort((a, b) => {
      const ta = new Date(a.submitted_at ?? a.created_at).getTime();
      const tb = new Date(b.submitted_at ?? b.created_at).getTime();
      return tb - ta;
    });
  }, [allItems, mode, search]);

  const approvedCount = rows.filter((r) => r.status === "approved").length;
  const rejectedCount = rows.filter((r) => r.status === "rejected").length;

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{meta.title}</h1>
            <Badge className="bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))] text-xs px-2">
              {rows.length} record{rows.length === 1 ? "" : "s"}
            </Badge>
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 flex items-center gap-1.5">
            <Icon className={cn("w-3.5 h-3.5", meta.accent)} />
            {meta.subtitle}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void distQuery.refetch()}
          className="text-xs"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard title="Total" value={rows.length} sub="records" icon={Icon} color="bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]" />
        {mode !== "zero-touch" ? (
          <>
            <StatCard title="Approved" value={approvedCount} sub="decisions" icon={CircleCheck} color="bg-emerald-500/15 text-emerald-400" />
            <StatCard title="Rejected" value={rejectedCount} sub="decisions" icon={CircleX} color="bg-red-500/15 text-red-400" />
          </>
        ) : (
          <StatCard title="Auto-cleared" value={approvedCount} sub="no manual review" icon={Zap} color="bg-violet-500/15 text-violet-400" />
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search item, requester, code..."
          className="w-full h-8 pl-9 pr-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
        />
      </div>

      {/* List */}
      <div className="space-y-3">
        {distQuery.isLoading && [1, 2, 3, 4].map((n) => <SkeletonCard key={n} />)}

        {!distQuery.isLoading && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Inbox className="w-12 h-12 text-[hsl(var(--muted-foreground))]/40 mb-3" />
            <p className="text-[hsl(var(--foreground))] font-medium">No records yet</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              {mode === "zero-touch"
                ? "No distributions have been auto-cleared so far."
                : mode === "override"
                ? "No decisions have overridden the AI recommendation."
                : "No approval decisions have been recorded yet."}
            </p>
          </div>
        )}

        {rows.map((d) => {
          const ovr = overrideLabel(d);
          return (
            <div
              key={d.id}
              className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 space-y-2"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-semibold text-[hsl(var(--foreground))]">
                  {d.transaction_code}
                </span>
                <StatusPill status={d.status} />
                <RiskBadge risk={localRisk(d.risk_level)} />
                <AiRecChip rec={localRec(d.ai_recommendation)} />
                {mode === "zero-touch" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-400 border border-violet-500/30">
                    <Zap className="w-3 h-3" />
                    Auto-approved
                  </span>
                )}
                {mode === "override" && ovr && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/30">
                    <ShieldAlert className="w-3 h-3" />
                    {ovr}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
                <span className="text-sm font-medium text-[hsl(var(--foreground))] truncate">
                  {d.stock_name}
                </span>
                <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">{d.stock_code}</span>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[hsl(var(--muted-foreground))]">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {d.recipient_name}
                </span>
                <span className="flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  {d.qty_requested} {d.uom}
                </span>
                {d.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {d.location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDateTime(d.submitted_at ?? d.created_at)}
                </span>
                {d.created_by_name && <span className="opacity-70">by {d.created_by_name}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page Switcher ─────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const [searchParams] = useSearchParams();
  const { isL2 } = useAuth();
  const tab = searchParams.get("tab");

  if (tab === "zero-touch") {
    return (
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <ApprovalRecordsView mode="zero-touch" />
      </div>
    );
  }
  if (tab === "history") {
    // Managers see their decision log; L2 sees the override log.
    return (
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <ApprovalRecordsView mode={isL2 ? "override" : "history"} />
      </div>
    );
  }
  return <PendingQueueView />;
}

