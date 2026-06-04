import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Package, ArrowLeft, Info } from "lucide-react";
import { useListStocks, useCreateDistribution, useSubmitDistribution } from "@/hooks/use-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { useLocations } from "@/hooks/use-queries";
import { fuzzyFilter } from "@/lib/fuzzy";

const distributionSchema = z.object({
  stock_id: z.string().min(1, "Please select a stock item"),
  qty_requested: z.coerce.number().min(1, "Quantity must be at least 1"),
  recipient_type: z.enum(["employee", "project"]),
  recipient_id: z.string().min(1, "Recipient ID is required"),
  recipient_name: z.string().min(2, "Recipient name is required"),
  distribution_date: z.string().min(1, "Date is required"),
  location: z.string().min(1, "Location is required"),
  purpose: z.string().min(10, "Purpose must be at least 10 characters"),
});

type DistributionFormValues = z.infer<typeof distributionSchema>;

export default function NewDistributionPage() {
  const navigate = useNavigate();
  const createDistribution = useCreateDistribution();
  const submitDistribution = useSubmitDistribution();
  const { data: locationsData } = useLocations();
  const locationsList = locationsData ?? [];

  const [selectedStockId, setSelectedStockId] = useState<string>("");
  const [stockSearch, setStockSearch] = useState("");

  // Load a wider pool of active stocks and filter client-side with fuzzy match
  // so typos and partial matches still surface useful results.
  const { data: stocksData } = useListStocks({
    status: "active",
    page_size: 200,
  });
  const allStocks = stocksData?.items ?? [];
  const stocks = fuzzyFilter(
    allStocks,
    stockSearch,
    [(s) => s.name, (s) => s.stock_code, (s) => s.category]
  );
  const selectedStock = allStocks.find((s) => s.id === selectedStockId);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DistributionFormValues>({
    resolver: zodResolver(distributionSchema),
    defaultValues: {
      recipient_type: "employee",
      distribution_date: new Date().toISOString().split("T")[0],
    },
  });

  const watchedQty = watch("qty_requested");
  const recipientType = watch("recipient_type");
  const isOverQty = selectedStock && watchedQty > selectedStock.available_qty;

  async function onSaveDraft(data: DistributionFormValues) {
    try {
      await createDistribution.mutateAsync(data);
      toast({ title: "Draft saved successfully" });
      navigate("/distributions");
    } catch {
      toast({ title: "Failed to save draft", variant: "destructive" });
    }
  }

  async function onSubmit(data: DistributionFormValues) {
    try {
      const dist = await createDistribution.mutateAsync(data);
      if (!dist?.id) throw new Error("Invalid response from server");
      await submitDistribution.mutateAsync(dist.id);
      toast({ title: "Distribution submitted for approval" });
      navigate("/distributions");
    } catch {
      toast({ title: "Failed to submit distribution", variant: "destructive" });
    }
  }

  const isPending = createDistribution.isPending || submitDistribution.isPending;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Distribution</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Create a new stock distribution request
          </p>
        </div>
      </div>

      <form className="space-y-6">
        {/* Section 1: Stock Selection */}
        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-[hsl(var(--primary))]" />
              Stock Selection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Stock Item *</Label>
              <Input
                placeholder="Search stock by name or code..."
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                className="mb-2"
              />
              <Select
                value={selectedStockId}
                onValueChange={(v) => {
                  setSelectedStockId(v);
                  setValue("stock_id", v);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a stock item" />
                </SelectTrigger>
                <SelectContent>
                  {stocks.length === 0 ? (
                    <div className="py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
                      No stocks found
                    </div>
                  ) : (
                    stocks.map((stock) => (
                      <SelectItem key={stock.id} value={stock.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
                            {stock.stock_code}
                          </span>
                          <span>{stock.name}</span>
                          <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
                            ({stock.category}) · {stock.available_qty} {stock.uom} avail.
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {errors.stock_id && (
                <p className="text-xs text-red-400">{errors.stock_id.message}</p>
              )}
            </div>

            {/* Selected stock info */}
            {selectedStock && (
              <div className="rounded-lg border border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary))]/5 p-4">
                <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Category</p>
                    <p className="font-medium">{selectedStock.category}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Available Qty</p>
                    <p className="font-bold text-[hsl(var(--primary))]">
                      {selectedStock.available_qty.toLocaleString()} {selectedStock.uom}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Location</p>
                    <p className="font-medium">{selectedStock.location}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Quantity Requested *</Label>
              <Input
                type="number"
                min={1}
                max={selectedStock?.available_qty}
                placeholder="Enter quantity"
                {...register("qty_requested")}
              />
              {errors.qty_requested && (
                <p className="text-xs text-red-400">{errors.qty_requested.message}</p>
              )}
              {isOverQty && (
                <Alert variant="warning">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Requested quantity ({watchedQty}) exceeds available stock ({selectedStock?.available_qty}).
                    This will be flagged as high risk.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Recipient */}
        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
          <CardHeader>
            <CardTitle className="text-base">Recipient Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Recipient Type *</Label>
              <div className="flex gap-3">
                {(["employee", "project"] as const).map((type) => (
                  <label
                    key={type}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-3 text-sm transition-colors ${
                      recipientType === type
                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                        : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/50"
                    }`}
                  >
                    <input
                      type="radio"
                      value={type}
                      className="sr-only"
                      {...register("recipient_type")}
                    />
                    <span className="capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{recipientType === "employee" ? "Employee ID" : "Project ID"} *</Label>
                <Input
                  placeholder={recipientType === "employee" ? "EMP001" : "PRJ001"}
                  {...register("recipient_id")}
                />
                {errors.recipient_id && (
                  <p className="text-xs text-red-400">{errors.recipient_id.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{recipientType === "employee" ? "Employee Name" : "Project Name"} *</Label>
                <Input
                  placeholder="Full name"
                  {...register("recipient_name")}
                />
                {errors.recipient_name && (
                  <p className="text-xs text-red-400">{errors.recipient_name.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Distribution Details */}
        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
          <CardHeader>
            <CardTitle className="text-base">Distribution Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Distribution Date *</Label>
                <Input
                  type="date"
                  {...register("distribution_date")}
                />
                {errors.distribution_date && (
                  <p className="text-xs text-red-400">{errors.distribution_date.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Location *</Label>
                <Select onValueChange={(v) => setValue("location", v)}>
                  <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                  <SelectContent>
                    {locationsList.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.location && (
                  <p className="text-xs text-red-400">{errors.location.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Purpose *</Label>
              <Textarea
                placeholder="Describe the purpose of this distribution (min. 10 characters)..."
                rows={4}
                {...register("purpose")}
              />
              {errors.purpose && (
                <p className="text-xs text-red-400">{errors.purpose.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={handleSubmit(onSaveDraft)}
          >
            {isPending && createDistribution.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save as Draft
          </Button>
          <Button
            type="button"
            disabled={isPending}
            onClick={handleSubmit(onSubmit)}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit for Approval
          </Button>
        </div>
      </form>
    </div>
  );
}
