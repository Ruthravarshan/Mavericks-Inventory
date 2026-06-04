import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, Unlock, Plus, AlertTriangle, Shield, FileText, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { legalHoldsApi, type LegalHoldItem } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

type HoldScope = "transaction" | "stock_master" | "user_records";

const SCOPE_CONFIG: Record<HoldScope, { label: string; color: string }> = {
  transaction:  { label: "Transactions", color: "text-blue-400 bg-blue-400/10" },
  stock_master: { label: "Stock Master", color: "text-purple-400 bg-purple-400/10" },
  user_records: { label: "User Records", color: "text-amber-400 bg-amber-400/10" },
};

function NewHoldModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ title: "", scope: "transaction" as HoldScope, reason: "", case_number: "", records_locked: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!form.title || !form.reason || !form.case_number) {
      setError("Title, reason and case number are required.");
      return;
    }
    setSaving(true);
    try {
      await legalHoldsApi.create({
        title: form.title,
        scope: form.scope,
        reason: form.reason,
        case_number: form.case_number,
        records_locked: form.records_locked ? Number(form.records_locked) : undefined,
      });
      onCreated();
      onClose();
    } catch {
      setError("Failed to create legal hold.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[hsl(var(--foreground))]">New Legal Hold</h2>
          <button onClick={onClose} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-[hsl(var(--muted-foreground))]">Title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="mt-1 h-9 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] focus:border-[hsl(var(--primary))] focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-[hsl(var(--muted-foreground))]">Case Number *</label>
            <input
              value={form.case_number}
              onChange={(e) => setForm((f) => ({ ...f, case_number: e.target.value }))}
              placeholder="e.g. AUD-2026-001"
              className="mt-1 h-9 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] focus:border-[hsl(var(--primary))] focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-[hsl(var(--muted-foreground))]">Scope</label>
            <select
              value={form.scope}
              onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value as HoldScope }))}
              className="mt-1 h-9 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] focus:border-[hsl(var(--primary))] focus:outline-none"
            >
              <option value="transaction">Transactions</option>
              <option value="stock_master">Stock Master</option>
              <option value="user_records">User Records</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-[hsl(var(--muted-foreground))]">Records Locked (estimated)</label>
            <input
              type="number"
              value={form.records_locked}
              onChange={(e) => setForm((f) => ({ ...f, records_locked: e.target.value }))}
              className="mt-1 h-9 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] focus:border-[hsl(var(--primary))] focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-[hsl(var(--muted-foreground))]">Reason *</label>
            <textarea
              rows={3}
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:border-[hsl(var(--primary))] focus:outline-none resize-none"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-[hsl(var(--border))] px-4 py-2 text-xs font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-xs font-semibold text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {saving ? "Creating…" : "Create Hold"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LegalHoldsPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "released">("all");
  const [selected, setSelected] = useState<number | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["legal-holds", statusFilter, search],
    queryFn: () =>
      legalHoldsApi
        .list({ status: statusFilter === "all" ? undefined : statusFilter, search: search || undefined })
        .then((r) => r.data),
    staleTime: 30_000,
  });

  const releaseMutation = useMutation({
    mutationFn: (id: number) => legalHoldsApi.release(String(id)).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["legal-holds"] });
      setSelected(null);
    },
  });

  const holds: LegalHoldItem[] = data?.items ?? [];
  const activeHolds = data?.active_count ?? 0;
  const totalLocked = data?.total_locked ?? 0;
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-[hsl(var(--primary))]" />
            <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Legal Holds</h1>
          </div>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Records locked under legal hold cannot be modified or deleted. Admin only.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-xs font-semibold text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" />
            New Legal Hold
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active Holds",   value: activeHolds,                                        color: "text-red-400",     icon: Lock },
          { label: "Records Locked", value: totalLocked,                                        color: "text-amber-400",   icon: Shield },
          { label: "Released Holds", value: holds.filter((h) => h.status === "released").length, color: "text-emerald-400", icon: Unlock },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 flex items-center gap-4">
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-full", color.replace("text-", "bg-").replace("400", "400/15"))}>
              <Icon className={cn("h-5 w-5", color)} />
            </div>
            <div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
              <p className={cn("text-2xl font-bold tabular-nums", color)}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Warning banner */}
      {activeHolds > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/8 p-4">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-400">{activeHolds} active legal hold{activeHolds > 1 ? "s" : ""} in effect</p>
            <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
              {totalLocked} records are currently locked and cannot be modified. Contact Legal department to release holds.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search holds, case numbers…"
            className="h-9 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] pl-9 pr-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]/60 focus:border-[hsl(var(--primary))] focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1">
          {(["all", "active", "released"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                statusFilter === s
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              )}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Holds list */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">Loading legal holds…</div>
        ) : holds.length === 0 ? (
          <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">No legal holds found.</div>
        ) : (
          holds.map((hold) => {
            const scopeCfg = SCOPE_CONFIG[hold.scope];
            const isActive = hold.status === "active";
            const isSelected = selected === hold.id;
            return (
              <div
                key={hold.id}
                onClick={() => setSelected(isSelected ? null : hold.id)}
                className={cn(
                  "rounded-xl border bg-[hsl(var(--card))] p-4 cursor-pointer transition-all",
                  isSelected
                    ? "border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/5"
                    : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/30"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", isActive ? "bg-red-400/15" : "bg-emerald-400/15")}>
                      {isActive ? <Lock className="h-4 w-4 text-red-400" /> : <Unlock className="h-4 w-4 text-emerald-400" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-[hsl(var(--primary))]">{hold.hold_reference}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", scopeCfg.color)}>{scopeCfg.label}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", isActive ? "bg-red-400/10 text-red-400" : "bg-emerald-400/10 text-emerald-400")}>
                          {isActive ? "Active" : "Released"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-[hsl(var(--foreground))]">{hold.title}</p>
                      <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))] line-clamp-1">{hold.reason}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Case: <span className="font-mono text-[hsl(var(--foreground))]">{hold.case_number}</span></p>
                    <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{hold.records_locked} records locked</p>
                    <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{hold.initiated_at}</p>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-4 border-t border-[hsl(var(--border))] pt-4 space-y-3">
                    <p className="text-xs text-[hsl(var(--foreground))]">
                      <span className="text-[hsl(var(--muted-foreground))]">Full reason: </span>{hold.reason}
                    </p>
                    <div className="flex flex-wrap gap-6 text-xs">
                      <div><span className="text-[hsl(var(--muted-foreground))]">Initiated by: </span><span className="text-[hsl(var(--foreground))]">{hold.initiated_by}</span></div>
                      <div><span className="text-[hsl(var(--muted-foreground))]">On: </span><span className="text-[hsl(var(--foreground))]">{hold.initiated_at}</span></div>
                      {hold.released_at && (
                        <div><span className="text-[hsl(var(--muted-foreground))]">Released: </span><span className="text-emerald-400">{hold.released_at} by {hold.released_by}</span></div>
                      )}
                    </div>
                    {isActive && isAdmin && (
                      <div className="flex gap-2">
                        <button className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-colors">
                          <FileText className="h-3.5 w-3.5" />
                          View Locked Records
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); releaseMutation.mutate(hold.id); }}
                          disabled={releaseMutation.isPending}
                          className="flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-400/8 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-400/15 disabled:opacity-60 transition-colors"
                        >
                          <Unlock className="h-3.5 w-3.5" />
                          {releaseMutation.isPending ? "Releasing…" : "Release Hold"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {showNewModal && (
        <NewHoldModal
          onClose={() => setShowNewModal(false)}
          onCreated={() => {
            void qc.invalidateQueries({ queryKey: ["legal-holds"] });
          }}
        />
      )}
    </div>
  );
}
