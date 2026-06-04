import { useState } from "react";
import { Search, FileText } from "lucide-react";
import { useGetAuditLog } from "@/hooks/use-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const EVENT_TYPES = [
  "user_login",
  "user_logout",
  "stock_created",
  "stock_updated",
  "stock_deleted",
  "distribution_created",
  "distribution_submitted",
  "distribution_approved",
  "distribution_rejected",
  "anomaly_detected",
  "anomaly_resolved",
  "upload_completed",
  "user_created",
  "user_deactivated",
];

const EVENT_COLOR: Record<string, string> = {
  user_login: "bg-blue-500/20 text-blue-400",
  user_logout: "bg-gray-500/20 text-gray-400",
  distribution_approved: "bg-green-500/20 text-green-400",
  distribution_rejected: "bg-red-500/20 text-red-400",
  anomaly_detected: "bg-amber-500/20 text-amber-400",
  anomaly_resolved: "bg-emerald-500/20 text-emerald-400",
  stock_created: "bg-purple-500/20 text-purple-400",
  stock_deleted: "bg-red-500/20 text-red-400",
};

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading } = useGetAuditLog({
    page,
    page_size: 50,
    search: search || undefined,
    event_type: eventType || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });

  const entries = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {data?.total ?? 0} total events
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
              <Input
                placeholder="Search by actor, entity..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <div className="min-w-[180px]">
              <Label className="mb-1 text-xs">Event Type</Label>
              <Select value={eventType} onValueChange={(v) => { setEventType(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="All Events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 text-xs">From Date</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="w-36"
              />
            </div>
            <div>
              <Label className="mb-1 text-xs">To Date</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="w-36"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Event Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-16 text-center">
                  <FileText className="mx-auto mb-3 h-8 w-8 text-[hsl(var(--muted-foreground))]/30" />
                  <p className="text-[hsl(var(--muted-foreground))]">No audit events found</p>
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDateTime(entry.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{entry.actor_name}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))] capitalize">
                      {entry.actor_role?.replace(/_/g, " ")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      EVENT_COLOR[entry.event_type] ?? "bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]"
                    )}>
                      {entry.event_type.replace(/_/g, " ")}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[300px]">
                    <p className="truncate text-sm">{entry.description}</p>
                  </TableCell>
                  <TableCell>
                    {entry.entity_name && (
                      <div>
                        <div className="text-sm">{entry.entity_name}</div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))] capitalize">
                          {entry.entity_type}
                        </div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-[hsl(var(--muted-foreground))]">
                    {entry.ip_address ?? "—"}
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
            Page {page} of {totalPages} ({data?.total} events)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
