import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Package2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Inbox,
  Send,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { requestsApi, assetsApi } from "@/lib/api";
import { QUERY_KEYS, PRIORITY_COLORS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { AssetRequest } from "@/types";

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  approved: { label: "Approved", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  rejected: { label: "Rejected", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  fulfilled: { label: "Fulfilled", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  cancelled: { label: "Cancelled", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
};

const PRIORITY_LEFT_BORDER: Record<string, string> = {
  low: "border-l-slate-400",
  normal: "border-l-blue-400",
  urgent: "border-l-amber-400",
  critical: "border-l-red-500",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string | null | undefined): string {
  if (!name) return "bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]";
  const colors = [
    "bg-blue-500/20 text-blue-400",
    "bg-purple-500/20 text-purple-400",
    "bg-green-500/20 text-green-400",
    "bg-amber-500/20 text-amber-400",
    "bg-rose-500/20 text-rose-400",
    "bg-cyan-500/20 text-cyan-400",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-l-4 border-[hsl(var(--border))] border-l-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 animate-pulse rounded-full bg-[hsl(var(--secondary))]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 animate-pulse rounded bg-[hsl(var(--secondary))]" />
          <div className="h-5 w-2/3 animate-pulse rounded bg-[hsl(var(--secondary))]" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-[hsl(var(--secondary))]" />
        </div>
        <div className="h-6 w-16 animate-pulse rounded-full bg-[hsl(var(--secondary))]" />
      </div>
    </div>
  );
}

// ─── Request Card ─────────────────────────────────────────────────────────────

function RequestCard({
  request,
  onApprove,
  onReject,
  onFulfill,
}: {
  request: AssetRequest;
  onApprove: (r: AssetRequest) => void;
  onReject: (r: AssetRequest) => void;
  onFulfill: (r: AssetRequest) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[request.status] ?? STATUS_CONFIG.pending;
  const borderColor = PRIORITY_LEFT_BORDER[request.priority] ?? "border-l-slate-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`overflow-hidden rounded-xl border border-l-4 border-[hsl(var(--border))] ${borderColor} bg-[hsl(var(--card))]`}
    >
      {/* Main row */}
      <div
        className="cursor-pointer p-4 transition-colors hover:bg-[hsl(var(--secondary))]/40"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Row 1: Avatar + requester + badges */}
        <div className="flex items-start gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${getAvatarColor(request.requester_name)}`}
          >
            {getInitials(request.requester_name)}
          </div>

          <div className="flex-1 min-w-0">
            {/* Name + dept */}
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-[hsl(var(--foreground))]">
                {request.requester_name ?? "Unknown Employee"}
              </p>
            </div>

            {/* Item description */}
            <p className="mt-0.5 font-semibold text-[hsl(var(--foreground))] leading-snug">
              {request.item_description}
            </p>

            {/* Meta row */}
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge className={PRIORITY_COLORS[request.priority]} variant="outline">
                {request.priority}
              </Badge>
              <Badge className={cfg.color} variant="outline">
                {cfg.label}
              </Badge>
              <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
                {request.request_code}
              </span>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">·</span>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{request.category}</span>
              {request.sub_category && (
                <>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">/</span>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">{request.sub_category}</span>
                </>
              )}
              <span className="text-xs text-[hsl(var(--muted-foreground))]">·</span>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                {new Date(request.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>

          {/* Action buttons + chevron */}
          <div className="flex shrink-0 items-center gap-2 pl-2">
            {request.status === "pending" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 border-green-500/40 text-xs text-green-400 hover:bg-green-500/10 hover:text-green-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    onApprove(request);
                  }}
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 border-red-500/40 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReject(request);
                  }}
                >
                  <XCircle className="mr-1 h-3 w-3" />
                  Reject
                </Button>
              </>
            )}
            {request.status === "approved" && (
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onFulfill(request);
                }}
              >
                <Send className="mr-1 h-3 w-3" />
                Fulfill
              </Button>
            )}
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            )}
          </div>
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/30 p-4 space-y-2">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  Justification
                </span>
                <p className="mt-1 text-sm text-[hsl(var(--foreground))]">{request.reason}</p>
              </div>
              {request.review_notes && (
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    Review Notes
                  </span>
                  <p className="mt-1 text-sm text-[hsl(var(--foreground))]">{request.review_notes}</p>
                </div>
              )}
              {request.requester_email && (
                <div className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                  <span>Email:</span>
                  <a
                    href={`mailto:${request.requester_email}`}
                    className="underline hover:text-[hsl(var(--foreground))]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {request.requester_email}
                  </a>
                </div>
              )}
              {request.fulfilled_at && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Fulfilled on: {new Date(request.fulfilled_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ManageRequestsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [approveDialog, setApproveDialog] = useState<AssetRequest | null>(null);
  const [rejectDialog, setRejectDialog] = useState<AssetRequest | null>(null);
  const [fulfillDialog, setFulfillDialog] = useState<AssetRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [fulfillAssetId, setFulfillAssetId] = useState("");
  const [fulfillValidityDate, setFulfillValidityDate] = useState("");

  // Fetch current filtered list
  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.REQUESTS, statusFilter],
    queryFn: () =>
      requestsApi
        .list({ status: statusFilter === "all" ? undefined : statusFilter, page_size: 50 })
        .then((r) => r.data),
  });

  // Stats: fetch counts per status
  const { data: allData } = useQuery({
    queryKey: [...QUERY_KEYS.REQUESTS, "all-stats"],
    queryFn: () => requestsApi.list({ page_size: 1 }).then((r) => r.data),
  });
  const { data: pendingData } = useQuery({
    queryKey: [...QUERY_KEYS.REQUESTS, "pending-stats"],
    queryFn: () => requestsApi.list({ status: "pending", page_size: 1 }).then((r) => r.data),
  });
  const { data: approvedData } = useQuery({
    queryKey: [...QUERY_KEYS.REQUESTS, "approved-stats"],
    queryFn: () => requestsApi.list({ status: "approved", page_size: 1 }).then((r) => r.data),
  });
  const { data: fulfilledData } = useQuery({
    queryKey: [...QUERY_KEYS.REQUESTS, "fulfilled-stats"],
    queryFn: () => requestsApi.list({ status: "fulfilled", page_size: 1 }).then((r) => r.data),
  });

  const { data: availableAssets } = useQuery({
    queryKey: [...QUERY_KEYS.ASSETS, "available", fulfillDialog?.category],
    queryFn: () =>
      assetsApi
        .list({ status: "available", category: fulfillDialog?.category, page_size: 50 })
        .then((r) => r.data),
    enabled: !!fulfillDialog,
  });

  const approveMutation = useMutation({
    mutationFn: (r: AssetRequest) => requestsApi.approve(r.id, reviewNotes || undefined).then((d) => d.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.REQUESTS });
      setApproveDialog(null);
      setReviewNotes("");
      toast({ title: "Request approved" });
    },
    onError: () => toast({ title: "Failed to approve", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: (r: AssetRequest) => requestsApi.reject(r.id, reviewNotes).then((d) => d.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.REQUESTS });
      setRejectDialog(null);
      setReviewNotes("");
      toast({ title: "Request rejected" });
    },
    onError: () => toast({ title: "Failed to reject", variant: "destructive" }),
  });

  const fulfillMutation = useMutation({
    mutationFn: (r: AssetRequest) =>
      requestsApi.fulfill(r.id, fulfillAssetId, fulfillValidityDate || undefined).then((d) => d.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.REQUESTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ASSETS });
      setFulfillDialog(null);
      setFulfillAssetId("");
      setFulfillValidityDate("");
      toast({ title: "Request fulfilled and asset assigned" });
    },
    onError: () => toast({ title: "Failed to fulfill request", variant: "destructive" }),
  });

  const requests = data?.items ?? [];
  const noAssetsAvailable = (availableAssets?.items ?? []).length === 0;

  const TABS = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "fulfilled", label: "Fulfilled" },
    { value: "rejected", label: "Rejected" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Asset Requests</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Review and fulfill employee IT asset requests
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Total Requests",
            value: allData?.total ?? 0,
            icon: Inbox,
            color: "text-[hsl(var(--primary))]",
            bg: "bg-[hsl(var(--primary))]/10",
          },
          {
            label: "Pending",
            value: pendingData?.total ?? 0,
            icon: Clock,
            color: "text-amber-400",
            bg: "bg-amber-500/10",
          },
          {
            label: "Approved",
            value: approvedData?.total ?? 0,
            icon: CheckCircle2,
            color: "text-blue-400",
            bg: "bg-blue-500/10",
          },
          {
            label: "Fulfilled",
            value: fulfilledData?.total ?? 0,
            icon: Send,
            color: "text-green-400",
            bg: "bg-green-500/10",
          },
        ].map((s) => (
          <Card key={s.label} className="border-[hsl(var(--border))]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${s.bg}`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xl font-bold text-[hsl(var(--foreground))]">{s.value}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
              statusFilter === tab.value
                ? "bg-[hsl(var(--primary))] text-white shadow-sm"
                : "border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))]/40 hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <Card className="border-dashed border-[hsl(var(--border))]">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--secondary))]">
              <Package2 className="h-8 w-8 text-[hsl(var(--muted-foreground))]/50" />
            </div>
            <div className="text-center">
              <p className="font-medium text-[hsl(var(--foreground))]">
                No {statusFilter === "all" ? "" : statusFilter} requests
              </p>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                {statusFilter === "pending"
                  ? "All caught up! No pending requests to review."
                  : statusFilter === "approved"
                  ? "No approved requests awaiting fulfillment."
                  : "No requests match this filter."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              onApprove={setApproveDialog}
              onReject={setRejectDialog}
              onFulfill={setFulfillDialog}
            />
          ))}
        </div>
      )}

      {/* Approve Dialog */}
      <Dialog
        open={!!approveDialog}
        onOpenChange={(open) => {
          if (!open) {
            setApproveDialog(null);
            setReviewNotes("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Request</DialogTitle>
            <DialogDescription className="font-medium text-[hsl(var(--foreground))]">
              {approveDialog?.item_description}
            </DialogDescription>
          </DialogHeader>

          {approveDialog && (
            <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[hsl(var(--muted-foreground))]">Requester</span>
                <span className="font-medium">{approveDialog.requester_name ?? "Unknown"}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-[hsl(var(--muted-foreground))]">Category</span>
                <span>{approveDialog.category}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-[hsl(var(--muted-foreground))]">Priority</span>
                <Badge className={PRIORITY_COLORS[approveDialog.priority]} variant="outline">
                  {approveDialog.priority}
                </Badge>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Notes for employee (optional)</Label>
              <Textarea
                rows={3}
                placeholder="Any instructions or notes to share with the requester..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
            </div>
            <Button
              className="w-full gap-2 bg-green-600 hover:bg-green-500"
              disabled={approveMutation.isPending}
              onClick={() => approveMutation.mutate(approveDialog!)}
            >
              {approveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Approve Request
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={!!rejectDialog}
        onOpenChange={(open) => {
          if (!open) {
            setRejectDialog(null);
            setReviewNotes("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
            <DialogDescription className="font-medium text-[hsl(var(--foreground))]">
              {rejectDialog?.item_description}
            </DialogDescription>
          </DialogHeader>

          {rejectDialog && (
            <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[hsl(var(--muted-foreground))]">Requester</span>
                <span className="font-medium">{rejectDialog.requester_name ?? "Unknown"}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-[hsl(var(--muted-foreground))]">Category</span>
                <span>{rejectDialog.category}</span>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>
                Reason for rejection <span className="text-red-400">*</span>
              </Label>
              <Textarea
                rows={3}
                placeholder="Explain why this request is being rejected..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                This reason will be shared with the employee.
              </p>
            </div>
            <Button
              variant="destructive"
              className="w-full gap-2"
              disabled={!reviewNotes.trim() || rejectMutation.isPending}
              onClick={() => rejectMutation.mutate(rejectDialog!)}
            >
              {rejectMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  Reject Request
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fulfill Dialog */}
      <Dialog
        open={!!fulfillDialog}
        onOpenChange={(open) => {
          if (!open) {
            setFulfillDialog(null);
            setFulfillAssetId("");
            setFulfillValidityDate("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Fulfill Request</DialogTitle>
            <DialogDescription>
              Assign a specific asset to fulfill this request
            </DialogDescription>
          </DialogHeader>

          {fulfillDialog && (
            <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/40 p-3 text-sm">
              <p className="font-semibold text-[hsl(var(--foreground))]">{fulfillDialog.item_description}</p>
              <div className="mt-1 flex gap-2">
                <span className="text-[hsl(var(--muted-foreground))]">For:</span>
                <span>{fulfillDialog.requester_name ?? "Unknown"}</span>
              </div>
              <div className="mt-1 flex gap-2">
                <span className="text-[hsl(var(--muted-foreground))]">Category:</span>
                <span>{fulfillDialog.category}</span>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>
                Available Asset <span className="text-red-400">*</span>
              </Label>
              <Select value={fulfillAssetId} onValueChange={setFulfillAssetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select available asset..." />
                </SelectTrigger>
                <SelectContent>
                  {(availableAssets?.items ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="font-mono font-semibold">{a.asset_tag}</span>
                      {" — "}
                      {a.brand ? `${a.brand} ` : ""}
                      {a.model ?? a.category}
                      <span className="ml-1 text-[hsl(var(--muted-foreground))]">({a.condition})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {noAssetsAvailable && (
                <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    No available assets in this category. Please add assets first.
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Validity Date</Label>
              <Input
                type="date"
                value={fulfillValidityDate}
                onChange={(e) => setFulfillValidityDate(e.target.value)}
              />
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Leave blank for indefinite assignment
              </p>
            </div>

            <Button
              className="w-full gap-2"
              disabled={!fulfillAssetId || fulfillMutation.isPending}
              onClick={() => fulfillMutation.mutate(fulfillDialog!)}
            >
              {fulfillMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Assign Asset &amp; Fulfill Request
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
