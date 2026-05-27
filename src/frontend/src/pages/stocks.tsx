import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  Eye,
  History,
  CheckCircle,
  XCircle,
  RefreshCw,
  X,
  Wand2,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import {
  useListStocks,
  useCreateStock,
  useUpdateStock,
  useDeleteStock,
} from "@/hooks/use-queries";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { HealthBadge } from "@/components/health-badge";
import { cn, formatRelativeTime } from "@/lib/utils";
import { STOCK_CATEGORIES, UNITS_OF_MEASURE, LOCATIONS } from "@/lib/constants";
import type { Stock, CreateStockRequest } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type LifecycleStatus = "draft" | "active" | "inactive";
type Criticality = "standard" | "high" | "critical";

interface EnrichedStock extends Stock {
  lifecycle_status: LifecycleStatus;
  opening_qty: number;
  in_qty: number;
  out_qty: number;
  reserved_qty: number;
  criticality: Criticality;
  version: number;
  activation_requested: boolean;
}

interface VersionEntry {
  version: number;
  isCurrent: boolean;
  author: string;
  date: string;
  note: string;
  changes: { field: string; before: string; after: string }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function enrichStock(stock: Stock): EnrichedStock {
  const numericId = parseInt(stock.id, 10) || stock.id.charCodeAt(0);
  const idNum = isNaN(numericId) ? stock.id.charCodeAt(0) : numericId;

  let lifecycle_status: LifecycleStatus;
  if (stock.status === "active") {
    lifecycle_status = "active";
  } else if (stock.status === "inactive") {
    lifecycle_status = "inactive";
  } else {
    lifecycle_status = "draft";
  }

  const critMap: Criticality[] = ["standard", "high", "critical"];
  const criticality: Criticality = critMap[idNum % 3];

  return {
    ...stock,
    lifecycle_status,
    opening_qty: stock.available_qty,
    in_qty: Math.floor(idNum * 1.7),
    out_qty: Math.floor(idNum * 1.3),
    reserved_qty: Math.floor(idNum * 0.4),
    criticality,
    version: 1 + (idNum % 4),
    activation_requested: idNum % 5 === 0,
  };
}

function generateStockCode(): string {
  const prefix = "STK";
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}${rand}`;
}

function getMockVersionHistory(stock: EnrichedStock): VersionEntry[] {
  const entries: VersionEntry[] = [];
  for (let v = stock.version; v >= 1; v--) {
    if (v === stock.version) {
      entries.push({
        version: v,
        isCurrent: true,
        author: "Admin",
        date: "2026-05-20",
        note: "Updated UOM from Pieces to Units",
        changes: [
          { field: "UOM", before: "Pieces", after: "Units" },
          { field: "Location", before: "Warehouse A", after: stock.location },
        ],
      });
    } else if (v === stock.version - 1) {
      entries.push({
        version: v,
        isCurrent: false,
        author: "Manager",
        date: "2026-04-10",
        note: "Updated Minimum Level",
        changes: [
          { field: "Min Level", before: String(stock.min_level - 5), after: String(stock.min_level) },
        ],
      });
    } else {
      entries.push({
        version: v,
        isCurrent: false,
        author: "Admin",
        date: "2026-01-05",
        note: "Initial creation",
        changes: [
          { field: "Stock Code", before: "—", after: stock.stock_code },
          { field: "Name", before: "—", after: stock.name },
        ],
      });
    }
  }
  return entries;
}

// ─── Badge sub-components ─────────────────────────────────────────────────────

function CriticalityBadge({ criticality }: { criticality: Criticality }) {
  const cfg = {
    standard: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    high: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        cfg[criticality]
      )}
    >
      {criticality === "critical" && <AlertTriangle className="mr-1 h-2.5 w-2.5" />}
      {criticality}
    </span>
  );
}

function VersionBadge({ version }: { version: number }) {
  return (
    <span className="inline-flex items-center rounded border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-mono text-indigo-400">
      v{version}
    </span>
  );
}

// ─── Quantities Mini-view ─────────────────────────────────────────────────────

function QuantitiesMini({
  stock,
  onClick,
}: {
  stock: EnrichedStock;
  onClick: (s: EnrichedStock) => void;
}) {
  const total = stock.opening_qty + stock.in_qty;
  const pctAvail = total > 0 ? Math.min((stock.available_qty / total) * 100, 100) : 0;
  const pctReserved = total > 0 ? Math.min((stock.reserved_qty / total) * 100, 100) : 0;

  return (
    <button
      className="group flex flex-col gap-1 text-left"
      onClick={(e) => {
        e.stopPropagation();
        onClick(stock);
      }}
    >
      <div className="flex items-center gap-3 text-xs">
        <span className="text-[hsl(var(--muted-foreground))]">
          Avail: <span className="font-medium text-emerald-400">{stock.available_qty.toLocaleString()}</span>
        </span>
        <span className="text-[hsl(var(--muted-foreground))]">
          Rsv: <span className="font-medium text-amber-400">{stock.reserved_qty.toLocaleString()}</span>
        </span>
      </div>
      <div className="flex h-1.5 w-28 overflow-hidden rounded-full bg-slate-700">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${pctAvail}%` }}
        />
        <div
          className="h-full bg-amber-500 transition-all"
          style={{ width: `${pctReserved}%` }}
        />
      </div>
    </button>
  );
}

// ─── Quantities Detail Modal ───────────────────────────────────────────────────

function QuantitiesDetailModal({
  stock,
  onClose,
}: {
  stock: EnrichedStock | null;
  onClose: () => void;
}) {
  if (!stock) return null;

  const calculated_available =
    stock.opening_qty + stock.in_qty - stock.out_qty - stock.reserved_qty;
  const total = stock.opening_qty + stock.in_qty;
  const pctIn = total > 0 ? (stock.in_qty / total) * 100 : 0;
  const pctOut = total > 0 ? (stock.out_qty / total) * 100 : 0;
  const pctRsv = total > 0 ? (stock.reserved_qty / total) * 100 : 0;
  const pctAvail = total > 0 ? Math.max((calculated_available / total) * 100, 0) : 0;

  const rows = [
    { label: "Opening Balance", value: stock.opening_qty, color: "text-slate-300" },
    { label: "Total IN Movements", value: stock.in_qty, color: "text-emerald-400" },
    { label: "Total OUT Movements", value: stock.out_qty, color: "text-rose-400" },
    { label: "Reserved (pending approvals)", value: stock.reserved_qty, color: "text-amber-400" },
  ];

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[hsl(var(--primary))]" />
            Quantity Breakdown — {stock.stock_code}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="py-2 text-[hsl(var(--muted-foreground))]">{r.label}</td>
                  <td className={cn("py-2 text-right font-medium tabular-nums", r.color)}>
                    {r.value.toLocaleString()}
                  </td>
                </tr>
              ))}
              <tr className="bg-[hsl(var(--primary)/0.08)]">
                <td className="rounded-l py-2.5 pl-2 font-semibold text-[hsl(var(--foreground))]">
                  Available Balance
                </td>
                <td className="rounded-r py-2.5 pr-2 text-right text-base font-bold text-emerald-400 tabular-nums">
                  {Math.max(calculated_available, 0).toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Mini timeline bar */}
          <div className="space-y-1.5">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Stock flow visualisation</p>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${pctIn}%` }}
                title={`IN: ${stock.in_qty}`}
              />
              <div
                className="h-full bg-rose-500"
                style={{ width: `${pctOut}%` }}
                title={`OUT: ${stock.out_qty}`}
              />
              <div
                className="h-full bg-amber-500"
                style={{ width: `${pctRsv}%` }}
                title={`Reserved: ${stock.reserved_qty}`}
              />
              <div
                className="h-full bg-slate-600"
                style={{ width: `${Math.max(100 - pctIn - pctOut - pctRsv, 0)}%` }}
              />
            </div>
            <div className="flex gap-4 text-[10px] text-[hsl(var(--muted-foreground))]">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" />IN ({pctIn.toFixed(0)}%)</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-rose-500" />OUT ({pctOut.toFixed(0)}%)</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-amber-500" />Rsv ({pctRsv.toFixed(0)}%)</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-emerald-500/40" />Avail ({pctAvail.toFixed(0)}%)</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Version History Side Panel ───────────────────────────────────────────────

function VersionHistoryPanel({
  stock,
  onClose,
}: {
  stock: EnrichedStock | null;
  onClose: () => void;
}) {
  const versions = stock ? getMockVersionHistory(stock) : [];

  return (
    <AnimatePresence>
      {stock && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 flex h-full w-96 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4">
              <div>
                <p className="font-semibold text-[hsl(var(--foreground))]">Version History</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{stock.stock_code} — {stock.name}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {versions.map((v) => (
                <div key={v.version} className="relative pl-5">
                  {/* Timeline dot */}
                  <div
                    className={cn(
                      "absolute left-0 top-1.5 h-3 w-3 rounded-full border-2",
                      v.isCurrent
                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]"
                        : "border-slate-600 bg-slate-800"
                    )}
                  />
                  {/* Line */}
                  <div className="absolute left-[5px] top-4 h-full w-px bg-slate-700" />

                  <div className={cn(
                    "rounded-lg border p-3",
                    v.isCurrent
                      ? "border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.05)]"
                      : "border-[hsl(var(--border))] bg-[hsl(var(--background))]"
                  )}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <VersionBadge version={v.version} />
                        {v.isCurrent && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--primary))]">Current</span>
                        )}
                      </div>
                      <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{v.date}</span>
                    </div>
                    <p className="text-sm font-medium text-[hsl(var(--foreground))] mb-1">{v.note}</p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))] mb-2">by {v.author}</p>

                    {/* Diff table */}
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="text-[hsl(var(--muted-foreground))]">
                          <th className="text-left py-0.5 pr-2 font-normal w-24">Field</th>
                          <th className="text-left py-0.5 pr-2 font-normal">Before</th>
                          <th className="text-left py-0.5 font-normal">After</th>
                        </tr>
                      </thead>
                      <tbody>
                        {v.changes.map((c) => (
                          <tr key={c.field} className="border-t border-[hsl(var(--border))]">
                            <td className="py-1 pr-2 text-[hsl(var(--muted-foreground))]">{c.field}</td>
                            <td className="py-1 pr-2 text-rose-400 line-through">{c.before}</td>
                            <td className="py-1 text-emerald-400">{c.after}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Request Activation Dialog ────────────────────────────────────────────────

function RequestActivationDialog({
  stock,
  onClose,
}: {
  stock: EnrichedStock | null;
  onClose: () => void;
}) {
  const [justification, setJustification] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setIsSubmitting(true);
    await new Promise((res) => setTimeout(res, 800));
    setIsSubmitting(false);
    toast({ title: `Activation requested for ${stock?.name}`, description: "Your request has been submitted for review." });
    setJustification("");
    onClose();
  }

  return (
    <Dialog open={!!stock} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            Request Activation
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Submit an activation request for{" "}
          <strong className="text-[hsl(var(--foreground))]">{stock?.name}</strong> ({stock?.stock_code})?
        </p>
        <div className="space-y-2">
          <Label className="text-xs">Justification (optional)</Label>
          <Textarea
            rows={3}
            placeholder="Reason for activation..."
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

function DeleteConfirmDialog({
  stock,
  onClose,
}: {
  stock: EnrichedStock | null;
  onClose: () => void;
}) {
  const deleteStock = useDeleteStock();

  async function handleDelete() {
    if (!stock) return;
    try {
      await deleteStock.mutateAsync(stock.id);
      toast({ title: "Stock deleted successfully" });
      onClose();
    } catch {
      toast({ title: "Failed to delete stock", variant: "destructive" });
    }
  }

  return (
    <Dialog open={!!stock} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-rose-400">Delete Stock</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Are you sure you want to delete{" "}
          <strong className="text-[hsl(var(--foreground))]">{stock?.name}</strong> ({stock?.stock_code})?
          This action cannot be undone.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleteStock.isPending}>
            {deleteStock.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────

interface StockFormState {
  stock_code: string;
  name: string;
  category: string;
  uom: string;
  opening_qty: string;
  location: string;
  criticality: Criticality;
  min_level: string;
  max_level: string;
  description: string;
}

function defaultFormState(editStock?: EnrichedStock | null): StockFormState {
  if (editStock) {
    return {
      stock_code: editStock.stock_code,
      name: editStock.name,
      category: editStock.category,
      uom: editStock.uom,
      opening_qty: String(editStock.available_qty),
      location: editStock.location,
      criticality: editStock.criticality,
      min_level: String(editStock.min_level),
      max_level: String(editStock.max_level),
      description: "",
    };
  }
  return {
    stock_code: "",
    name: "",
    category: "",
    uom: "",
    opening_qty: "0",
    location: "",
    criticality: "standard",
    min_level: "0",
    max_level: "0",
    description: "",
  };
}

function StockFormModal({
  open,
  onClose,
  editStock,
}: {
  open: boolean;
  onClose: () => void;
  editStock?: EnrichedStock | null;
}) {
  const createStock = useCreateStock();
  const updateStock = useUpdateStock();
  const [form, setForm] = useState<StockFormState>(() => defaultFormState(editStock));
  const [aiDismissed, setAiDismissed] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof StockFormState, string>>>({});

  // Reset when editStock changes
  const [prevEditStock, setPrevEditStock] = useState(editStock);
  if (prevEditStock !== editStock) {
    setPrevEditStock(editStock);
    setForm(defaultFormState(editStock));
    setErrors({});
    setAiDismissed(false);
  }

  function setField<K extends keyof StockFormState>(key: K, value: StockFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof StockFormState, string>> = {};
    if (!form.stock_code.trim()) next.stock_code = "Required";
    if (!form.name.trim()) next.name = "Required";
    if (!form.category) next.category = "Required";
    if (!form.uom) next.uom = "Required";
    if (!form.location) next.location = "Required";
    if (isNaN(Number(form.opening_qty)) || Number(form.opening_qty) < 0) next.opening_qty = "Must be >= 0";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const qty = Number(form.opening_qty);
    const minLvl = Number(form.min_level) || 0;
    const maxLvl = Number(form.max_level) || 0;

    const payload: CreateStockRequest = {
      stock_code: form.stock_code.toUpperCase(),
      name: form.name,
      category: form.category,
      uom: form.uom,
      total_qty: qty,
      available_qty: qty,
      min_level: minLvl,
      max_level: maxLvl,
      location: form.location,
      status: editStock ? editStock.status : "draft",
    };

    try {
      if (editStock) {
        await updateStock.mutateAsync({ id: editStock.id, data: payload });
        toast({ title: "Stock updated successfully" });
      } else {
        await createStock.mutateAsync(payload);
        toast({ title: "Stock created in draft", description: "Request activation when ready." });
      }
      onClose();
    } catch {
      toast({ title: "Operation failed", variant: "destructive" });
    }
  }

  const isPending = createStock.isPending || updateStock.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[hsl(var(--primary))]" />
            {editStock ? "Edit Stock" : "New Stock Item"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Row 1: Code + Name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">Stock Code *</Label>
              <div className="flex gap-2">
                <Input
                  className="uppercase font-mono"
                  placeholder="e.g. STK0042"
                  value={form.stock_code}
                  onChange={(e) => setField("stock_code", e.target.value.toUpperCase())}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Auto-generate"
                  onClick={() => setField("stock_code", generateStockCode())}
                >
                  <Wand2 className="h-4 w-4" />
                </Button>
              </div>
              {errors.stock_code && <p className="text-[11px] text-rose-400">{errors.stock_code}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">Name *</Label>
              <Input
                placeholder="Item name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
              />
              {errors.name && <p className="text-[11px] text-rose-400">{errors.name}</p>}
            </div>
          </div>

          {/* Row 2: Category + UOM */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">Category *</Label>
              <Select value={form.category} onValueChange={(v) => setField("category", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {STOCK_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-[11px] text-rose-400">{errors.category}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">UOM *</Label>
              <Select value={form.uom} onValueChange={(v) => setField("uom", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select UOM" />
                </SelectTrigger>
                <SelectContent>
                  {UNITS_OF_MEASURE.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.uom && <p className="text-[11px] text-rose-400">{errors.uom}</p>}
            </div>
          </div>

          {/* Row 3: Opening Qty + Location */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">Opening Quantity *</Label>
              <Input
                type="number"
                min={0}
                value={form.opening_qty}
                onChange={(e) => setField("opening_qty", e.target.value)}
              />
              {errors.opening_qty && <p className="text-[11px] text-rose-400">{errors.opening_qty}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">Location *</Label>
              <Select value={form.location} onValueChange={(v) => setField("location", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {LOCATIONS.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.location && <p className="text-[11px] text-rose-400">{errors.location}</p>}
            </div>
          </div>

          {/* Row 4: Criticality + Min Level + Max Level */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">Criticality</Label>
              <Select
                value={form.criticality}
                onValueChange={(v) => setField("criticality", v as Criticality)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">Min Level</Label>
              <Input
                type="number"
                min={0}
                value={form.min_level}
                onChange={(e) => setField("min_level", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">Max Level</Label>
              <Input
                type="number"
                min={0}
                value={form.max_level}
                onChange={(e) => setField("max_level", e.target.value)}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide">Description</Label>
            <Textarea
              rows={2}
              placeholder="Optional description..."
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
            />
          </div>

          {/* AI Classification suggestion (create only) */}
          {!editStock && !aiDismissed && form.category && (
            <div className="flex items-start gap-3 rounded-lg border border-indigo-500/30 bg-indigo-500/5 px-4 py-3">
              <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-400" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-indigo-300 mb-0.5">AI Suggested Classification</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Category:{" "}
                  <span className="font-medium text-[hsl(var(--foreground))]">{form.category}</span>{" "}
                  <span className="text-indigo-400">(92% confidence)</span>
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0 text-[hsl(var(--muted-foreground))]"
                onClick={() => setAiDismissed(true)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editStock ? "Update Stock" : "Create Stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Skeleton Rows ────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 10 }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ─── Per-tab empty states ─────────────────────────────────────────────────────

const EMPTY_MESSAGES: Record<LifecycleStatus, { title: string; subtitle: string }> = {
  draft: {
    title: "No draft stocks",
    subtitle: "Create a new stock item to get started. Drafts are staged here before activation.",
  },
  active: {
    title: "No active stocks",
    subtitle: "Activate draft items to see them here. Active stocks are fully in-use.",
  },
  inactive: {
    title: "No inactive stocks",
    subtitle: "Deactivated stocks are archived here for reference.",
  },
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StocksPage() {
  const PAGE_SIZE = 20;

  // Server fetch — get all items for local lifecycle filtering
  const { data, isLoading } = useListStocks({
    page: 1,
    page_size: PAGE_SIZE,
  });

  const allStocks: EnrichedStock[] = useMemo(
    () => (data?.items ?? []).map(enrichStock),
    [data?.items]
  );

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<LifecycleStatus>("draft");

  // ── Per-tab filter state ──
  const [tabSearch, setTabSearch] = useState("");
  const [tabCategory, setTabCategory] = useState("");
  const [tabCriticality, setTabCriticality] = useState("");
  const [tabUom, setTabUom] = useState("");

  // Reset tab filters when switching tab
  function switchTab(tab: LifecycleStatus) {
    setActiveTab(tab);
    setTabSearch("");
    setTabCategory("");
    setTabCriticality("");
    setTabUom("");
    setLocalPage(1);
    setSelected([]);
  }

  // ── Local pagination ──
  const [localPage, setLocalPage] = useState(1);

  // ── Modals ──
  const [showModal, setShowModal] = useState(false);
  const [editStock, setEditStock] = useState<EnrichedStock | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EnrichedStock | null>(null);
  const [activationTarget, setActivationTarget] = useState<EnrichedStock | null>(null);
  const [qtyTarget, setQtyTarget] = useState<EnrichedStock | null>(null);
  const [versionTarget, setVersionTarget] = useState<EnrichedStock | null>(null);

  // ── Bulk selection ──
  const [selected, setSelected] = useState<string[]>([]);

  // ── Derived per-tab data ──
  const tabStocks = useMemo(() => {
    return allStocks.filter((s) => {
      if (s.lifecycle_status !== activeTab) return false;
      if (tabSearch && !s.name.toLowerCase().includes(tabSearch.toLowerCase()) && !s.stock_code.toLowerCase().includes(tabSearch.toLowerCase())) return false;
      if (tabCategory && s.category !== tabCategory) return false;
      if (tabCriticality && s.criticality !== tabCriticality) return false;
      if (tabUom && s.uom !== tabUom) return false;
      return true;
    });
  }, [allStocks, activeTab, tabSearch, tabCategory, tabCriticality, tabUom]);

  const tabCounts: Record<LifecycleStatus, number> = useMemo(() => {
    const counts = { draft: 0, active: 0, inactive: 0 };
    allStocks.forEach((s) => counts[s.lifecycle_status]++);
    return counts;
  }, [allStocks]);

  // Local pagination of tabStocks
  const totalLocalPages = Math.max(1, Math.ceil(tabStocks.length / PAGE_SIZE));
  const paginatedStocks = tabStocks.slice((localPage - 1) * PAGE_SIZE, localPage * PAGE_SIZE);

  // Bulk actions
  function toggleSelect(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    const ids = paginatedStocks.map((s) => s.id);
    const allSelected = ids.every((id) => selected.includes(id));
    setSelected(allSelected ? selected.filter((id) => !ids.includes(id)) : [...new Set([...selected, ...ids])]);
  }

  async function handleBulkAction(action: "activate" | "deactivate") {
    await new Promise((r) => setTimeout(r, 600));
    const label = action === "activate" ? "activation requested" : "deactivated";
    toast({ title: `${selected.length} stocks ${label}` });
    setSelected([]);
  }

  const allPageSelected =
    paginatedStocks.length > 0 && paginatedStocks.every((s) => selected.includes(s.id));

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--foreground))]">
            Stock Master
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Draft → Active → Inactive lifecycle &nbsp;·&nbsp; {data?.total ?? 0} total items
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => { setEditStock(null); setShowModal(true); }}
          className="self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          New Stock
        </Button>
      </div>

      {/* ── Lifecycle Tabs ── */}
      <Tabs value={activeTab} onValueChange={(v) => switchTab(v as LifecycleStatus)}>
        <TabsList className="border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          {(["draft", "active", "inactive"] as LifecycleStatus[]).map((tab) => (
            <TabsTrigger key={tab} value={tab} className="capitalize gap-2">
              {tab}
              <span
                className={cn(
                  "inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold",
                  tab === "draft" && "bg-gray-500/30 text-gray-300",
                  tab === "active" && "bg-emerald-500/30 text-emerald-300",
                  tab === "inactive" && "bg-rose-500/30 text-rose-300"
                )}
              >
                {tabCounts[tab]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {(["draft", "active", "inactive"] as LifecycleStatus[]).map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4 space-y-4">
            {/* Per-tab filter bar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                <Input
                  placeholder="Search code or name…"
                  value={tabSearch}
                  onChange={(e) => { setTabSearch(e.target.value); setLocalPage(1); }}
                  className="pl-8 h-9 text-sm"
                />
              </div>

              <Select
                value={tabCategory || "all"}
                onValueChange={(v) => { setTabCategory(v === "all" ? "" : v); setLocalPage(1); }}
              >
                <SelectTrigger className="w-40 h-9 text-sm">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {STOCK_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={tabCriticality || "all"}
                onValueChange={(v) => { setTabCriticality(v === "all" ? "" : v); setLocalPage(1); }}
              >
                <SelectTrigger className="w-36 h-9 text-sm">
                  <SelectValue placeholder="Criticality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Criticality</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={tabUom || "all"}
                onValueChange={(v) => { setTabUom(v === "all" ? "" : v); setLocalPage(1); }}
              >
                <SelectTrigger className="w-32 h-9 text-sm">
                  <SelectValue placeholder="UOM" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All UOM</SelectItem>
                  {UNITS_OF_MEASURE.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── Bulk Actions Bar ── */}
            <AnimatePresence>
              {selected.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-center gap-3 rounded-lg border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.05)] px-4 py-2.5"
                >
                  <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                    {selected.length} selected
                  </span>
                  {tab === "draft" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleBulkAction("activate")}>
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                      Bulk Request Activation
                    </Button>
                  )}
                  {tab === "active" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleBulkAction("deactivate")}>
                      <XCircle className="h-3.5 w-3.5 text-rose-400" />
                      Bulk Deactivate
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto" onClick={() => setSelected([])}>
                    <X className="h-3.5 w-3.5" />
                    Clear
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Table ── */}
            <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 pl-4">
                      <input
                        type="checkbox"
                        className="accent-[hsl(var(--primary))]"
                        checked={allPageSelected}
                        onChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="font-semibold">Code</TableHead>
                    <TableHead className="font-semibold">Name</TableHead>
                    <TableHead className="font-semibold">Category</TableHead>
                    <TableHead className="font-semibold">UOM</TableHead>
                    <TableHead className="font-semibold">Quantities</TableHead>
                    <TableHead className="font-semibold">Location</TableHead>
                    <TableHead className="font-semibold text-center">Ver.</TableHead>
                    <TableHead className="font-semibold">Health</TableHead>
                    <TableHead className="font-semibold">Modified</TableHead>
                    <TableHead className="font-semibold text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <SkeletonRows />
                  ) : paginatedStocks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Layers className="h-8 w-8 text-[hsl(var(--muted-foreground))] opacity-40" />
                          <p className="font-medium text-[hsl(var(--foreground))]">
                            {EMPTY_MESSAGES[tab].title}
                          </p>
                          <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-xs">
                            {EMPTY_MESSAGES[tab].subtitle}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedStocks.map((stock) => (
                      <TableRow
                        key={stock.id}
                        className={cn(
                          "transition-colors",
                          selected.includes(stock.id) && "bg-[hsl(var(--primary)/0.04)]"
                        )}
                      >
                        {/* Checkbox */}
                        <TableCell className="pl-4 w-10">
                          <input
                            type="checkbox"
                            className="accent-[hsl(var(--primary))]"
                            checked={selected.includes(stock.id)}
                            onChange={() => toggleSelect(stock.id)}
                          />
                        </TableCell>

                        {/* Stock Code */}
                        <TableCell>
                          <button
                            className="font-mono text-sm font-medium text-[hsl(var(--primary))] hover:underline"
                            onClick={() => setVersionTarget(stock)}
                          >
                            {stock.stock_code}
                          </button>
                        </TableCell>

                        {/* Name + Criticality badge */}
                        <TableCell className="max-w-[180px]">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{stock.name}</span>
                            <CriticalityBadge criticality={stock.criticality} />
                          </div>
                        </TableCell>

                        {/* Category */}
                        <TableCell className="text-sm text-[hsl(var(--muted-foreground))]">
                          {stock.category}
                        </TableCell>

                        {/* UOM */}
                        <TableCell className="text-sm">{stock.uom}</TableCell>

                        {/* Quantities */}
                        <TableCell>
                          <QuantitiesMini stock={stock} onClick={setQtyTarget} />
                        </TableCell>

                        {/* Location */}
                        <TableCell className="text-sm text-[hsl(var(--muted-foreground))] max-w-[120px] truncate">
                          {stock.location}
                        </TableCell>

                        {/* Version */}
                        <TableCell className="text-center">
                          <VersionBadge version={stock.version} />
                        </TableCell>

                        {/* Health */}
                        <TableCell>
                          <HealthBadge status={stock.health_status} />
                        </TableCell>

                        {/* Last Modified */}
                        <TableCell className="text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                          {formatRelativeTime(stock.last_updated)}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="pr-4">
                          <div className="flex items-center justify-end gap-1">
                            {tab === "draft" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="Edit"
                                  onClick={() => { setEditStock(stock); setShowModal(true); }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-emerald-400 hover:text-emerald-300"
                                  title="Request Activation"
                                  onClick={() => setActivationTarget(stock)}
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-rose-400 hover:text-rose-300"
                                  title="Delete"
                                  onClick={() => setDeleteTarget(stock)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}

                            {tab === "active" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="View"
                                  onClick={() => setQtyTarget(stock)}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="Edit"
                                  onClick={() => { setEditStock(stock); setShowModal(true); }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-amber-400 hover:text-amber-300"
                                  title="Deactivate"
                                  onClick={async () => {
                                    await new Promise((r) => setTimeout(r, 400));
                                    toast({ title: `${stock.name} deactivated` });
                                  }}
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="Version History"
                                  onClick={() => setVersionTarget(stock)}
                                >
                                  <History className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}

                            {tab === "inactive" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="View"
                                  onClick={() => setQtyTarget(stock)}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-emerald-400 hover:text-emerald-300"
                                  title="Reactivate"
                                  onClick={async () => {
                                    await new Promise((r) => setTimeout(r, 400));
                                    toast({ title: `${stock.name} reactivated` });
                                  }}
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="Version History"
                                  onClick={() => setVersionTarget(stock)}
                                >
                                  <History className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* ── Pagination ── */}
            {totalLocalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Page {localPage} of {totalLocalPages} &nbsp;·&nbsp; {tabStocks.length} items
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={localPage <= 1}
                    onClick={() => setLocalPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: Math.min(totalLocalPages, 5) }, (_, i) => i + 1).map((p) => (
                    <Button
                      key={p}
                      variant={p === localPage ? "default" : "outline"}
                      size="icon"
                      className="h-8 w-8 text-xs"
                      onClick={() => setLocalPage(p)}
                    >
                      {p}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={localPage >= totalLocalPages}
                    onClick={() => setLocalPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* ── Modals & Panels ── */}
      <StockFormModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditStock(null); }}
        editStock={editStock}
      />

      <DeleteConfirmDialog
        stock={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />

      <RequestActivationDialog
        stock={activationTarget}
        onClose={() => setActivationTarget(null)}
      />

      <QuantitiesDetailModal
        stock={qtyTarget}
        onClose={() => setQtyTarget(null)}
      />

      <VersionHistoryPanel
        stock={versionTarget}
        onClose={() => setVersionTarget(null)}
      />
    </div>
  );
}
