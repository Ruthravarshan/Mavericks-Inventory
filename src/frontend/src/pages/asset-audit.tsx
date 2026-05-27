import { useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Upload,
  Camera,
  Video,
  X,
  CheckCircle2,
  Loader2,
  Brain,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { myAssetsApi, assetAuditApi } from "@/lib/api";
import { QUERY_KEYS, AUDIT_STATUS_COLORS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import type { MyAsset } from "@/types";

const AUDIT_TYPE_OPTIONS = [
  { value: "self_audit", label: "Self Audit", desc: "Regular self-verification of assigned asset" },
  { value: "scheduled", label: "Scheduled Audit", desc: "Responding to a scheduled audit request" },
  { value: "renewal", label: "Renewal Audit", desc: "Asset condition check for renewal" },
  { value: "spot_check", label: "Spot Check", desc: "Manager-requested spot verification" },
];

interface UploadedFile {
  file: File;
  preview: string;
  type: "image" | "video";
}

export default function AssetAuditPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const preselectedAssetId = params.get("asset_id");

  const [selectedAssetId, setSelectedAssetId] = useState<string>(preselectedAssetId ?? "");
  const [auditType, setAuditType] = useState("self_audit");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ audit_code: string; status: string; message: string } | null>(null);

  const { data: myAssetsData } = useQuery({
    queryKey: QUERY_KEYS.MY_ASSETS,
    queryFn: () => myAssetsApi.list().then((r) => r.data),
  });

  const myAssets = myAssetsData?.items ?? [];
  const selectedAsset = myAssets.find((a) => a.asset_id === selectedAssetId);

  const mutation = useMutation({
    mutationFn: () =>
      assetAuditApi
        .submit(selectedAssetId, files.map((f) => f.file), auditType, notes, setUploadProgress)
        .then((r) => r.data),
    onSuccess: (data) => {
      setResult(data);
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_ASSET_AUDITS });
    },
    onError: () => {
      toast({ title: "Submission failed", description: "Please try again.", variant: "destructive" });
    },
  });

  const handleFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return;
    const added: UploadedFile[] = [];
    for (const file of Array.from(newFiles)) {
      if (files.length + added.length >= 5) break;
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (!isImage && !isVideo) continue;
      added.push({
        file,
        preview: isImage ? URL.createObjectURL(file) : "",
        type: isImage ? "image" : "video",
      });
    }
    setFiles((prev) => [...prev, ...added]);
  }, [files]);

  const removeFile = (idx: number) => {
    setFiles((prev) => {
      const updated = [...prev];
      if (updated[idx].preview) URL.revokeObjectURL(updated[idx].preview);
      updated.splice(idx, 1);
      return updated;
    });
  };

  if (submitted && result) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-500/15"
        >
          <Brain className="h-10 w-10 text-blue-400" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h2 className="text-2xl font-bold text-[hsl(var(--foreground))]">Audit Submitted!</h2>
          <p className="mt-2 text-[hsl(var(--muted-foreground))]">
            Code: <span className="font-mono font-semibold text-[hsl(var(--primary))]">{result.audit_code}</span>
          </p>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{result.message}</p>
          <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-blue-500/10 px-4 py-2.5 text-sm text-blue-300">
            <Brain className="h-4 w-4" />
            AI is analyzing your submission. Results will appear in your audit history.
          </div>
        </motion.div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { setSubmitted(false); setFiles([]); setNotes(""); }}>
            Submit Another
          </Button>
          <Button onClick={() => navigate("/my-assets")}>Back to My Assets</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Submit Asset Audit</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Upload a photo or video of your asset. AI will verify it automatically.
          </p>
        </div>
      </div>

      {/* Asset selector */}
      <Card className="border-[hsl(var(--border))]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select Asset</CardTitle>
          <CardDescription>Choose which asset you're auditing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Asset *</Label>
            <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an asset..." />
              </SelectTrigger>
              <SelectContent>
                {myAssets.map((a) => (
                  <SelectItem key={a.asset_id} value={a.asset_id}>
                    {a.asset_tag} — {a.brand ? `${a.brand} ` : ""}{a.model ?? a.category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedAsset && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg bg-[hsl(var(--secondary))] p-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-[hsl(var(--foreground))]">
                    {selectedAsset.brand ? `${selectedAsset.brand} ` : ""}{selectedAsset.model ?? selectedAsset.category}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {selectedAsset.asset_tag} · {selectedAsset.category}
                    {selectedAsset.serial_number ? ` · S/N: ${selectedAsset.serial_number}` : ""}
                  </p>
                </div>
                {selectedAsset.audit_status !== "ok" && (
                  <Badge className="bg-amber-500/15 text-amber-400" variant="outline">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    {selectedAsset.audit_status === "overdue" ? "Audit Overdue" : "Audit Due Soon"}
                  </Badge>
                )}
              </div>
            </motion.div>
          )}

          <div className="space-y-2">
            <Label>Audit Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {AUDIT_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAuditType(opt.value)}
                  className={`rounded-lg border p-2.5 text-left transition-all ${
                    auditType === opt.value
                      ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10"
                      : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/30"
                  }`}
                >
                  <p className={`text-sm font-medium ${auditType === opt.value ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--foreground))]"}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Media upload */}
      <Card className="border-[hsl(var(--border))]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Upload Evidence</CardTitle>
          <CardDescription>
            Upload photos or a video of the asset showing the asset tag/sticker. AI will analyze and verify.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
            className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[hsl(var(--border))] bg-[hsl(var(--secondary))] transition-colors hover:border-[hsl(var(--primary))]/40 hover:bg-[hsl(var(--primary))]/5"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div className="flex gap-3">
              <Camera className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
              <Video className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
            </div>
            <div className="text-center">
              <p className="font-medium text-[hsl(var(--foreground))]">Drop files here or click to browse</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Photos or videos (up to 5 files, 50MB each)</p>
            </div>
          </div>

          {files.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {files.map((f, i) => (
                <div key={i} className="group relative aspect-square rounded-lg overflow-hidden bg-[hsl(var(--secondary))]">
                  {f.type === "image" ? (
                    <img src={f.preview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Video className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
                      <span className="absolute bottom-1 left-1 right-1 text-center text-[10px] text-[hsl(var(--muted-foreground))] truncate">{f.file.name}</span>
                    </div>
                  )}
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white group-hover:flex"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg bg-blue-500/10 p-3 text-sm text-blue-300">
            <div className="flex items-start gap-2">
              <Brain className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">AI Verification</p>
                <p className="text-xs mt-0.5">
                  Our AI will analyze your uploaded media to verify the asset tag, check condition, and confirm it matches records.
                  If confidence is too low, a human reviewer will step in.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Additional Notes</Label>
            <Textarea
              placeholder="Any observations, issues, or notes about the asset condition..."
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {mutation.isPending && uploadProgress > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[hsl(var(--muted-foreground))]">Uploading...</span>
                <span className="text-[hsl(var(--primary))]">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-1.5" />
            </div>
          )}

          <Button
            className="w-full gap-2"
            disabled={!selectedAssetId || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting audit...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Submit Audit
                {files.length > 0 && ` (${files.length} file${files.length > 1 ? "s" : ""})`}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
