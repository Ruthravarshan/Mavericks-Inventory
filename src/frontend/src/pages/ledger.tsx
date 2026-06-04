import { useState } from "react";
import { BookOpen, Download, Search, TrendingDown, TrendingUp, SlidersHorizontal, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetLedger } from "@/hooks/use-queries";
import type { LedgerEntry } from "@/types";

type MovementType = "in" | "out" | "adjustment";

const TYPE_CONFIG: Record<MovementType, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  in:         { label: "Stock In",    icon: TrendingUp,       color: "text-emerald-400 bg-emerald-400/10" },
  out:        { label: "Stock Out",   icon: TrendingDown,     color: "text-red-400 bg-red-400/10" },
  adjustment: { label: "Adjustment",  icon: SlidersHorizontal, color: "text-amber-400 bg-amber-400/10" },
};

function exportLedgerToCsv(entries: LedgerEntry[]) {
  if (entries.length === 0) return;
  const headers = [
    "Timestamp",
    "Stock Code",
    "Stock Name",
    "Type",
    "Qty Change",
    "Qty Before",
    "Qty After",
    "Transaction Code",
    "Actor",
    "Remarks",
  ];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = entries.map((e) => [
    e.created_at,
    e.stock_code,
    e.stock_name,
    e.transaction_type,
    e.qty_change,
    e.qty_before,
    e.qty_after,
    e.transaction_code ?? "",
    e.actor_name,
    e.remarks ?? "",
  ].map(escape).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stock-ledger-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function LedgerPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | MovementType>("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data, isLoading, isFetching, refetch } = useGetLedger({ page, page_size: PAGE_SIZE });
  const entries: LedgerEntry[] = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;
  const total = data?.total ?? 0;

  const filtered = entries.filter((e) => {
    const matchSearch =
      !search ||
      e.stock_name.toLowerCase().includes(search.toLowerCase()) ||
      (e.transaction_code ?? "").toLowerCase().includes(search.toLowerCase()) ||
      e.actor_name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || e.transaction_type === typeFilter;
    return matchSearch && matchType;
  });

  const totalIn  = entries.reduce((s, e) => s + (e.transaction_type === "in"  ? e.qty_change : 0), 0);
  const totalOut = entries.reduce((s, e) => s + (e.transaction_type === "out" ? Math.abs(e.qty_change) : 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[hsl(var(--primary))]" />
            <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Stock Movement Ledger</h1>
          </div>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Immutable log of all approved stock movements. Read-only.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 transition-transform ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => exportLedgerToCsv(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={filtered.length === 0 ? "No entries to export" : "Download as CSV"}
          >
            <Download className="h-3.5 w-3.5" />
            Export Ledger
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Movements", value: total,            color: "text-[hsl(var(--foreground))]" },
          { label: "Total Stock In",  value: totalIn,          color: "text-emerald-400" },
          { label: "Total Stock Out", value: totalOut,         color: "text-red-400" },
          { label: "Net Movement",    value: totalIn - totalOut, color: totalIn >= totalOut ? "text-emerald-400" : "text-red-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
            <p className={cn("mt-1 text-2xl font-bold tabular-nums", color)}>
              {value > 0 ? "+" : ""}{value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search stock, code, actor…"
            className="h-9 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] pl-9 pr-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]/60 focus:border-[hsl(var(--primary))] focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1">
          {(["all", "in", "out", "adjustment"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTypeFilter(t); setPage(1); }}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                typeFilter === t
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              )}
            >
              {t === "all" ? "All Types" : TYPE_CONFIG[t]?.label ?? t}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/30">
                {["Txn Code", "Type", "Stock", "Qty Change", "Balance Before", "Balance After", "Actor", "Remarks", "Date"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
                    Loading ledger entries…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
                    No entries found.
                  </td>
                </tr>
              ) : (
                filtered.map((entry, idx) => {
                  const type = entry.transaction_type as MovementType;
                  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.adjustment;
                  const Icon = cfg.icon;
                  return (
                    <tr
                      key={entry.id}
                      className={cn(
                        "border-b border-[hsl(var(--border))]/50 hover:bg-[hsl(var(--secondary))]/30 transition-colors",
                        idx % 2 !== 0 && "bg-[hsl(var(--secondary))]/10"
                      )}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-[hsl(var(--primary))]">
                        {entry.transaction_code ?? `LED-${entry.id}`}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", cfg.color)}>
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-[hsl(var(--foreground))]">{entry.stock_name}</div>
                        <div className="text-[11px] text-[hsl(var(--muted-foreground))]">{entry.stock_code}</div>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-sm font-semibold">
                        {entry.qty_change > 0 ? (
                          <span className="text-emerald-400">+{entry.qty_change}</span>
                        ) : entry.qty_change < 0 ? (
                          <span className="text-red-400">{entry.qty_change}</span>
                        ) : (
                          <span className="text-[hsl(var(--muted-foreground))]">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-xs text-[hsl(var(--muted-foreground))]">{entry.qty_before}</td>
                      <td className="px-4 py-3 tabular-nums text-xs font-semibold text-[hsl(var(--foreground))]">{entry.qty_after}</td>
                      <td className="px-4 py-3 text-xs font-medium text-[hsl(var(--foreground))]">{entry.actor_name || "—"}</td>
                      <td className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))] max-w-[180px] truncate">{entry.remarks || "—"}</td>
                      <td className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                        {entry.created_at ? new Date(entry.created_at).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-[hsl(var(--border))] px-4 py-3">
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {total} entries · Page {page} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-[hsl(var(--secondary))] transition-colors"
            >
              Prev
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs transition-colors",
                    p === page
                      ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]"
                      : "border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]"
                  )}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-[hsl(var(--secondary))] transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
