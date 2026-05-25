import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Clock, User, Brain } from "lucide-react";
import { useListDistributions, useGetDistribution } from "@/hooks/use-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatDateTime, truncate, cn } from "@/lib/utils";
import { STATUS_LABELS, STATUS_COLORS, RISK_COLORS } from "@/lib/constants";
import type { Distribution } from "@/types";

function DistributionDetailModal({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const { data: distribution, isLoading } = useGetDistribution(id ?? "");
  const [showFullReasoning, setShowFullReasoning] = useState(false);

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Distribution Details</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
          </div>
        ) : !distribution ? (
          <p className="text-center text-[hsl(var(--muted-foreground))]">Not found</p>
        ) : (
          <div className="space-y-6">
            {/* Status header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-lg font-bold">{distribution.transaction_code}</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Created {formatDate(distribution.created_at)} by {distribution.created_by_name}
                </p>
              </div>
              <span className={cn("rounded-full border px-3 py-1 text-sm font-medium", STATUS_COLORS[distribution.status])}>
                {STATUS_LABELS[distribution.status] ?? distribution.status}
              </span>
            </div>

            <Separator />

            {/* Stock & Qty */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Stock</p>
                <p className="font-medium">{distribution.stock_name}</p>
                <p className="font-mono text-xs text-[hsl(var(--muted-foreground))]">{distribution.stock_code}</p>
              </div>
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Category</p>
                <p className="font-medium">{distribution.stock_category}</p>
              </div>
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Requested Qty</p>
                <p className="font-medium">{distribution.qty_requested} {distribution.uom}</p>
              </div>
              {distribution.qty_approved != null && (
                <div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Approved Qty</p>
                  <p className="font-medium">{distribution.qty_approved} {distribution.uom}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Recipient */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Recipient</p>
                <p className="font-medium">{distribution.recipient_name}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {distribution.recipient_type === "employee" ? "Employee" : "Project"} · {distribution.recipient_id}
                </p>
              </div>
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Distribution Date</p>
                <p className="font-medium">{formatDate(distribution.distribution_date)}</p>
              </div>
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Location</p>
                <p className="font-medium">{distribution.location}</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Purpose</p>
              <p className="mt-1 text-sm">{distribution.purpose}</p>
            </div>

            <Separator />

            {/* AI Risk Assessment */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Brain className="h-4 w-4 text-[hsl(var(--primary))]" />
                <h3 className="text-sm font-semibold">AI Risk Assessment</h3>
              </div>
              <div className="rounded-lg border border-[hsl(var(--border))] bg-slate-900/50 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", RISK_COLORS[distribution.risk_level])}>
                    {distribution.risk_level} Risk · Score: {distribution.risk_score}
                  </span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", {
                    "bg-green-500/20 text-green-400": distribution.ai_recommendation === "Approve",
                    "bg-amber-500/20 text-amber-400": distribution.ai_recommendation === "Review",
                    "bg-red-500/20 text-red-400": distribution.ai_recommendation === "Reject",
                  })}>
                    AI: {distribution.ai_recommendation}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">AI Reasoning</p>
                  <p className="text-sm">
                    {showFullReasoning
                      ? distribution.ai_reasoning
                      : truncate(distribution.ai_reasoning, 200)}
                  </p>
                  {distribution.ai_reasoning.length > 200 && (
                    <button
                      onClick={() => setShowFullReasoning((v) => !v)}
                      className="mt-1 text-xs text-[hsl(var(--primary))] hover:underline"
                    >
                      {showFullReasoning ? "Show less" : "Read more"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Approval Timeline */}
            {distribution.approval_history.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="mb-3 text-sm font-semibold">Approval History</h3>
                  <div className="space-y-3">
                    {distribution.approval_history.map((event, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={cn("h-3 w-3 rounded-full border-2", {
                            "border-green-400 bg-green-400": event.action.includes("approve"),
                            "border-red-400 bg-red-400": event.action.includes("reject"),
                            "border-blue-400 bg-blue-400": event.action.includes("submit"),
                          })} />
                          {i < distribution.approval_history.length - 1 && (
                            <div className="w-0.5 flex-1 bg-slate-700" />
                          )}
                        </div>
                        <div className="pb-3">
                          <p className="text-sm font-medium capitalize">{event.action.replace(/_/g, " ")}</p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">
                            {event.actor_name} · {event.actor_role} · {formatDateTime(event.timestamp)}
                          </p>
                          {event.remarks && (
                            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))] italic">"{event.remarks}"</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function DistributionsPage() {
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useListDistributions({
    page,
    page_size: 20,
    search: search || undefined,
    status: status || undefined,
    risk_level: riskLevel || undefined,
  });

  const distributions = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Distributions</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{data?.total ?? 0} total transactions</p>
        </div>
        <Button onClick={() => navigate("/distributions/new")}>
          <Plus className="h-4 w-4" />
          New Distribution
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <Input
            placeholder="Search by code, stock, recipient..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="l1_pending">L1 Pending</SelectItem>
            <SelectItem value="l2_pending">L2 Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={riskLevel} onValueChange={(v) => { setRiskLevel(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Risk" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risk</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="High">High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[hsl(var(--border))] bg-slate-800/30">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transaction Code</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead>AI Rec.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : distributions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-[hsl(var(--muted-foreground))]">
                  No distributions found.{" "}
                  <button
                    onClick={() => navigate("/distributions/new")}
                    className="text-[hsl(var(--primary))] hover:underline"
                  >
                    Create your first distribution.
                  </button>
                </TableCell>
              </TableRow>
            ) : (
              distributions.map((dist) => (
                <TableRow
                  key={dist.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(dist.id)}
                >
                  <TableCell className="font-mono text-sm">{dist.transaction_code}</TableCell>
                  <TableCell>
                    <div className="font-medium">{dist.stock_name}</div>
                    <div className="font-mono text-xs text-[hsl(var(--muted-foreground))]">{dist.stock_code}</div>
                  </TableCell>
                  <TableCell className="text-right font-medium">{dist.qty_requested.toLocaleString()} {dist.uom}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <User className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                      {dist.recipient_name}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(dist.distribution_date)}</TableCell>
                  <TableCell>
                    <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", STATUS_COLORS[dist.status])}>
                      {STATUS_LABELS[dist.status] ?? dist.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", RISK_COLORS[dist.risk_level])}>
                      {dist.risk_level}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", {
                      "bg-green-500/20 text-green-400": dist.ai_recommendation === "Approve",
                      "bg-amber-500/20 text-amber-400": dist.ai_recommendation === "Review",
                      "bg-red-500/20 text-red-400": dist.ai_recommendation === "Reject",
                    })}>
                      {dist.ai_recommendation}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      <DistributionDetailModal id={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
