import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Loader2,
  Package,
  Tag,
  X,
  Laptop,
  CheckCircle2,
  WrenchIcon,
  ArchiveIcon,
  UserCircle2,
  Edit3,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { assetsApi, employeesApi } from "@/lib/api";
import { QUERY_KEYS, CONDITION_COLORS, ASSET_STATUS_COLORS, STOCK_CATEGORIES } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import type { Asset } from "@/types";

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

function getCategoryIcon(category: string) {
  if (category === "Laptop" || category === "Desktop") return "💻";
  if (category === "Monitor") return "🖥️";
  if (category === "Mobile Phone") return "📱";
  if (category === "Software License") return "📋";
  if (category === "ID Card" || category === "Access Card") return "🪪";
  if (category === "Networking") return "🌐";
  return "⚙️";
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-[hsl(var(--border))]">
      {[40, 120, 80, 80, 100, 80].map((w, i) => (
        <td key={i} className="p-3">
          <div
            className="h-4 animate-pulse rounded bg-[hsl(var(--secondary))]"
            style={{ width: w }}
          />
        </td>
      ))}
    </tr>
  );
}

// ─── Asset Detail Side Panel ──────────────────────────────────────────────────

function AssetDetailPanel({
  asset,
  onClose,
  onAssign,
  onReturn,
  isManagerOrAbove,
}: {
  asset: Asset;
  onClose: () => void;
  onAssign: (a: Asset) => void;
  onReturn: (a: Asset) => void;
  isManagerOrAbove: boolean;
}) {
  const assignee = asset.current_assignee;

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 300 }}
      className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getCategoryIcon(asset.category)}</span>
          <div>
            <p className="font-mono text-sm font-bold text-[hsl(var(--primary))]">{asset.asset_tag}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{asset.category}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-5 p-5">
        {/* Status + Condition */}
        <div className="flex flex-wrap gap-2">
          <Badge className={ASSET_STATUS_COLORS[asset.status]} variant="outline">
            {asset.status.replace(/_/g, " ")}
          </Badge>
          <Badge className={CONDITION_COLORS[asset.condition]} variant="outline">
            {asset.condition}
          </Badge>
        </div>

        {/* Main Info */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            Asset Details
          </h3>
          {[
            { label: "Brand", value: asset.brand },
            { label: "Model", value: asset.model },
            { label: "Serial Number", value: asset.serial_number },
            { label: "Category", value: asset.category },
            { label: "Sub-category", value: asset.sub_category },
            { label: "Location", value: asset.location },
          ].map(
            ({ label, value }) =>
              value && (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
                  <span className="font-medium text-[hsl(var(--foreground))]">{value}</span>
                </div>
              )
          )}
        </div>

        {/* Financial / Dates */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            Procurement
          </h3>
          {[
            { label: "Purchase Date", value: asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString() : null },
            { label: "Warranty Expiry", value: asset.warranty_expiry ? new Date(asset.warranty_expiry).toLocaleDateString() : null },
            { label: "Purchase Price", value: asset.purchase_price ? `₹${parseFloat(asset.purchase_price).toLocaleString()}` : null },
            { label: "Invoice No.", value: asset.invoice_number },
          ].map(
            ({ label, value }) =>
              value && (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
                  <span className="font-medium text-[hsl(var(--foreground))]">{value}</span>
                </div>
              )
          )}
        </div>

        {/* Assignee */}
        {assignee && (
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Current Assignee
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))]/15 text-sm font-bold text-[hsl(var(--primary))]">
                {getInitials(assignee.employee_name)}
              </div>
              <div>
                <p className="font-semibold text-[hsl(var(--foreground))]">{assignee.employee_name ?? "Unknown"}</p>
                {assignee.employee_email && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{assignee.employee_email}</p>
                )}
              </div>
            </div>
            {[
              { label: "Employee ID", value: assignee.employee_id },
              { label: "Assigned Date", value: assignee.assigned_date ? new Date(assignee.assigned_date).toLocaleDateString() : null },
              { label: "Validity Date", value: assignee.validity_date ? new Date(assignee.validity_date).toLocaleDateString() : null },
              { label: "Next Audit Due", value: assignee.next_audit_due ? new Date(assignee.next_audit_due).toLocaleDateString() : null },
            ].map(
              ({ label, value }) =>
                value && (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
                    <span className="font-medium text-[hsl(var(--foreground))]">{value}</span>
                  </div>
                )
            )}
          </div>
        )}

        {/* Notes */}
        {asset.notes && (
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Notes
            </h3>
            <p className="text-sm text-[hsl(var(--foreground))]">{asset.notes}</p>
          </div>
        )}

        {/* Actions */}
        {isManagerOrAbove && (
          <div className="space-y-2 pt-1">
            {asset.status === "available" && (
              <Button
                className="w-full gap-2"
                onClick={() => { onAssign(asset); onClose(); }}
              >
                <UserCircle2 className="h-4 w-4" />
                Assign to Employee
              </Button>
            )}
            {asset.status === "assigned" && (
              <Button
                variant="outline"
                className="w-full gap-2 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                onClick={() => { onReturn(asset); onClose(); }}
              >
                Return to Inventory
              </Button>
            )}
            <Button variant="outline" className="w-full gap-2" disabled>
              <Edit3 className="h-4 w-4" />
              Edit Asset
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Asset Row ────────────────────────────────────────────────────────────────

function AssetRow({
  asset,
  onAssign,
  onReturn,
  onSelect,
  isManagerOrAbove,
}: {
  asset: Asset;
  onAssign: (a: Asset) => void;
  onReturn: (a: Asset) => void;
  onSelect: (a: Asset) => void;
  isManagerOrAbove: boolean;
}) {
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={() => onSelect(asset)}
      className="group cursor-pointer border-b border-[hsl(var(--border))] transition-colors hover:bg-[hsl(var(--secondary))]/60"
    >
      {/* Asset Tag */}
      <td className="p-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{getCategoryIcon(asset.category)}</span>
          <div>
            <div className="flex items-center gap-1">
              <Tag className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
              <span className="font-mono text-sm font-semibold text-[hsl(var(--primary))]">
                {asset.asset_tag}
              </span>
            </div>
            {asset.serial_number && (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">S/N: {asset.serial_number}</p>
            )}
          </div>
        </div>
      </td>

      {/* Brand / Model */}
      <td className="p-3">
        <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{asset.brand ?? "—"}</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{asset.model ?? asset.category}</p>
      </td>

      {/* Condition */}
      <td className="p-3">
        <div className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${
              asset.condition === "new"
                ? "bg-emerald-400"
                : asset.condition === "good"
                ? "bg-green-400"
                : asset.condition === "fair"
                ? "bg-yellow-400"
                : asset.condition === "poor"
                ? "bg-orange-400"
                : "bg-red-400"
            }`}
          />
          <Badge className={CONDITION_COLORS[asset.condition]} variant="outline">
            {asset.condition}
          </Badge>
        </div>
      </td>

      {/* Status */}
      <td className="p-3">
        <Badge className={ASSET_STATUS_COLORS[asset.status]} variant="outline">
          {asset.status.replace(/_/g, " ")}
        </Badge>
      </td>

      {/* Assignee */}
      <td className="p-3">
        {asset.current_assignee ? (
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))]/15 text-xs font-bold text-[hsl(var(--primary))]">
              {getInitials(asset.current_assignee.employee_name)}
            </div>
            <div>
              <p className="text-sm text-[hsl(var(--foreground))]">{asset.current_assignee.employee_name ?? "Unknown"}</p>
              {asset.current_assignee.validity_date && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Until {new Date(asset.current_assignee.validity_date).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        ) : (
          <span className="text-[hsl(var(--muted-foreground))]">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="p-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          {isManagerOrAbove && asset.status === "available" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-blue-500/40 text-xs text-blue-400 hover:bg-blue-500/10"
              onClick={(e) => { e.stopPropagation(); onAssign(asset); }}
            >
              Assign
            </Button>
          )}
          {isManagerOrAbove && asset.status === "assigned" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-amber-500/40 text-xs text-amber-400 hover:bg-amber-500/10"
              onClick={(e) => { e.stopPropagation(); onReturn(asset); }}
            >
              Return
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-[hsl(var(--muted-foreground))]"
            onClick={(e) => { e.stopPropagation(); onSelect(asset); }}
          >
            Details
          </Button>
        </div>
      </td>
    </motion.tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AssetsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isManagerOrAbove } = useAuth();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [assignDialog, setAssignDialog] = useState<Asset | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assignValidityDate, setAssignValidityDate] = useState("");
  const [createForm, setCreateForm] = useState({
    asset_tag: "",
    serial_number: "",
    category: "",
    brand: "",
    model: "",
    condition: "new",
    status: "available",
    location: "",
    purchase_date: "",
    warranty_expiry: "",
    notes: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.ASSETS, search, categoryFilter, statusFilter, page],
    queryFn: () =>
      assetsApi
        .list({
          page,
          page_size: 20,
          search: search || undefined,
          category: categoryFilter === "all" ? undefined : categoryFilter,
          status: statusFilter === "all" ? undefined : statusFilter,
        })
        .then((r) => r.data),
  });

  // Fetch all assets for stats (no filters)
  const { data: statsData } = useQuery({
    queryKey: [...QUERY_KEYS.ASSETS, "stats"],
    queryFn: () => assetsApi.list({ page_size: 1 }).then((r) => r.data),
  });
  const { data: availableStats } = useQuery({
    queryKey: [...QUERY_KEYS.ASSETS, "stats", "available"],
    queryFn: () => assetsApi.list({ status: "available", page_size: 1 }).then((r) => r.data),
  });
  const { data: assignedStats } = useQuery({
    queryKey: [...QUERY_KEYS.ASSETS, "stats", "assigned"],
    queryFn: () => assetsApi.list({ status: "assigned", page_size: 1 }).then((r) => r.data),
  });

  const { data: employeesData } = useQuery({
    queryKey: QUERY_KEYS.EMPLOYEES,
    queryFn: () => employeesApi.list({ page_size: 100 }).then((r) => r.data),
    enabled: !!assignDialog,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      assetsApi.create(createForm as Parameters<typeof assetsApi.create>[0]).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ASSETS });
      setShowCreateDialog(false);
      toast({ title: "Asset created successfully" });
    },
    onError: () => toast({ title: "Failed to create asset", variant: "destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      assetsApi
        .assign(assignDialog!.id, {
          employee_id: assignEmployeeId,
          validity_date: assignValidityDate || undefined,
        })
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ASSETS });
      setAssignDialog(null);
      setAssignEmployeeId("");
      setAssignValidityDate("");
      toast({ title: "Asset assigned successfully" });
    },
    onError: () => toast({ title: "Failed to assign asset", variant: "destructive" }),
  });

  const returnMutation = useMutation({
    mutationFn: (asset: Asset) => assetsApi.return(asset.id).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ASSETS });
      toast({ title: "Asset returned to inventory" });
    },
    onError: () => toast({ title: "Failed to return asset", variant: "destructive" }),
  });

  const assets = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;
  const totalAssets = statsData?.total ?? 0;
  const availableCount = availableStats?.total ?? 0;
  const assignedCount = assignedStats?.total ?? 0;
  const otherCount = totalAssets - availableCount - assignedCount;

  const STATUS_PILLS = [
    { value: "all", label: "All" },
    { value: "available", label: "Available" },
    { value: "assigned", label: "Assigned" },
    { value: "under_maintenance", label: "Maintenance" },
    { value: "retired", label: "Retired" },
    { value: "lost", label: "Lost" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Asset Registry</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {data?.total ?? 0} individual IT assets tracked
          </p>
        </div>
        {isManagerOrAbove && (
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Asset
          </Button>
        )}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Total Assets",
            value: totalAssets,
            icon: Package,
            color: "text-[hsl(var(--primary))]",
            bg: "bg-[hsl(var(--primary))]/10",
          },
          {
            label: "Available",
            value: availableCount,
            icon: CheckCircle2,
            color: "text-green-400",
            bg: "bg-green-500/10",
          },
          {
            label: "Assigned",
            value: assignedCount,
            icon: Laptop,
            color: "text-blue-400",
            bg: "bg-blue-500/10",
          },
          {
            label: "Maintenance / Retired",
            value: otherCount,
            icon: WrenchIcon,
            color: "text-gray-400",
            bg: "bg-gray-500/10",
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

      {/* Filter bar */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <Input
              placeholder="Search asset tag, model, serial..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select
            value={categoryFilter}
            onValueChange={(v) => {
              setCategoryFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {STOCK_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap gap-2">
          {STATUS_PILLS.map((pill) => (
            <button
              key={pill.value}
              onClick={() => {
                setStatusFilter(pill.value);
                setPage(1);
              }}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-all ${
                statusFilter === pill.value
                  ? "bg-[hsl(var(--primary))] text-white shadow-sm"
                  : "border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))]/40 hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table / States */}
      {isLoading ? (
        <div className="overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]">
                {["Asset Tag", "Brand / Model", "Condition", "Status", "Assigned To", "Actions"].map((h) => (
                  <th key={h} className="p-3 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </tbody>
          </table>
        </div>
      ) : assets.length === 0 ? (
        <Card className="border-dashed border-[hsl(var(--border))]">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--secondary))]">
              <ArchiveIcon className="h-8 w-8 text-[hsl(var(--muted-foreground))]/50" />
            </div>
            <div className="text-center">
              <p className="font-medium text-[hsl(var(--foreground))]">No assets found</p>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                {search || categoryFilter !== "all" || statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Get started by adding your first IT asset"}
              </p>
            </div>
            {isManagerOrAbove && !search && categoryFilter === "all" && statusFilter === "all" && (
              <Button onClick={() => setShowCreateDialog(true)} size="sm" className="gap-2">
                <Plus className="h-3.5 w-3.5" />
                Add First Asset
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]">
                {["Asset Tag", "Brand / Model", "Condition", "Status", "Assigned To", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="p-3 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  onAssign={setAssignDialog}
                  onReturn={(a) => returnMutation.mutate(a)}
                  onSelect={setSelectedAsset}
                  isManagerOrAbove={isManagerOrAbove}
                />
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 border-t border-[hsl(var(--border))] p-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Side panel overlay */}
      <AnimatePresence>
        {selectedAsset && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setSelectedAsset(null)}
            />
            <AssetDetailPanel
              asset={selectedAsset}
              onClose={() => setSelectedAsset(null)}
              onAssign={setAssignDialog}
              onReturn={(a) => returnMutation.mutate(a)}
              isManagerOrAbove={isManagerOrAbove}
            />
          </>
        )}
      </AnimatePresence>

      {/* Create Asset Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Asset</DialogTitle>
            <DialogDescription>Register a new IT asset with a unique asset tag</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Identity */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Identity
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>
                    Asset Tag <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    placeholder="e.g., LAP-001"
                    value={createForm.asset_tag}
                    onChange={(e) => setCreateForm((f) => ({ ...f, asset_tag: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Serial Number</Label>
                  <Input
                    placeholder="Manufacturer S/N"
                    value={createForm.serial_number}
                    onChange={(e) => setCreateForm((f) => ({ ...f, serial_number: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Classification */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Classification
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>
                    Category <span className="text-red-400">*</span>
                  </Label>
                  <Select
                    value={createForm.category}
                    onValueChange={(v) => setCreateForm((f) => ({ ...f, category: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {STOCK_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Brand</Label>
                    <Input
                      placeholder="Dell, HP, Apple..."
                      value={createForm.brand}
                      onChange={(e) => setCreateForm((f) => ({ ...f, brand: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Model</Label>
                    <Input
                      placeholder="Latitude 5530..."
                      value={createForm.model}
                      onChange={(e) => setCreateForm((f) => ({ ...f, model: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Physical Details */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Physical Details
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Condition</Label>
                  <Select
                    value={createForm.condition}
                    onValueChange={(v) => setCreateForm((f) => ({ ...f, condition: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["new", "good", "fair", "poor", "damaged"].map((c) => (
                        <SelectItem key={c} value={c}>
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Location</Label>
                  <Input
                    placeholder="IT Store, Office..."
                    value={createForm.location}
                    onChange={(e) => setCreateForm((f) => ({ ...f, location: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Procurement */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Procurement
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Purchase Date</Label>
                  <Input
                    type="date"
                    value={createForm.purchase_date}
                    onChange={(e) => setCreateForm((f) => ({ ...f, purchase_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Warranty Expiry</Label>
                  <Input
                    type="date"
                    value={createForm.warranty_expiry}
                    onChange={(e) => setCreateForm((f) => ({ ...f, warranty_expiry: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                placeholder="Any additional notes..."
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <Button
              className="w-full"
              disabled={!createForm.asset_tag || !createForm.category || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Create Asset"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog
        open={!!assignDialog}
        onOpenChange={(open) => {
          if (!open) {
            setAssignDialog(null);
            setAssignEmployeeId("");
            setAssignValidityDate("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Asset</DialogTitle>
            <DialogDescription>
              Assign{" "}
              <span className="font-mono font-semibold text-[hsl(var(--primary))]">
                {assignDialog?.asset_tag}
              </span>{" "}
              to an employee
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Asset preview */}
            {assignDialog && (
              <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/40 p-3">
                <span className="text-xl">{getCategoryIcon(assignDialog.category)}</span>
                <div>
                  <p className="font-semibold text-[hsl(var(--foreground))]">
                    {assignDialog.brand ? `${assignDialog.brand} ` : ""}
                    {assignDialog.model ?? assignDialog.category}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {assignDialog.condition} · {assignDialog.location ?? "No location"}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>
                Employee <span className="text-red-400">*</span>
              </Label>
              <Select value={assignEmployeeId} onValueChange={setAssignEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee..." />
                </SelectTrigger>
                <SelectContent>
                  {(employeesData?.items ?? []).map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      <div className="flex flex-col">
                        <span>
                          {emp.name}{" "}
                          <span className="text-[hsl(var(--muted-foreground))]">· {emp.employee_id}</span>
                        </span>
                        {emp.department && (
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">{emp.department}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Validity Date</Label>
              <Input
                type="date"
                value={assignValidityDate}
                onChange={(e) => setAssignValidityDate(e.target.value)}
              />
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Leave blank for indefinite assignment
              </p>
            </div>

            <Button
              className="w-full"
              disabled={!assignEmployeeId || assignMutation.isPending}
              onClick={() => assignMutation.mutate()}
            >
              {assignMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Assign Asset"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
