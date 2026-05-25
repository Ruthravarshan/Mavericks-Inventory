import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckSquare, Loader2, Brain, Clock, User, ChevronDown, ChevronUp } from "lucide-react";
import { useListApprovals, useApproveL1, useRejectL1, useApproveL2, useRejectL2, useBulkApprove } from "@/hooks/use-queries";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatDate, formatRelativeTime, truncate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { RISK_COLORS } from "@/lib/constants";
import type { Approval } from "@/types";

const rejectSchema = z.object({
  remarks: z.string().min(20, "Remarks must be at least 20 characters"),
});

type RejectForm = z.infer<typeof rejectSchema>;

function RejectModal({
  approval,
  isL2,
  onClose,
}: {
  approval: Approval | null;
  isL2: boolean;
  onClose: () => void;
}) {
  const rejectL1 = useRejectL1();
  const rejectL2 = useRejectL2();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RejectForm>({ resolver: zodResolver(rejectSchema) });

  async function onSubmit(data: RejectForm) {
    if (!approval) return;
    try {
      if (isL2) {
        await rejectL2.mutateAsync({ id: approval.id, remarks: data.remarks });
      } else {
        await rejectL1.mutateAsync({ id: approval.id, remarks: data.remarks });
      }
      toast({ title: "Distribution rejected" });
      reset();
      onClose();
    } catch {
      toast({ title: "Failed to reject", variant: "destructive" });
    }
  }

  const isPending = rejectL1.isPending || rejectL2.isPending;

  return (
    <Dialog open={!!approval} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Distribution</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Please provide a reason for rejecting <strong>{approval?.transaction_code}</strong>.
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Rejection Remarks *</Label>
            <Textarea
              placeholder="Explain the reason for rejection (min. 20 characters)..."
              rows={4}
              {...register("remarks")}
            />
            {errors.remarks && (
              <p className="text-xs text-red-400">{errors.remarks.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Reject Distribution
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ApprovalCard({
  approval,
  level,
  onApprove,
  onReject,
}: {
  approval: Approval;
  level: "l1" | "l2";
  onApprove: () => void;
  onReject: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const approveL1 = useApproveL1();
  const approveL2 = useApproveL2();
  const isApproving = approveL1.isPending || approveL2.isPending;

  async function handleApprove() {
    try {
      if (level === "l2") {
        await approveL2.mutateAsync({ id: approval.id });
      } else {
        await approveL1.mutateAsync({ id: approval.id });
      }
      toast({ title: `Distribution ${approval.transaction_code} approved` });
      onApprove();
    } catch {
      toast({ title: "Failed to approve", variant: "destructive" });
    }
  }

  return (
    <div className={cn(
      "rounded-xl border bg-slate-800/50 p-5 space-y-4 transition-all",
      approval.risk_level === "High" ? "border-red-500/30" :
      approval.risk_level === "Medium" ? "border-amber-500/30" :
      "border-slate-700/50"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold">{approval.transaction_code}</span>
            <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", RISK_COLORS[approval.risk_level])}>
              {approval.risk_level} Risk
            </span>
          </div>
          <p className="mt-1 font-medium">{approval.stock_name}</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {approval.qty_requested} {approval.uom} requested
          </p>
        </div>

        <div className="text-right">
          <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", {
            "bg-green-500/20 text-green-400": approval.ai_recommendation === "Approve",
            "bg-amber-500/20 text-amber-400": approval.ai_recommendation === "Review",
            "bg-red-500/20 text-red-400": approval.ai_recommendation === "Reject",
          })}>
            <Brain className="mr-1 h-3 w-3" />
            AI: {approval.ai_recommendation}
          </span>
          <div className="mt-1 flex items-center justify-end gap-1 text-xs text-[hsl(var(--muted-foreground))]">
            <Clock className="h-3 w-3" />
            {approval.days_pending} day{approval.days_pending !== 1 ? "s" : ""} pending
          </div>
        </div>
      </div>

      {/* Recipient & date */}
      <div className="flex items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
        <div className="flex items-center gap-1">
          <User className="h-3 w-3" />
          {approval.recipient_name} ({approval.recipient_type})
        </div>
        <div>Dist. date: {formatDate(approval.distribution_date)}</div>
        <div>By: {approval.created_by_name}</div>
      </div>

      {/* AI Reasoning */}
      <div className="rounded-lg border border-[hsl(var(--border))] bg-slate-900/50 p-3">
        <p className="mb-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">AI Reasoning</p>
        <p className="text-sm">
          {expanded ? approval.ai_reasoning : truncate(approval.ai_reasoning, 180)}
        </p>
        {approval.ai_reasoning.length > 180 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:underline"
          >
            {expanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Read more</>}
          </button>
        )}
      </div>

      {/* Purpose */}
      <div>
        <p className="mb-1 text-xs text-[hsl(var(--muted-foreground))]">Purpose</p>
        <p className="text-sm">{approval.purpose}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="flex-1 bg-green-600 hover:bg-green-700"
          onClick={handleApprove}
          disabled={isApproving}
        >
          {isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4" />}
          Approve
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="flex-1"
          onClick={onReject}
        >
          Reject
        </Button>
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  const { isL2, isManager, isAdmin } = useAuth();
  const [riskFilter, setRiskFilter] = useState("");
  const [rejectApproval, setRejectApproval] = useState<Approval | null>(null);
  const [rejectIsL2, setRejectIsL2] = useState(false);
  const bulkApprove = useBulkApprove();

  const level = isL2 ? "l2" : "l1";

  const { data: l1Data, isLoading: l1Loading } = useListApprovals({
    level: "l1",
    status: "l1_pending",
    risk_level: riskFilter || undefined,
  });

  const { data: l2Data, isLoading: l2Loading } = useListApprovals({
    level: "l2",
    status: "l2_pending",
    risk_level: riskFilter || undefined,
  });

  const l1Approvals = l1Data?.items ?? [];
  const l2Approvals = l2Data?.items ?? [];
  const totalPending = (l1Data?.total ?? 0) + (l2Data?.total ?? 0);

  async function handleBulkApprove() {
    const lowRisk = l1Approvals.filter((a) => a.risk_level === "Low").map((a) => a.id);
    if (lowRisk.length === 0) {
      toast({ title: "No low-risk items to bulk approve" });
      return;
    }
    try {
      const result = await bulkApprove.mutateAsync(lowRisk);
      toast({ title: `Bulk approved ${result.approved} low-risk distributions` });
    } catch {
      toast({ title: "Bulk approve failed", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Approvals</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {totalPending} pending approval{totalPending !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-3">
          <Select value={riskFilter} onValueChange={(v) => setRiskFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Risk Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Risk</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="High">High</SelectItem>
            </SelectContent>
          </Select>
          {(isManager || isAdmin) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkApprove}
              disabled={bulkApprove.isPending}
            >
              {bulkApprove.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Bulk Approve (Low Risk)
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="l1">
        <TabsList>
          <TabsTrigger value="l1">
            L1 Pending
            {l1Data?.total ? (
              <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
                {l1Data.total}
              </span>
            ) : null}
          </TabsTrigger>
          {(isL2 || isAdmin) && (
            <TabsTrigger value="l2">
              L2 Pending
              {l2Data?.total ? (
                <span className="ml-2 rounded-full bg-orange-500/20 px-2 py-0.5 text-xs text-orange-400">
                  {l2Data.total}
                </span>
              ) : null}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="l1" className="mt-4">
          {l1Loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
            </div>
          ) : l1Approvals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckSquare className="mb-3 h-12 w-12 text-green-500/50" />
              <h3 className="text-lg font-semibold">All caught up!</h3>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No L1 approvals pending</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {l1Approvals.map((approval) => (
                <ApprovalCard
                  key={approval.id}
                  approval={approval}
                  level="l1"
                  onApprove={() => {}}
                  onReject={() => {
                    setRejectApproval(approval);
                    setRejectIsL2(false);
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {(isL2 || isAdmin) && (
          <TabsContent value="l2" className="mt-4">
            {l2Loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
              </div>
            ) : l2Approvals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CheckSquare className="mb-3 h-12 w-12 text-green-500/50" />
                <h3 className="text-lg font-semibold">No L2 approvals pending</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  High-value distributions requiring L2 authorization will appear here
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {l2Approvals.map((approval) => (
                  <ApprovalCard
                    key={approval.id}
                    approval={approval}
                    level="l2"
                    onApprove={() => {}}
                    onReject={() => {
                      setRejectApproval(approval);
                      setRejectIsL2(true);
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      <RejectModal
        approval={rejectApproval}
        isL2={rejectIsL2}
        onClose={() => setRejectApproval(null)}
      />
    </div>
  );
}
