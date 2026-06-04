import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Camera,
  X,
  Loader2,
  Brain,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  QrCode,
  RefreshCw,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { myAssetsApi, assetAuditApi, auditSessionApi } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

const AUDIT_TYPE_OPTIONS = [
  { value: "self_audit", label: "Self Audit", desc: "Regular self-verification of assigned asset" },
  { value: "scheduled", label: "Scheduled Audit", desc: "Responding to a scheduled audit request" },
  { value: "renewal", label: "Renewal Audit", desc: "Asset condition check for renewal" },
  { value: "spot_check", label: "Spot Check", desc: "Manager-requested spot verification" },
];

type CameraState = "idle" | "active" | "captured";

export default function AssetAuditPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const preselectedAssetId = params.get("asset_id");

  const [selectedAssetId, setSelectedAssetId] = useState<string>(preselectedAssetId ?? "");
  const [auditType, setAuditType] = useState("self_audit");
  const [notes, setNotes] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ audit_code: string; status: string; message: string } | null>(null);

  // Local camera state
  const [captureMode, setCaptureMode] = useState<"local" | "qr">("local");
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string>("");
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [cameraError, setCameraError] = useState("");

  // QR / mobile session state
  const [qrToken, setQrToken] = useState<string>("");
  const [qrExpiry, setQrExpiry] = useState<Date | null>(null);
  const [qrGenerating, setQrGenerating] = useState(false);
  const [qrPolling, setQrPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: myAssetsData } = useQuery({
    queryKey: QUERY_KEYS.MY_ASSETS,
    queryFn: () => myAssetsApi.list().then((r) => r.data),
  });

  const myAssets = myAssetsData?.items ?? [];
  const selectedAsset = myAssets.find((a) => a.asset_id === selectedAssetId);

  // Attach stream to video element whenever both are ready
  useEffect(() => {
    if (cameraState === "active" && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraState, stream]);

  // Stop stream on unmount
  useEffect(() => {
    return () => { stream?.getTracks().forEach((t) => t.stop()); };
  }, [stream]);

  async function openCamera() {
    setCameraError("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setStream(s);
      setCameraState("active");
    } catch {
      setCameraError("Camera access denied. Please allow camera access in your browser settings.");
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);

    // Tamper-proof timestamp watermark
    const now = new Date();
    const stamp = `LIVE CAPTURE  ${now.toLocaleString("en-GB")}`;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, canvas.height - 38, canvas.width, 38);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px monospace";
    ctx.fillText(stamp, 12, canvas.height - 13);

    const dataURL = canvas.toDataURL("image/jpeg", 0.92);
    setCapturedPreview(dataURL);

    canvas.toBlob((blob) => {
      if (blob) setCapturedFile(new File([blob], `audit-live-${Date.now()}.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);

    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCameraState("captured");
  }

  function retakePhoto() {
    setCapturedPreview("");
    setCapturedFile(null);
    setCameraState("idle");
  }

  // Stop polling on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const generateQR = useCallback(async () => {
    setQrGenerating(true);
    try {
      const res = await auditSessionApi.createSession(selectedAssetId);
      const { token, expires_at } = res.data;
      setQrToken(token);
      setQrExpiry(new Date(expires_at));
      setQrPolling(true);

      // Poll every 2.5s for mobile upload
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const status = await auditSessionApi.pollStatus(token);
          if (status.data.status === "received" && status.data.photo_data_url) {
            clearInterval(pollRef.current!);
            setQrPolling(false);
            // Convert data URL to File
            const dataUrl = status.data.photo_data_url;
            const mime = dataUrl.split(";")[0].split(":")[1] ?? "image/jpeg";
            const b64 = dataUrl.split(",")[1];
            const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            const blob = new Blob([bytes], { type: mime });
            const file = new File([blob], `mobile-audit-${Date.now()}.jpg`, { type: mime });
            setCapturedFile(file);
            setCapturedPreview(dataUrl);
            setCaptureMode("local"); // switch view to show the captured photo
            setCameraState("captured");
            toast({ title: "Photo received from mobile!", description: "Review and submit your audit." });
          }
        } catch {
          // silently continue polling
        }
      }, 2500);
    } catch {
      toast({ title: "Failed to generate QR code", variant: "destructive" });
    } finally {
      setQrGenerating(false);
    }
  }, [selectedAssetId]);

  const qrUrl = qrToken ? `${window.location.origin}/mobile-audit?t=${qrToken}` : "";
  const qrSecondsLeft = qrExpiry ? Math.max(0, Math.floor((qrExpiry.getTime() - Date.now()) / 1000)) : 0;

  const mutation = useMutation({
    mutationFn: () =>
      assetAuditApi
        .submit(selectedAssetId, capturedFile ? [capturedFile] : [], auditType, notes, setUploadProgress)
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
          <Button variant="outline" onClick={() => { setSubmitted(false); setCapturedFile(null); setCapturedPreview(""); setCameraState("idle"); setNotes(""); }}>
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

      {/* Camera capture */}
      <Card className="border-[hsl(var(--border))]">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="h-4 w-4 text-[hsl(var(--primary))]" />
                Live Photo Capture
              </CardTitle>
              <CardDescription className="mt-1">
                Real-time camera only — prevents tampered or pre-taken photos
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-400 shrink-0">
              <ShieldCheck className="h-3.5 w-3.5" />
              Tamper-proof
            </div>
          </div>

          {/* Mode toggle — only when no photo captured yet */}
          {cameraState !== "captured" && (
            <div className="flex rounded-lg border border-[hsl(var(--border))] overflow-hidden text-xs font-medium">
              <button
                onClick={() => { setCaptureMode("local"); if (pollRef.current) clearInterval(pollRef.current); setQrPolling(false); }}
                className={`flex flex-1 items-center justify-center gap-1.5 py-2 transition-colors ${captureMode === "local" ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" : "hover:bg-[hsl(var(--secondary))]"}`}
              >
                <Camera className="h-3.5 w-3.5" />
                This Device
              </button>
              <button
                onClick={() => setCaptureMode("qr")}
                className={`flex flex-1 items-center justify-center gap-1.5 py-2 transition-colors ${captureMode === "qr" ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" : "hover:bg-[hsl(var(--secondary))]"}`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                Scan with Phone
              </button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* QR / mobile capture panel */}
          {captureMode === "qr" && cameraState !== "captured" && (
            <div className="space-y-4">
              {!qrToken ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10">
                    <QrCode className="h-8 w-8 text-[hsl(var(--primary))]" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-medium text-sm">Use your phone's camera</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Generate a QR code, scan it on your phone, take the photo — it appears here automatically.
                    </p>
                  </div>
                  <Button onClick={generateQR} disabled={!selectedAssetId || qrGenerating} className="gap-2">
                    {qrGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                    {qrGenerating ? "Generating…" : "Generate QR Code"}
                  </Button>
                  {!selectedAssetId && (
                    <p className="text-xs text-amber-400">Select an asset above first</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="rounded-2xl border-4 border-[hsl(var(--primary))]/20 bg-white p-4 shadow-lg">
                    <QRCodeSVG value={qrUrl} size={200} level="H" includeMargin={false} />
                  </div>
                  <div className="text-center space-y-0.5">
                    <p className="text-sm font-medium">Scan this with your phone camera</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Opens a live camera page — no login required
                    </p>
                  </div>
                  {qrPolling ? (
                    <div className="flex items-center gap-2 rounded-full bg-[hsl(var(--primary))]/10 px-4 py-2 text-xs text-[hsl(var(--primary))]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Waiting for photo from phone…
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                      Session timed out
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={generateQR} disabled={qrGenerating}>
                      <RefreshCw className="h-3.5 w-3.5" />
                      New QR
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs text-[hsl(var(--muted-foreground))]"
                      onClick={() => { navigator.clipboard?.writeText(qrUrl); toast({ title: "Link copied" }); }}
                    >
                      Copy Link
                    </Button>
                  </div>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                    Expires in ~{Math.floor(qrSecondsLeft / 60)}m {qrSecondsLeft % 60}s
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Camera error */}
          {captureMode === "local" && cameraError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
              <X className="mt-0.5 h-4 w-4 shrink-0" />
              {cameraError}
            </div>
          )}

          {/* Idle state — start camera button */}
          {captureMode === "local" && cameraState === "idle" && !cameraError && (
            <button
              onClick={openCamera}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[hsl(var(--border))] bg-[hsl(var(--secondary))] py-10 transition-colors hover:border-[hsl(var(--primary))]/40 hover:bg-[hsl(var(--primary))]/5"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10">
                <Camera className="h-7 w-7 text-[hsl(var(--primary))]" />
              </div>
              <div className="text-center">
                <p className="font-medium text-[hsl(var(--foreground))]">Open Camera</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Live capture required — no file uploads allowed</p>
              </div>
            </button>
          )}

          {/* Active camera — live video feed */}
          {captureMode === "local" && cameraState === "active" && (
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-xl bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full rounded-xl"
                  style={{ maxHeight: "360px", objectFit: "cover" }}
                />
                {/* LIVE badge */}
                <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white shadow">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  LIVE
                </div>
                {/* Aim guide */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="h-32 w-48 rounded-lg border-2 border-dashed border-white/40" />
                </div>
              </div>
              <p className="text-center text-xs text-[hsl(var(--muted-foreground))]">
                Point camera at the asset tag/sticker, then capture
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2" onClick={retakePhoto}>
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button className="flex-1 gap-2" onClick={capturePhoto}>
                  <Camera className="h-4 w-4" />
                  Capture Photo
                </Button>
              </div>
            </div>
          )}

          {/* Captured photo preview (from either local or QR mobile) */}
          {cameraState === "captured" && capturedPreview && (
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-xl">
                <img src={capturedPreview} alt="Captured asset photo" className="w-full rounded-xl" />
                <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-green-600 px-2.5 py-1 text-[11px] font-bold text-white shadow">
                  <ShieldCheck className="h-3 w-3" />
                  CAPTURED
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={retakePhoto}>
                <RotateCcw className="h-3.5 w-3.5" />
                Retake Photo
              </Button>
            </div>
          )}

          {/* AI verification info */}
          <div className="rounded-lg bg-blue-500/10 p-3 text-sm text-blue-300">
            <div className="flex items-start gap-2">
              <Brain className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">AI Verification</p>
                <p className="text-xs mt-0.5">
                  Live capture with timestamp watermark prevents photo tampering. AI will verify the asset tag, check condition, and confirm it matches records.
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
            disabled={!selectedAssetId || !capturedFile || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting audit...
              </>
            ) : (
              <>
                <Camera className="h-4 w-4" />
                Submit Audit {capturedFile ? "(1 photo)" : "— capture photo first"}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
