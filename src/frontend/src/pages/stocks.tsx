import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Download, Eye, Pencil, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useListStocks, useCreateStock, useUpdateStock, useDeleteStock } from "@/hooks/use-queries";
import { stocksApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Skeleton } from "@/components/ui/skeleton";
import { HealthBadge } from "@/components/health-badge";
import { toast } from "@/hooks/use-toast";
import { formatDate, downloadBlob } from "@/lib/utils";
import { STOCK_CATEGORIES, UNITS_OF_MEASURE, LOCATIONS } from "@/lib/constants";
import type { Stock, CreateStockRequest } from "@/types";

const stockSchema = z.object({
  stock_code: z.string().min(2, "Min 2 characters"),
  name: z.string().min(2, "Min 2 characters"),
  category: z.string().min(1, "Required"),
  uom: z.string().min(1, "Required"),
  total_qty: z.coerce.number().min(0, "Must be >= 0"),
  available_qty: z.coerce.number().min(0, "Must be >= 0"),
  min_level: z.coerce.number().min(0, "Must be >= 0"),
  max_level: z.coerce.number().min(0, "Must be >= 0"),
  location: z.string().min(1, "Required"),
  status: z.enum(["active", "inactive", "draft"]),
});

type StockFormValues = z.infer<typeof stockSchema>;

function StockFormModal({
  open,
  onClose,
  editStock,
}: {
  open: boolean;
  onClose: () => void;
  editStock?: Stock | null;
}) {
  const createStock = useCreateStock();
  const updateStock = useUpdateStock();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<StockFormValues>({
    resolver: zodResolver(stockSchema),
    defaultValues: editStock
      ? {
          stock_code: editStock.stock_code,
          name: editStock.name,
          category: editStock.category,
          uom: editStock.uom,
          total_qty: editStock.total_qty,
          available_qty: editStock.available_qty,
          min_level: editStock.min_level,
          max_level: editStock.max_level,
          location: editStock.location,
          status: editStock.status,
        }
      : {
          status: "active",
          total_qty: 0,
          available_qty: 0,
          min_level: 0,
          max_level: 0,
        },
  });

  async function onSubmit(data: StockFormValues) {
    try {
      if (editStock) {
        await updateStock.mutateAsync({ id: editStock.id, data });
        toast({ title: "Stock updated successfully" });
      } else {
        await createStock.mutateAsync(data as CreateStockRequest);
        toast({ title: "Stock created successfully" });
      }
      reset();
      onClose();
    } catch {
      toast({ title: "Operation failed", variant: "destructive" });
    }
  }

  const isPending = createStock.isPending || updateStock.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editStock ? "Edit Stock" : "Add New Stock"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Stock Code *</Label>
              <Input placeholder="e.g. STK001" {...register("stock_code")} />
              {errors.stock_code && <p className="text-xs text-red-400">{errors.stock_code.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input placeholder="Item name" {...register("name")} />
              {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Category *</Label>
              <Select value={watch("category")} onValueChange={(v) => setValue("category", v)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {STOCK_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-red-400">{errors.category.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Unit of Measure *</Label>
              <Select value={watch("uom")} onValueChange={(v) => setValue("uom", v)}>
                <SelectTrigger><SelectValue placeholder="Select UoM" /></SelectTrigger>
                <SelectContent>
                  {UNITS_OF_MEASURE.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.uom && <p className="text-xs text-red-400">{errors.uom.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Total Qty *</Label>
              <Input type="number" {...register("total_qty")} />
              {errors.total_qty && <p className="text-xs text-red-400">{errors.total_qty.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Available Qty *</Label>
              <Input type="number" {...register("available_qty")} />
              {errors.available_qty && <p className="text-xs text-red-400">{errors.available_qty.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Min Level *</Label>
              <Input type="number" {...register("min_level")} />
              {errors.min_level && <p className="text-xs text-red-400">{errors.min_level.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Max Level *</Label>
              <Input type="number" {...register("max_level")} />
              {errors.max_level && <p className="text-xs text-red-400">{errors.max_level.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Location *</Label>
              <Select value={watch("location")} onValueChange={(v) => setValue("location", v)}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>
                  {LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.location && <p className="text-xs text-red-400">{errors.location.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Status *</Label>
              <Select value={watch("status")} onValueChange={(v) => setValue("status", v as "active" | "inactive" | "draft")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
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

function DeleteConfirmDialog({
  stock,
  onConfirm,
  onClose,
}: {
  stock: Stock | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const deleteStock = useDeleteStock();

  async function handleDelete() {
    if (!stock) return;
    try {
      await deleteStock.mutateAsync(stock.id);
      toast({ title: "Stock deleted" });
      onConfirm();
      onClose();
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  }

  return (
    <Dialog open={!!stock} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Stock</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Are you sure you want to delete <strong>{stock?.name}</strong> ({stock?.stock_code})? This action cannot be undone.
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

export default function StocksPage() {
  const navigate = useNavigate();
  const { isAdmin, isExecutive } = useAuth();
  const canCreate = isAdmin || isExecutive;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editStock, setEditStock] = useState<Stock | null>(null);
  const [deleteStock, setDeleteStock] = useState<Stock | null>(null);

  const { data, isLoading } = useListStocks({
    page,
    page_size: 20,
    search: search || undefined,
    category: category || undefined,
    status: status || undefined,
  });

  const stocks = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;

  async function handleExport() {
    try {
      const res = await stocksApi.exportCsv();
      downloadBlob(res.data as Blob, "stocks.csv");
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock Master</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {data?.total ?? 0} total items
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          {canCreate && (
            <Button size="sm" onClick={() => { setEditStock(null); setShowModal(true); }}>
              <Plus className="h-4 w-4" />
              Add Stock
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <Input
            placeholder="Search stocks..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={(v) => { setCategory(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {STOCK_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[hsl(var(--border))] bg-slate-800/30">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Stock Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>UoM</TableHead>
              <TableHead className="text-right">Available Qty</TableHead>
              <TableHead className="text-right">Min Level</TableHead>
              <TableHead>Health</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 10 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : stocks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-12 text-center text-[hsl(var(--muted-foreground))]">
                  No stocks found. {canCreate && "Create your first stock item."}
                </TableCell>
              </TableRow>
            ) : (
              stocks.map((stock) => (
                <TableRow key={stock.id} className="cursor-pointer" onClick={() => navigate(`/stocks/${stock.id}`)}>
                  <TableCell className="font-mono text-sm">{stock.stock_code}</TableCell>
                  <TableCell className="font-medium">{stock.name}</TableCell>
                  <TableCell className="text-[hsl(var(--muted-foreground))]">{stock.category}</TableCell>
                  <TableCell>{stock.uom}</TableCell>
                  <TableCell className="text-right font-medium">{stock.available_qty.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-[hsl(var(--muted-foreground))]">{stock.min_level.toLocaleString()}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <HealthBadge score={stock.health_score} status={stock.health_status} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      stock.status === "active" ? "bg-green-500/20 text-green-400" :
                      stock.status === "draft" ? "bg-gray-500/20 text-gray-400" :
                      "bg-red-500/20 text-red-400"
                    }`}>
                      {stock.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-[hsl(var(--muted-foreground))] text-sm">
                    {formatDate(stock.last_updated)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/stocks/${stock.id}`)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canCreate && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditStock(stock); setShowModal(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {stock.status === "draft" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300" onClick={() => setDeleteStock(stock)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Page {page} of {totalPages} ({data?.total} items)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Modals */}
      <StockFormModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditStock(null); }}
        editStock={editStock}
      />
      <DeleteConfirmDialog
        stock={deleteStock}
        onConfirm={() => {}}
        onClose={() => setDeleteStock(null)}
      />
    </div>
  );
}
