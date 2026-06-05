import { useState } from "react";
import { FileSpreadsheet, FileText, BarChart3, Search, Loader2 } from "lucide-react";
import { useGetReport } from "@/hooks/use-queries";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { downloadBlob, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface ReportDef {
  id: string;
  label: string;
  description: string;
  adminOnly?: boolean;
  filters: ReportFilter[];
}

interface ReportFilter {
  key: string;
  label: string;
  type: "text" | "date" | "select";
  options?: { value: string; label: string }[];
}

const REPORTS: ReportDef[] = [
  {
    id: "stock-availability",
    label: "Current Stock Availability",
    description: "Real-time view of all stock quantities and health",
    filters: [
      { key: "category", label: "Category", type: "select", options: [
        { value: "", label: "All Categories" },
        { value: "Electronics", label: "Electronics" },
        { value: "Stationery", label: "Stationery" },
        { value: "IT Equipment", label: "IT Equipment" },
      ]},
    ],
  },
  {
    id: "distribution-history",
    label: "Stock Distribution History",
    description: "Complete history of all stock distributions",
    filters: [
      { key: "date_from", label: "From Date", type: "date" },
      { key: "date_to", label: "To Date", type: "date" },
      { key: "status", label: "Status", type: "select", options: [
        { value: "", label: "All Status" },
        { value: "approved", label: "Approved" },
        { value: "rejected", label: "Rejected" },
        { value: "l1_pending", label: "L1 Pending" },
      ]},
    ],
  },
  {
    id: "pending-approvals",
    label: "Pending Approvals",
    description: "All distributions awaiting approval",
    filters: [
      { key: "risk_level", label: "Risk Level", type: "select", options: [
        { value: "", label: "All Risk" },
        { value: "High", label: "High" },
        { value: "Medium", label: "Medium" },
        { value: "Low", label: "Low" },
      ]},
    ],
  },
  {
    id: "approval-history",
    label: "Approval History",
    description: "Record of all approval decisions",
    filters: [
      { key: "date_from", label: "From Date", type: "date" },
      { key: "date_to", label: "To Date", type: "date" },
    ],
  },
  {
    id: "stock-ledger",
    label: "Stock Movement Ledger",
    description: "Detailed log of all stock movements",
    filters: [
      { key: "date_from", label: "From Date", type: "date" },
      { key: "date_to", label: "To Date", type: "date" },
    ],
  },
  {
    id: "anomaly-history",
    label: "Anomaly History",
    description: "Log of all detected anomalies",
    filters: [
      { key: "severity", label: "Severity", type: "select", options: [
        { value: "", label: "All Severity" },
        { value: "critical", label: "Critical" },
        { value: "warning", label: "Warning" },
        { value: "info", label: "Info" },
      ]},
    ],
  },
  {
    id: "rejection-analysis",
    label: "Rejection Analysis",
    description: "Analysis of rejected distributions",
    filters: [
      { key: "date_from", label: "From Date", type: "date" },
      { key: "date_to", label: "To Date", type: "date" },
    ],
  },
  {
    id: "user-activity",
    label: "User Activity Summary",
    description: "Per-user activity totals — events, distributions, approvals & last active",
    adminOnly: true,
    filters: [
      { key: "date_from", label: "From Date", type: "date" },
      { key: "date_to", label: "To Date", type: "date" },
    ],
  },
];

export default function ReportsPage() {
  const { isAdmin } = useAuth();
  const [selectedReport, setSelectedReport] = useState<ReportDef>(REPORTS[0]);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [isExporting, setIsExporting] = useState<"excel" | "pdf" | null>(null);

  const availableReports = REPORTS.filter((r) => !r.adminOnly || isAdmin);

  const { data: reportData, isLoading } = useGetReport(
    selectedReport.id,
    Object.fromEntries(Object.entries(activeFilters).filter(([, v]) => v)),
    true
  );

  function handleRunReport() {
    setActiveFilters({ ...filterValues });
  }

  // Build the report table as HTML from the data already loaded in memory.
  function buildTableHtml(): string {
    const cols = reportData?.columns ?? [];
    const rows = reportData?.rows ?? [];
    const esc = (v: unknown) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const head = cols.map((c) => `<th>${esc(c.label)}</th>`).join("");
    const body = rows
      .map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c.key])}</td>`).join("")}</tr>`)
      .join("");
    return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }

  // Client-side export — no backend round-trip. Excel via an .xls HTML workbook
  // (opens natively in Excel); PDF via a print window the user saves as PDF.
  function handleExport(format: "excel" | "pdf") {
    if (!reportData || reportData.rows.length === 0) {
      toast({ title: "Nothing to export", description: "Run a report with results first." });
      return;
    }
    setIsExporting(format);
    try {
      const title = selectedReport.label;
      const stamp = new Date().toISOString().slice(0, 10);
      const meta = `${reportData.rows.length} rows · Generated ${new Date().toLocaleString()}`;

      if (format === "excel") {
        const html =
          `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">` +
          `<head><meta charset="utf-8"><style>table{border-collapse:collapse}th,td{border:1px solid #ccc;padding:4px 8px}th{background:#f3f4f6}</style></head>` +
          `<body><h3>${title}</h3>${buildTableHtml()}</body></html>`;
        const blob = new Blob(["﻿", html], { type: "application/vnd.ms-excel" });
        downloadBlob(blob, `${selectedReport.id}-${stamp}.xls`);
      } else {
        const win = window.open("", "_blank");
        if (!win) {
          toast({
            title: "Pop-up blocked",
            description: "Allow pop-ups for this site to export as PDF.",
            variant: "destructive",
          });
          return;
        }
        win.document.write(
          `<html><head><title>${title}</title><style>` +
            `body{font-family:Inter,system-ui,sans-serif;padding:24px;color:#111}` +
            `h2{margin:0 0 4px}.meta{color:#666;font-size:12px;margin-bottom:16px}` +
            `table{border-collapse:collapse;width:100%;font-size:12px}` +
            `th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f3f4f6}` +
            `</style></head><body><h2>${title}</h2><div class="meta">${meta}</div>${buildTableHtml()}` +
            `<script>window.onload=function(){window.focus();window.print();}</script></body></html>`
        );
        win.document.close();
      }
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setIsExporting(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:h-full">
      {/* Sidebar report list */}
      <div className="w-full shrink-0 space-y-1 lg:w-64">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          Reports
        </p>
        {availableReports.map((report) => (
          <button
            key={report.id}
            onClick={() => {
              setSelectedReport(report);
              setFilterValues({});
              setActiveFilters({});
            }}
            className={cn(
              "w-full rounded-lg p-3 text-left text-sm transition-colors",
              selectedReport.id === report.id
                ? "bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]"
                : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]"
            )}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 shrink-0" />
              <span className="font-medium">{report.label}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 space-y-5 overflow-hidden">
        <div>
          <h1 className="text-xl font-bold">{selectedReport.label}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{selectedReport.description}</p>
        </div>

        {/* Filters */}
        {selectedReport.filters.length > 0 && (
          <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
            <CardContent className="pt-4">
              <div className="flex flex-wrap items-end gap-4">
                {selectedReport.filters.map((filter) => (
                  <div key={filter.key} className="min-w-[140px] space-y-1">
                    <Label className="text-xs">{filter.label}</Label>
                    {filter.type === "select" ? (
                      <Select
                        value={filterValues[filter.key] ?? ""}
                        onValueChange={(v) =>
                          setFilterValues((prev) => ({ ...prev, [filter.key]: v }))
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(filter.options ?? []).map((opt) => (
                            <SelectItem key={opt.value} value={opt.value || "_all"}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={filter.type === "date" ? "date" : "text"}
                        className="h-9"
                        value={filterValues[filter.key] ?? ""}
                        onChange={(e) =>
                          setFilterValues((prev) => ({ ...prev, [filter.key]: e.target.value }))
                        }
                      />
                    )}
                  </div>
                ))}
                <Button size="sm" onClick={handleRunReport}>
                  <Search className="h-4 w-4" />
                  Run Report
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Export buttons */}
        {reportData && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {reportData.total_rows} row{reportData.total_rows !== 1 ? "s" : ""} ·
              Generated {formatDateTime(reportData.generated_at)}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("excel")}
                disabled={!!isExporting}
              >
                {isExporting === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                Export Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("pdf")}
                disabled={!!isExporting}
              >
                {isExporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Export PDF
              </Button>
            </div>
          </div>
        )}

        {/* Results table */}
        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <TableHead key={i}><Skeleton className="h-4 w-24" /></TableHead>
                      ))
                    : (reportData?.columns ?? []).map((col) => (
                        <TableHead key={col.key}>{col.label}</TableHead>
                      ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !reportData || reportData.rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={reportData?.columns.length ?? 5}
                      className="py-16 text-center text-[hsl(var(--muted-foreground))]"
                    >
                      <BarChart3 className="mx-auto mb-3 h-8 w-8 opacity-30" />
                      No data for the selected filters.
                      <br />
                      <span className="text-xs">Adjust filters and run the report.</span>
                    </TableCell>
                  </TableRow>
                ) : (
                  reportData.rows.map((row, i) => (
                    <TableRow key={i}>
                      {reportData.columns.map((col) => (
                        <TableCell key={col.key} className="text-sm">
                          {col.type === "badge" ? (
                            <span className="rounded-full bg-[hsl(var(--secondary))] px-2 py-0.5 text-xs">
                              {String(row[col.key] ?? "")}
                            </span>
                          ) : (
                            String(row[col.key] ?? "—")
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
