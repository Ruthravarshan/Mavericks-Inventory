import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, CheckCircle2, AlertTriangle, Clock, ChevronRight, Play, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { reconciliationApi, type ReconciliationItem } from "@/lib/api";

type ReconcileStatus = "matched" | "variance" | "pending" | "draft_adjustment";

const STATUS_CONFIG: Record<ReconcileStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  matched:          { label: "Matched",          color: "text-emerald-400 bg-emerald-400/10", icon: CheckCircle2 },
  variance:         { label: "Variance",         color: "text-amber-400 bg-amber-400/10",     icon: AlertTriangle },
  pending:          { label: "Count Pending",    color: "text-blue-400 bg-blue-400/10",       icon: Clock },
  draft_adjustment: { label: "Draft Adjustment", color: "text-purple-400 bg-purple-400/10",   icon: RefreshCw },
};

export default function ReconciliationPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [physicalInput, setPhysicalInput] = useState<Record<string, string>>({});
  const [runningRecon, setRunningRecon] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["reconciliation"],
    queryFn: () => reconciliationApi.list().then((r) => r.data),
    staleTime: 30_000,
  });

  const submitCount = useMutation({
    mutationFn: ({ stock_id, physical_qty }: { stock_id: string; physical_qty: number }) =>
      reconciliationApi.submitCount(stock_id, physical_qty).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["reconciliation"] });
    },
  });

  const items: ReconciliationItem[] = data?.items ?? [];
  const summary = data?.summary ?? { matched: 0, variance: 0, draft_adjustment: 0, pending: 0 };

  const selectedItem = items.find((i) => i.id === selected);

  function runReconciliation() {
    setRunningRecon(true);
    refetch().finally(() => setRunningRecon(false));
  }

  function handleCountSubmit(item: ReconciliationItem) {
    const raw = physicalInput[item.id];
    if (raw === undefined || raw === "") return;
    const qty = Number(raw);
    if (isNaN(qty) || qty < 0) return;
    submitCount.mutate({ stock_id: item.id, physical_qty: qty });
    setPhysicalInput((p) => ({ ...p, [item.id]: "" }));
  }

  return (
    <div className="flex gap-6 h-full">
      {/* Main panel */}
      <div className="flex-1 space-y-5 min-w-0">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-[hsl(var(--primary))]" />
              <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Reconciliation</h1>
            </div>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              System vs physical inventory comparison
            </p>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-colors">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Import Count Sheet
            </button>
            <button
              onClick={runReconciliation}
              disabled={runningRecon || isLoading}
              className="flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-xs font-semibold text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              <Play className={cn("h-3.5 w-3.5", runningRecon && "animate-spin")} />
              {runningRecon ? "Running…" : "Run Reconciliation"}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Matched",       value: summary.matched,          color: "text-emerald-400" },
            { label: "Variances",     value: summary.variance,         color: "text-amber-400"   },
            { label: "Draft Adj.",    value: summary.draft_adjustment,  color: "text-purple-400"  },
            { label: "Count Pending", value: summary.pending,           color: "text-blue-400"    },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
              <p className={cn("mt-1 text-2xl font-bold tabular-nums", color)}>{value}</p>
            </div>
          ))}
        </div>

        {/* Items table */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/30">
                {["Stock", "Category", "Location", "System Qty", "Physical Count", "Variance", "Status", "Last Counted", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
                    No active stocks found.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const cfg = STATUS_CONFIG[item.status];
                  const Icon = cfg.icon;
                  const isSelected = selected === item.id;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelected(isSelected ? null : item.id)}
                      className={cn(
                        "border-b border-[hsl(var(--border))]/50 cursor-pointer transition-colors",
                        isSelected ? "bg-[hsl(var(--primary))]/8" : "hover:bg-[hsl(var(--secondary))]/30"
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-[hsl(var(--foreground))]">{item.stock_name}</div>
                        <div className="text-[11px] font-mono text-[hsl(var(--muted-foreground))]">{item.stock_code}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">{item.category}</td>
                      <td className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">{item.location || "—"}</td>
                      <td className="px-4 py-3 tabular-nums text-sm font-medium text-[hsl(var(--foreground))]">{item.system_qty}</td>
                      <td className="px-4 py-3">
                        {item.physical_qty !== null ? (
                          <span className="tabular-nums text-sm font-medium text-[hsl(var(--foreground))]">{item.physical_qty}</span>
                        ) : (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="number"
                              placeholder="Enter count"
                              value={physicalInput[item.id] ?? ""}
                              onChange={(e) => setPhysicalInput((p) => ({ ...p, [item.id]: e.target.value }))}
                              className="h-7 w-24 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-[hsl(var(--foreground))] focus:border-[hsl(var(--primary))] focus:outline-none"
                            />
                            <button
                              onClick={() => handleCountSubmit(item)}
                              className="rounded bg-[hsl(var(--primary))]/15 px-2 py-1 text-[10px] font-medium text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/25 transition-colors"
                            >
                              Save
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-sm font-semibold">
                        {item.variance === null ? (
                          <span className="text-[hsl(var(--muted-foreground))]">—</span>
                        ) : item.variance === 0 ? (
                          <span className="text-[hsl(var(--muted-foreground))]">0</span>
                        ) : item.variance > 0 ? (
                          <span className="text-emerald-400">+{item.variance}</span>
                        ) : (
                          <span className="text-red-400">{item.variance}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", cfg.color)}>
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">
                        {item.last_counted ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight className={cn("h-4 w-4 text-[hsl(var(--muted-foreground))] transition-transform", isSelected && "rotate-90")} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {selectedItem && (
        <div className="w-80 shrink-0 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 space-y-4 h-fit sticky top-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Reconciliation Detail</h3>
            <button onClick={() => setSelected(null)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">✕</button>
          </div>

          <div>
            <p className="text-xs font-semibold text-[hsl(var(--foreground))]">{selectedItem.stock_name}</p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{selectedItem.stock_code} · {selectedItem.category}</p>
          </div>

          <div className="space-y-2">
            {[
              { label: "System Quantity",  value: selectedItem.system_qty },
              { label: "Physical Count",   value: selectedItem.physical_qty ?? "Pending" },
              { label: "Variance",         value: selectedItem.variance === null ? "—" : selectedItem.variance === 0 ? "None" : (selectedItem.variance > 0 ? `+${selectedItem.variance}` : selectedItem.variance) },
              { label: "Location",         value: selectedItem.location || "—" },
              { label: "Last Counted",     value: selectedItem.last_counted ?? "—" },
              { label: "Counted By",       value: selectedItem.counted_by ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
                <span className="font-medium text-[hsl(var(--foreground))]">{String(value)}</span>
              </div>
            ))}
          </div>

          {selectedItem.status === "pending" && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]/60">Enter Physical Count</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Physical qty"
                  value={physicalInput[selectedItem.id] ?? ""}
                  onChange={(e) => setPhysicalInput((p) => ({ ...p, [selectedItem.id]: e.target.value }))}
                  className="h-8 flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] focus:border-[hsl(var(--primary))] focus:outline-none"
                />
                <button
                  onClick={() => handleCountSubmit(selectedItem)}
                  className="rounded-lg bg-[hsl(var(--primary))] px-3 text-xs font-semibold text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {selectedItem.status === "draft_adjustment" && (
            <button className="w-full rounded-lg bg-[hsl(var(--primary))] py-2 text-xs font-semibold text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity">
              Approve Draft Adjustment
            </button>
          )}
          {selectedItem.status === "variance" && (
            <button className="w-full rounded-lg border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/8 py-2 text-xs font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/15 transition-colors">
              Create Adjustment
            </button>
          )}
        </div>
      )}
    </div>
  );
}
