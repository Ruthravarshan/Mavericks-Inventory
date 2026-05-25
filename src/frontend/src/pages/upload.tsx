import { useState, useRef, useCallback } from "react";
import { Upload, FileSpreadsheet, Download, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { useUploadStocks, useUploadDistributions, useGetJobStatus, useGetJobHistory } from "@/hooks/use-queries";
import { uploadApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { formatRelativeTime, downloadBlob } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { UploadJob } from "@/types";

function DropZone({
  onFile,
  file,
  accept = ".xlsx,.xls,.csv",
}: {
  onFile: (f: File) => void;
  file: File | null;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) onFile(dropped);
    },
    [onFile]
  );

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors",
        dragging
          ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10"
          : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/50 hover:bg-slate-800/50"
      )}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      {file ? (
        <>
          <FileSpreadsheet className="h-10 w-10 text-[hsl(var(--primary))]" />
          <p className="mt-3 font-medium">{file.name}</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {(file.size / 1024).toFixed(1)} KB · Click to change
          </p>
        </>
      ) : (
        <>
          <Upload className="h-10 w-10 text-[hsl(var(--muted-foreground))]" />
          <p className="mt-3 font-medium">Drop your file here</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            or click to browse · Excel (.xlsx, .xls) or CSV
          </p>
        </>
      )}
    </div>
  );
}

function JobStatusCard({ job }: { job: UploadJob }) {
  const statusIcon = {
    queued: <Loader2 className="h-5 w-5 animate-spin text-blue-400" />,
    processing: <Loader2 className="h-5 w-5 animate-spin text-amber-400" />,
    completed: <CheckCircle2 className="h-5 w-5 text-green-400" />,
    failed: <XCircle className="h-5 w-5 text-red-400" />,
  }[job.status];

  const pct = job.total_rows > 0 ? Math.round((job.saved_rows / job.total_rows) * 100) : 0;

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-slate-900/50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {statusIcon}
          <span className="font-medium capitalize">{job.status}</span>
        </div>
        <span className="text-sm text-[hsl(var(--muted-foreground))]">{job.filename}</span>
      </div>

      {(job.status === "processing" || job.status === "completed") && (
        <Progress value={pct} className="h-2" />
      )}

      {job.status === "completed" && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total Rows", value: job.total_rows, color: "text-[hsl(var(--foreground))]" },
            { label: "Saved", value: job.saved_rows, color: "text-green-400" },
            { label: "Auto-Corrected", value: job.corrected_rows, color: "text-blue-400" },
            { label: "Failed", value: job.failed_rows, color: "text-red-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
            </div>
          ))}
        </div>
      )}

      {job.corrections.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-blue-400 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" />
            AI Self-Healing Corrections ({job.corrections.length})
          </p>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {job.corrections.map((c, i) => (
              <div key={i} className="rounded bg-blue-500/10 px-2 py-1 text-xs">
                <span className="font-medium">Row {c.row} · {c.field}:</span>{" "}
                <span className="text-[hsl(var(--muted-foreground))] line-through">{c.original_value}</span>
                {" → "}
                <span className="text-blue-400">{c.corrected_value}</span>
                {" — "}
                <span className="text-[hsl(var(--muted-foreground))]">{c.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {job.errors.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-red-400">Errors ({job.errors.length})</p>
          <div className="max-h-24 overflow-y-auto space-y-1">
            {job.errors.slice(0, 5).map((e, i) => (
              <div key={i} className="rounded bg-red-500/10 px-2 py-1 text-xs text-red-400">
                Row {e.row} · {e.field}: {e.error} (value: "{e.value}")
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UploadTab({ type }: { type: "stocks" | "distributions" }) {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);

  const uploadStocks = useUploadStocks();
  const uploadDists = useUploadDistributions();

  const { data: job } = useGetJobStatus(jobId);
  const { data: history = [], isLoading: historyLoading } = useGetJobHistory(type);

  async function handleUpload() {
    if (!file) return;
    setProgress(0);
    try {
      const result =
        type === "stocks"
          ? await uploadStocks.mutateAsync({ file, onProgress: setProgress })
          : await uploadDists.mutateAsync({ file, onProgress: setProgress });
      setJobId(result.id);
      toast({ title: "Upload started. Processing in background..." });
      setFile(null);
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
  }

  async function handleDownloadTemplate() {
    try {
      const res = await uploadApi.downloadTemplate(type);
      downloadBlob(res.data as Blob, `${type}_template.xlsx`);
    } catch {
      toast({ title: "Template download failed", variant: "destructive" });
    }
  }

  const isPending = uploadStocks.isPending || uploadDists.isPending;

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Upload {type === "stocks" ? "Stock Master" : "Distributions"}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4" />
              Download Template
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <DropZone file={file} onFile={setFile} />

          {isPending && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <Button
            className="w-full"
            disabled={!file || isPending}
            onClick={handleUpload}
          >
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</>
            ) : (
              <><Upload className="h-4 w-4" /> Upload File</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Current job status */}
      {job && (
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-base">Upload Status</CardTitle>
          </CardHeader>
          <CardContent>
            <JobStatusCard job={job} />
          </CardContent>
        </Card>
      )}

      {/* Upload history */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-base">Upload History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Saved</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead>Uploaded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-[hsl(var(--muted-foreground))]">
                    No upload history
                  </TableCell>
                </TableRow>
              ) : (
                history.slice(0, 10).map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-sm">{h.filename}</TableCell>
                    <TableCell>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", {
                        "bg-blue-500/20 text-blue-400": h.status === "queued",
                        "bg-amber-500/20 text-amber-400": h.status === "processing",
                        "bg-green-500/20 text-green-400": h.status === "completed",
                        "bg-red-500/20 text-red-400": h.status === "failed",
                      })}>
                        {h.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{h.total_rows}</TableCell>
                    <TableCell className="text-right text-green-400">{h.saved_rows}</TableCell>
                    <TableCell className="text-right text-red-400">{h.failed_rows}</TableCell>
                    <TableCell className="text-sm text-[hsl(var(--muted-foreground))]">
                      {formatRelativeTime(h.uploaded_at)}
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

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bulk Upload</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Upload stock master data or distribution records via Excel or CSV
        </p>
      </div>

      <Tabs defaultValue="stocks">
        <TabsList>
          <TabsTrigger value="stocks">Stock Master Upload</TabsTrigger>
          <TabsTrigger value="distributions">Distribution Upload</TabsTrigger>
        </TabsList>

        <TabsContent value="stocks" className="mt-4">
          <UploadTab type="stocks" />
        </TabsContent>
        <TabsContent value="distributions" className="mt-4">
          <UploadTab type="distributions" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
