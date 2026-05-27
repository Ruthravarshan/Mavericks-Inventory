import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  ClipboardList,
  ArrowLeft,
  Eye,
  Star,
  Calendar,
  Zap,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { requestsApi } from "@/lib/api";
import { QUERY_KEYS, PRIORITY_COLORS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AssetRequest } from "@/types";

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    color: string;
    icon: React.ComponentType<{ className?: string }>;
    step: number;
  }
> = {
  pending:   { label: "Pending Review",  color: "bg-amber-500/20 text-amber-400 border-amber-500/30",  icon: Clock,         step: 1 },
  approved:  { label: "Approved",        color: "bg-blue-500/20 text-blue-400 border-blue-500/30",     icon: CheckCircle2,  step: 2 },
  rejected:  { label: "Rejected",        color: "bg-red-500/20 text-red-400 border-red-500/30",        icon: XCircle,       step: -1 },
  fulfilled: { label: "Fulfilled",       color: "bg-green-500/20 text-green-400 border-green-500/30",  icon: Star,          step: 3 },
  cancelled: { label: "Cancelled",       color: "bg-gray-500/20 text-gray-400 border-gray-500/30",     icon: XCircle,       step: -1 },
};

/** Left border accent per priority */
const PRIORITY_BORDER: Record<string, string> = {
  low:      "border-l-slate-400",
  normal:   "border-l-blue-400",
  urgent:   "border-l-amber-400",
  critical: "border-l-red-500",
};

/** Estimated fulfillment hint */
const PRIORITY_HINT: Record<string, string> = {
  low:      "Estimated fulfillment: 5–7 business days",
  normal:   "Estimated fulfillment: 3–5 business days",
  urgent:   "Estimated fulfillment: 1–2 business days",
  critical: "Expedited — same or next business day",
};

/** Progress steps for the visual stepper */
const STEPPER_STEPS = [
  { label: "Submitted",    step: 0 },
  { label: "Under Review", step: 1 },
  { label: "Decision",     step: 2 },
  { label: "Fulfilled",    step: 3 },
] as const;

// ─── Framer Motion variants ───────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 260, damping: 22 },
  },
};

// ─── Progress Stepper ────────────────────────────────────────────────────────

function RequestStepper({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status];
  const currentStep = cfg?.step ?? 0;
  const isRejected = status === "rejected" || status === "cancelled";

  return (
    <div className="mb-5 flex items-start gap-0">
      {STEPPER_STEPS.map(({ label, step }, idx) => {
        const isCompleted = !isRejected && currentStep > step;
        const isCurrent   = !isRejected && currentStep === step;
        const isDecision  = step === 2;
        const isRejectedDecision = isRejected && isDecision;

        const circleClasses = isRejectedDecision
          ? "bg-red-500/20 border-red-500/40 text-red-400"
          : isCompleted
          ? "bg-[hsl(var(--primary))] border-[hsl(var(--primary))] text-white"
          : isCurrent
          ? "border-2 border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
          : "border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]";

        const lineClasses =
          !isRejected && currentStep > step
            ? "bg-[hsl(var(--primary))]"
            : "bg-[hsl(var(--border))]";

        return (
          <div key={label} className="flex flex-1 flex-col items-center">
            {/* Step circle + connector line */}
            <div className="flex w-full items-center">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors mx-auto ${circleClasses}`}
              >
                {isRejectedDecision ? (
                  "✕"
                ) : isCompleted ? (
                  "✓"
                ) : (
                  step + 1
                )}
              </div>
              {idx < STEPPER_STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 rounded-full transition-colors ${lineClasses}`}
                />
              )}
            </div>
            {/* Label below */}
            <span
              className={`mt-1 hidden text-[10px] text-center sm:block leading-tight ${
                isCurrent || isCompleted
                  ? "text-[hsl(var(--foreground))] font-medium"
                  : "text-[hsl(var(--muted-foreground))]"
              }`}
            >
              {isRejectedDecision ? (isRejected ? (status === "cancelled" ? "Cancelled" : "Rejected") : label) : label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Request Card ─────────────────────────────────────────────────────────────

function RequestCard({ request }: { request: AssetRequest }) {
  const cfg = STATUS_CONFIG[request.status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  const leftBorder = PRIORITY_BORDER[request.priority] ?? "border-l-[hsl(var(--border))]";

  return (
    <motion.div
      variants={cardVariants}
      className={`rounded-xl border border-[hsl(var(--border))] border-l-4 ${leftBorder} bg-[hsl(var(--card))] overflow-hidden`}
    >
      <div className="p-5">
        {/* Progress stepper */}
        <RequestStepper status={request.status} />

        {/* Title row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cfg.color.split(" ")[0]}`}
            >
              <Icon className={`h-4.5 w-4.5 ${cfg.color.split(" ")[1]}`} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold leading-snug text-[hsl(var(--foreground))]">
                {request.item_description}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <code className="rounded bg-[hsl(var(--secondary))] px-1.5 py-0.5 font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
                  {request.request_code}
                </code>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {request.category}
                  {request.sub_category ? ` / ${request.sub_category}` : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Status + priority badges */}
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Badge className={`${cfg.color} text-xs`} variant="outline">
              <Icon className="mr-1 h-3 w-3" />
              {cfg.label}
            </Badge>
            <Badge className={`${PRIORITY_COLORS[request.priority]} text-xs`} variant="outline">
              {request.priority === "critical" && <Zap className="mr-1 h-3 w-3" />}
              {request.priority}
            </Badge>
          </div>
        </div>

        {/* Reason text */}
        <p className="mt-3 line-clamp-2 text-sm text-[hsl(var(--muted-foreground))]">
          {request.reason}
        </p>

        {/* Manager review notes */}
        {request.review_notes && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-[hsl(var(--secondary))] p-3 text-xs">
            <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--primary))]" />
            <div>
              <span className="font-semibold text-[hsl(var(--foreground))]">Manager notes: </span>
              <span className="text-[hsl(var(--muted-foreground))]">{request.review_notes}</span>
            </div>
          </div>
        )}

        {/* Fulfillment time hint */}
        <p className="mt-2 flex items-center gap-1 text-[11px] italic text-[hsl(var(--muted-foreground))]/70">
          <Clock className="h-3 w-3" />
          {PRIORITY_HINT[request.priority]}
        </p>
      </div>

      {/* Timeline footer */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/30 px-5 py-3 text-xs text-[hsl(var(--muted-foreground))]">
        <span className="flex items-center gap-1.5">
          <Calendar className="h-3 w-3" />
          Submitted {new Date(request.created_at).toLocaleDateString()}
        </span>
        {request.reviewed_at && (
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3" />
            Reviewed {new Date(request.reviewed_at).toLocaleDateString()}
          </span>
        )}
        {request.fulfilled_at && (
          <span className="flex items-center gap-1.5 font-medium text-green-400">
            <Star className="h-3 w-3" />
            Fulfilled {new Date(request.fulfilled_at).toLocaleDateString()}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Status filter pills ──────────────────────────────────────────────────────

type StatusFilter = "all" | "pending" | "approved" | "fulfilled" | "rejected";

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all",       label: "All" },
  { value: "pending",   label: "Pending" },
  { value: "approved",  label: "Approved" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "rejected",  label: "Rejected" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyRequestsPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.REQUESTS, statusFilter],
    queryFn: () =>
      requestsApi
        .list({ status: statusFilter === "all" ? undefined : statusFilter, page_size: 50 })
        .then((r) => r.data),
  });

  const requests = data?.items ?? [];

  const counts: Record<StatusFilter, number> = {
    all:       data?.total ?? 0,
    pending:   requests.filter((r) => r.status === "pending").length,
    approved:  requests.filter((r) => r.status === "approved").length,
    fulfilled: requests.filter((r) => r.status === "fulfilled").length,
    rejected:  requests.filter((r) => r.status === "rejected").length,
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/my-assets")}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">My Requests</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Track the lifecycle of all your IT asset requests
            </p>
          </div>
        </div>
        <Button onClick={() => navigate("/make-request")} className="gap-2">
          <Plus className="h-4 w-4" />
          New Request
        </Button>
      </div>

      {/* ── Status filter chips ── */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
              statusFilter === opt.value
                ? "bg-[hsl(var(--primary))] text-white shadow-sm"
                : "border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))]/40 hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {opt.label}
            <span
              className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                statusFilter === opt.value
                  ? "bg-white/25 text-white"
                  : "bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]"
              }`}
            >
              {counts[opt.value]}
            </span>
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-40 items-center justify-center"
          >
            <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
          </motion.div>
        ) : requests.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Card className="border-dashed border-[hsl(var(--border))]">
              <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10">
                  <ClipboardList className="h-8 w-8 text-[hsl(var(--primary))]/60" />
                </div>
                <div>
                  <p className="font-semibold text-[hsl(var(--foreground))]">
                    {statusFilter === "all" ? "No requests yet" : `No ${statusFilter} requests`}
                  </p>
                  <p className="mt-1 max-w-xs text-sm text-[hsl(var(--muted-foreground))]">
                    {statusFilter === "all"
                      ? "Once you raise an IT asset request it will appear here with real-time status tracking."
                      : `You don't have any ${statusFilter} requests right now.`}
                  </p>
                </div>
                {statusFilter === "all" && (
                  <Button onClick={() => navigate("/make-request")} size="sm" className="gap-2">
                    <Plus className="h-3.5 w-3.5" />
                    Raise your first request
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key={`list-${statusFilter}`}
            variants={containerVariants}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {requests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
