import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Loader2, Brain } from "lucide-react";
import {
  useListAnomalies,
  useAcknowledgeAnomaly,
  useResolveAnomaly,
  useDismissAnomaly,
} from "@/hooks/use-queries";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { SEVERITY_COLORS } from "@/lib/constants";
import type { Anomaly } from "@/types";

const resolveSchema = z.object({
  notes: z.string().min(10, "Resolution notes must be at least 10 characters"),
});

type ResolveForm = z.infer<typeof resolveSchema>;

function ResolveModal({
  anomaly,
  onClose,
}: {
  anomaly: Anomaly | null;
  onClose: () => void;
}) {
  const resolveAnomaly = useResolveAnomaly();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ResolveForm>({ resolver: zodResolver(resolveSchema) });

  async function onSubmit(data: ResolveForm) {
    if (!anomaly) return;
    try {
      await resolveAnomaly.mutateAsync({ id: anomaly.id, notes: data.notes });
      toast({ title: "Anomaly resolved" });
      reset();
      onClose();
    } catch {
      toast({ title: "Failed to resolve anomaly", variant: "destructive" });
    }
  }

  return (
    <Dialog open={!!anomaly} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve Anomaly</DialogTitle>
        </DialogHeader>
        {anomaly && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-900/50 p-3">
              <p className="font-medium">{anomaly.stock_name}</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{anomaly.anomaly_type}</p>
              <p className="mt-2 text-sm">{anomaly.ai_explanation}</p>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>Resolution Notes *</Label>
                <Textarea
                  placeholder="Describe the steps taken to resolve this anomaly..."
                  rows={4}
                  {...register("notes")}
                />
                {errors.notes && (
                  <p className="text-xs text-red-400">{errors.notes.message}</p>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={resolveAnomaly.isPending}>
                  {resolveAnomaly.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Mark Resolved
                </Button>
              </DialogFooter>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AnomalyCard({ anomaly }: { anomaly: Anomaly }) {
  const [showFull, setShowFull] = useState(false);
  const acknowledge = useAcknowledgeAnomaly();
  const dismiss = useDismissAnomaly();

  const isInactive = anomaly.status !== "active";

  const severityDot = {
    critical: "bg-red-500",
    warning: "bg-yellow-500",
    info: "bg-blue-500",
  }[anomaly.severity];

  return (
    <div className={cn(
      "rounded-xl border p-5 space-y-4 transition-all",
      isInactive ? "opacity-50" : "",
      anomaly.severity === "critical" ? "border-red-500/30 bg-red-500/5" :
      anomaly.severity === "warning" ? "border-yellow-500/30 bg-yellow-500/5" :
      "border-blue-500/30 bg-blue-500/5"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-full", severityDot)} />
            <span className={cn(
              "rounded-full border px-2 py-0.5 text-xs font-semibold",
              SEVERITY_COLORS[anomaly.severity]
            )}>
              {anomaly.severity.toUpperCase()}
            </span>
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              {anomaly.anomaly_type}
            </span>
          </div>
          <p className="mt-1 font-semibold">{anomaly.stock_name}</p>
          <p className="font-mono text-xs text-[hsl(var(--muted-foreground))]">{anomaly.stock_code}</p>
        </div>
        <div className="text-right">
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", {
            "bg-red-500/20 text-red-400": anomaly.status === "active",
            "bg-blue-500/20 text-blue-400": anomaly.status === "acknowledged",
            "bg-green-500/20 text-green-400": anomaly.status === "resolved",
            "bg-gray-500/20 text-gray-400": anomaly.status === "dismissed",
          })}>
            {anomaly.status}
          </span>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            {formatRelativeTime(anomaly.detected_at)}
          </p>
        </div>
      </div>

      {/* AI Explanation */}
      <div className="rounded-lg border border-[hsl(var(--border))]/50 bg-slate-900/50 p-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--primary))]">
          <Brain className="h-3 w-3" />
          AI Explanation
        </div>
        <p className="text-sm">
          {showFull ? anomaly.ai_explanation : anomaly.ai_explanation.slice(0, 160)}
          {anomaly.ai_explanation.length > 160 && !showFull && "..."}
        </p>
        {anomaly.ai_explanation.length > 160 && (
          <button
            onClick={() => setShowFull((v) => !v)}
            className="mt-1 text-xs text-[hsl(var(--primary))] hover:underline"
          >
            {showFull ? "Show less" : "Read more"}
          </button>
        )}
      </div>

      {/* Recommended action */}
      <div>
        <p className="mb-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">Recommended Action</p>
        <p className="text-sm">{anomaly.recommended_action}</p>
      </div>

      {/* Resolution info */}
      {anomaly.status === "resolved" && anomaly.resolved_at && (
        <div className="rounded-lg bg-green-500/10 px-3 py-2 text-xs text-green-400">
          Resolved by {anomaly.resolved_by} · {formatRelativeTime(anomaly.resolved_at)}
          {anomaly.resolution_notes && (
            <p className="mt-1 text-green-400/70">{anomaly.resolution_notes}</p>
          )}
        </div>
      )}

      {/* Actions */}
      {anomaly.status === "active" && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={acknowledge.isPending}
            onClick={async () => {
              try {
                await acknowledge.mutateAsync(anomaly.id);
                toast({ title: "Anomaly acknowledged" });
              } catch {
                toast({ title: "Failed to acknowledge", variant: "destructive" });
              }
            }}
          >
            {acknowledge.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Acknowledge
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            disabled={dismiss.isPending}
            onClick={async () => {
              try {
                await dismiss.mutateAsync(anomaly.id);
                toast({ title: "Anomaly dismissed" });
              } catch {
                toast({ title: "Failed to dismiss", variant: "destructive" });
              }
            }}
          >
            <EyeOff className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AnomaliesPage() {
  const [severity, setSeverity] = useState("");
  const [resolveAnomaly, setResolveAnomaly] = useState<Anomaly | null>(null);

  const { data: allData, isLoading } = useListAnomalies({ severity: severity || undefined });
  const { data: criticalData } = useListAnomalies({ severity: "critical", status: "active" });
  const { data: warningData } = useListAnomalies({ severity: "warning", status: "active" });
  const { data: infoData } = useListAnomalies({ severity: "info" });

  const anomalies = allData?.items ?? [];
  const activeCount = (criticalData?.total ?? 0) + (warningData?.total ?? 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Anomaly Detection</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {activeCount} active anomaly{activeCount !== 1 ? "ies" : ""} requiring attention
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Critical", count: criticalData?.total ?? 0, color: "text-red-400 bg-red-500/10 border-red-500/30" },
          { label: "Warning", count: warningData?.total ?? 0, color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" },
          { label: "Info", count: infoData?.total ?? 0, color: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
        ].map(({ label, count, color }) => (
          <div key={label} className={`rounded-lg border px-4 py-3 ${color}`}>
            <p className="text-2xl font-bold">{count}</p>
            <p className="text-sm">{label}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="all" onValueChange={(v) => setSeverity(v === "all" ? "" : v)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="critical">
            Critical
            {(criticalData?.total ?? 0) > 0 && (
              <span className="ml-2 rounded-full bg-red-500/20 px-1.5 py-0.5 text-xs text-red-400">
                {criticalData?.total}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="warning">Warning</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <AnomalyGrid
            anomalies={anomalies}
            isLoading={isLoading}
            onResolve={setResolveAnomaly}
          />
        </TabsContent>
        <TabsContent value="critical" className="mt-4">
          <AnomalyGrid
            anomalies={anomalies}
            isLoading={isLoading}
            onResolve={setResolveAnomaly}
          />
        </TabsContent>
        <TabsContent value="warning" className="mt-4">
          <AnomalyGrid
            anomalies={anomalies}
            isLoading={isLoading}
            onResolve={setResolveAnomaly}
          />
        </TabsContent>
        <TabsContent value="info" className="mt-4">
          <AnomalyGrid
            anomalies={anomalies}
            isLoading={isLoading}
            onResolve={setResolveAnomaly}
          />
        </TabsContent>
      </Tabs>

      <ResolveModal
        anomaly={resolveAnomaly}
        onClose={() => setResolveAnomaly(null)}
      />
    </div>
  );
}

function AnomalyGrid({
  anomalies,
  isLoading,
  onResolve,
}: {
  anomalies: Anomaly[];
  isLoading: boolean;
  onResolve: (a: Anomaly) => void;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
      </div>
    );
  }

  if (anomalies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckCircle2 className="mb-3 h-12 w-12 text-green-500/50" />
        <h3 className="text-lg font-semibold">No anomalies found</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Inventory is looking healthy!
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {anomalies.map((anomaly) => (
        <div key={anomaly.id} className="relative">
          <AnomalyCard anomaly={anomaly} />
          {anomaly.status === "acknowledged" && (
            <button
              onClick={() => onResolve(anomaly)}
              className="mt-2 w-full rounded-lg border border-green-500/30 bg-green-500/10 py-2 text-sm font-medium text-green-400 hover:bg-green-500/20 transition-colors"
            >
              <CheckCircle2 className="mr-2 inline h-4 w-4" />
              Mark as Resolved
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
