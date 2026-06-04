import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Package, TrendingDown, TrendingUp } from "lucide-react";
import { useGetStock, useGetLedger } from "@/hooks/use-queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HealthBadge } from "@/components/health-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDateTime } from "@/lib/utils";

export default function StockDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: stock, isLoading } = useGetStock(id ?? "");
  const { data: ledger, isLoading: ledgerLoading } = useGetLedger({
    stock_id: id ?? undefined,
    page_size: 20,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!stock) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Package className="mb-4 h-12 w-12 text-[hsl(var(--muted-foreground))]" />
        <h2 className="text-xl font-semibold">Stock not found</h2>
        <Button className="mt-4" onClick={() => navigate("/stocks")}>Back to Stocks</Button>
      </div>
    );
  }

  const utilization = stock.total_qty > 0 ? ((stock.distributed_qty / stock.total_qty) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{stock.name}</h1>
          <p className="font-mono text-sm text-[hsl(var(--muted-foreground))]">{stock.stock_code}</p>
        </div>
        <div className="ml-auto">
          <HealthBadge score={stock.health_score} status={stock.health_status} />
        </div>
      </div>

      {/* Stock details */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Available Qty", value: stock.available_qty.toLocaleString(), sub: stock.uom },
          { label: "Total Qty", value: stock.total_qty.toLocaleString(), sub: stock.uom },
          { label: "Distributed", value: stock.distributed_qty.toLocaleString(), sub: stock.uom },
          { label: "Utilization", value: `${utilization}%`, sub: "of total" },
        ].map(({ label, value, sub }) => (
          <Card key={label} className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
            <CardContent className="p-5">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{label}</p>
              <p className="mt-1 text-3xl font-bold">{value}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Details card */}
        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
          <CardHeader>
            <CardTitle className="text-base">Stock Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {[
                { label: "Category", value: stock.category },
                { label: "Unit of Measure", value: stock.uom },
                { label: "Location", value: stock.location },
                { label: "Min Level", value: stock.min_level.toLocaleString() },
                { label: "Max Level", value: stock.max_level.toLocaleString() },
                { label: "Status", value: stock.status },
                { label: "Last Updated", value: formatDate(stock.last_updated) },
                { label: "Created", value: formatDate(stock.created_at) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between border-b border-[hsl(var(--border))]/50 pb-3 last:border-0 last:pb-0">
                  <dt className="text-sm text-[hsl(var(--muted-foreground))]">{label}</dt>
                  <dd className="text-sm font-medium capitalize">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* Stock levels */}
        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
          <CardHeader>
            <CardTitle className="text-base">Stock Level Indicator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-[hsl(var(--muted-foreground))]">Available vs Min Level</span>
                <span className={stock.available_qty >= stock.min_level ? "text-green-400" : "text-red-400"}>
                  {stock.available_qty >= stock.min_level ? "Above Min" : "Below Min"}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                <div
                  className={`h-full rounded-full transition-all ${
                    stock.available_qty >= stock.min_level ? "bg-green-500" : "bg-red-500"
                  }`}
                  style={{
                    width: `${Math.min((stock.available_qty / Math.max(stock.max_level, 1)) * 100, 100)}%`,
                  }}
                />
              </div>
              <div className="mt-1 flex justify-between text-xs text-[hsl(var(--muted-foreground))]">
                <span>0</span>
                <span>Min: {stock.min_level}</span>
                <span>Max: {stock.max_level}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="rounded-lg bg-[hsl(var(--secondary))]/30 p-3">
                <div className="flex items-center gap-2 text-green-400">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs font-medium">Health Score</span>
                </div>
                <p className="mt-1 text-2xl font-bold">{stock.health_score}</p>
              </div>
              <div className="rounded-lg bg-[hsl(var(--secondary))]/30 p-3">
                <div className="flex items-center gap-2 text-blue-400">
                  <TrendingDown className="h-4 w-4" />
                  <span className="text-xs font-medium">Distributed</span>
                </div>
                <p className="mt-1 text-2xl font-bold">{utilization}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ledger */}
      <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
        <CardHeader>
          <CardTitle className="text-base">Transaction Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead className="text-right">Before</TableHead>
                <TableHead className="text-right">After</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledgerLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (ledger?.items ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-[hsl(var(--muted-foreground))]">
                    No transactions recorded
                  </TableCell>
                </TableRow>
              ) : (
                (ledger?.items ?? []).map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm">{formatDateTime(entry.created_at)}</TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        entry.transaction_type === "in" ? "bg-green-500/20 text-green-400" :
                        entry.transaction_type === "out" ? "bg-red-500/20 text-red-400" :
                        "bg-blue-500/20 text-blue-400"
                      }`}>
                        {entry.transaction_type}
                      </span>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${entry.qty_change > 0 ? "text-green-400" : "text-red-400"}`}>
                      {entry.qty_change > 0 ? "+" : ""}{entry.qty_change}
                    </TableCell>
                    <TableCell className="text-right">{entry.qty_before}</TableCell>
                    <TableCell className="text-right">{entry.qty_after}</TableCell>
                    <TableCell className="text-sm">{entry.actor_name}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-[hsl(var(--muted-foreground))]">
                      {entry.remarks}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
