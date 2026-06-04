import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Camera, RotateCcw, CheckCircle2, AlertCircle, Loader2, ShieldCheck } from "lucide-react";

type PageState = "idle" | "opening" | "active" | "capturing" | "uploading" | "done" | "error";

export default function MobileAuditPage() {
  const [params] = useSearchParams();
  const token = params.get("t") ?? params.get("token") ?? "";

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [state, setState] = useState<PageState>(token ? "idle" : "error");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [errorMsg, setErrorMsg] = useState(token ? "" : "Invalid or missing QR token. Please scan the QR code again.");

  // Attach stream to video element after state transitions to "active"
  useEffect(() => {
    if (state === "active" && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [state, stream]);

  // Stop stream on unmount
  useEffect(() => () => { stream?.getTracks().forEach((t) => t.stop()); }, [stream]);

  async function openCamera() {
    setState("opening");
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setStream(s);
      setState("active");
    } catch {
      setErrorMsg("Camera access denied. Please allow camera access and try again.");
      setState("error");
    }
  }

  function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    setState("capturing");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);

    // Timestamp watermark
    const stamp = `LIVE CAPTURE  ${new Date().toLocaleString("en-GB")}`;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, canvas.height - 38, canvas.width, 38);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px monospace";
    ctx.fillText(stamp, 12, canvas.height - 13);

    setPreview(canvas.toDataURL("image/jpeg", 0.92));
    canvas.toBlob((b) => { if (b) setBlob(b); }, "image/jpeg", 0.92);

    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  }

  function retake() {
    setPreview("");
    setBlob(null);
    setState("idle");
  }

  async function upload() {
    if (!blob || !token) return;
    setState("uploading");
    try {
      const fd = new FormData();
      fd.append("photo", blob, `audit-${Date.now()}.jpg`);
      const res = await fetch(`/api/v1/audit-mobile/${encodeURIComponent(token)}/photo`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { message?: string }).message ?? "Upload failed");
      }
      setState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Upload failed. Please try again.");
      setState("error");
    }
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[hsl(var(--border))]">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[hsl(var(--primary))]">
          <ShieldCheck className="h-4 w-4 text-[hsl(var(--primary-foreground))]" />
        </div>
        <span className="font-semibold text-sm tracking-wide">Mavericks Inventory — Asset Audit</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-5">
        <canvas ref={canvasRef} className="hidden" />

        {/* IDLE */}
        {state === "idle" && (
          <>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--primary))]/15">
              <Camera className="h-10 w-10 text-[hsl(var(--primary))]" />
            </div>
            <div className="text-center space-y-1">
              <h1 className="text-xl font-bold">Capture Asset Photo</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Point your camera at the asset tag/label and take a clear photo.
              </p>
            </div>
            <div className="w-full rounded-lg bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/25 p-3 text-center text-xs text-[hsl(var(--primary))]">
              <ShieldCheck className="inline-block h-3.5 w-3.5 mr-1" />
              Live capture only — prevents photo tampering
            </div>
            <button
              onClick={openCamera}
              className="w-full max-w-xs rounded-xl bg-[hsl(var(--primary))] py-4 text-base font-bold text-[hsl(var(--primary-foreground))] active:opacity-90 shadow-[0_6px_18px_-4px_hsl(var(--primary)_/_0.45)]"
            >
              Open Camera
            </button>
          </>
        )}

        {/* OPENING */}
        {state === "opening" && (
          <div className="flex flex-col items-center gap-4 text-[hsl(var(--muted-foreground))]">
            <Loader2 className="h-10 w-10 animate-spin text-[hsl(var(--primary))]" />
            <p className="text-sm">Starting camera…</p>
          </div>
        )}

        {/* ACTIVE */}
        {state === "active" && (
          <div className="w-full space-y-4">
            <div className="relative overflow-hidden rounded-2xl bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full"
                style={{ maxHeight: "60vh", objectFit: "cover" }}
              />
              {/* LIVE badge */}
              <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-[hsl(var(--destructive))] px-2.5 py-1 text-[11px] font-bold text-white shadow">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                LIVE
              </div>
              {/* Target guide */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="h-28 w-44 rounded-lg border-2 border-dashed border-white/40" />
              </div>
            </div>
            <p className="text-center text-xs text-[hsl(var(--muted-foreground))]">Aim at the asset tag, then tap Capture</p>
            <button
              onClick={capture}
              className="w-full rounded-xl bg-[hsl(var(--primary))] py-4 text-base font-bold text-[hsl(var(--primary-foreground))] active:opacity-90 shadow-[0_6px_18px_-4px_hsl(var(--primary)_/_0.45)]"
            >
              <Camera className="inline-block h-5 w-5 mr-2" />
              Capture Photo
            </button>
          </div>
        )}

        {/* CAPTURING (brief flash) */}
        {state === "capturing" && (
          <div className="w-full space-y-4">
            {preview && (
              <img src={preview} alt="Captured" className="w-full rounded-2xl" />
            )}
            <div className="flex items-center justify-center gap-2 text-[hsl(var(--muted-foreground))]">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Processing…</span>
            </div>
            {blob && (
              <button
                onClick={upload}
                className="w-full rounded-xl bg-[hsl(var(--primary))] py-4 text-base font-bold text-[hsl(var(--primary-foreground))] active:opacity-90 shadow-[0_6px_18px_-4px_hsl(var(--primary)_/_0.45)]"
              >
                Upload Photo
              </button>
            )}
            <button onClick={retake} className="w-full rounded-xl border border-[hsl(var(--border))] py-3 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]">
              <RotateCcw className="inline-block h-4 w-4 mr-1" />
              Retake
            </button>
          </div>
        )}

        {/* UPLOADING */}
        {state === "uploading" && (
          <div className="flex flex-col items-center gap-4 text-[hsl(var(--muted-foreground))]">
            {preview && <img src={preview} alt="Uploading" className="w-full rounded-2xl opacity-60" />}
            <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
            <p className="text-sm">Uploading to audit session…</p>
          </div>
        )}

        {/* DONE */}
        {state === "done" && (
          <>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--success))]/15">
              <CheckCircle2 className="h-10 w-10 text-[hsl(var(--success))]" />
            </div>
            {preview && <img src={preview} alt="Uploaded" className="w-full max-w-xs rounded-2xl" />}
            <div className="text-center space-y-1">
              <h1 className="text-xl font-bold text-[hsl(var(--success))]">Photo Uploaded!</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                The photo has been sent to the audit session. You can close this tab.
              </p>
            </div>
            <div className="w-full max-w-xs rounded-lg bg-[hsl(var(--success))]/10 border border-[hsl(var(--success))]/25 p-3 text-center text-xs text-[hsl(var(--success))]">
              Return to the desktop to complete and submit the audit.
            </div>
          </>
        )}

        {/* ERROR */}
        {state === "error" && (
          <>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--destructive))]/15">
              <AlertCircle className="h-10 w-10 text-[hsl(var(--destructive))]" />
            </div>
            <div className="text-center space-y-1">
              <h1 className="text-xl font-bold text-[hsl(var(--destructive))]">Error</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{errorMsg}</p>
            </div>
            {token && (
              <button
                onClick={() => { setErrorMsg(""); setState("idle"); }}
                className="w-full max-w-xs rounded-xl bg-[hsl(var(--primary))] py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]"
              >
                Try Again
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
