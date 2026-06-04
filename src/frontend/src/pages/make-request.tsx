import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { ArrowLeft, Send, Loader2, CheckCircle2, Sparkles, Brain, UserCheck, PackageCheck, BellRing, Wand2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { requestsApi } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/constants";
import { useCategories } from "@/hooks/use-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const SUBCATEGORY_MAP: Record<string, string[]> = {
  "Laptop": ["13-inch / Ultrabook", "14-inch / Business", "15-inch / Productivity", "16-inch / Performance", "2-in-1 Convertible", "Gaming Laptop", "Workstation Laptop"],
  "Desktop": ["Mini PC / Compact", "Tower PC / Standard", "All-in-One", "Workstation / High-End", "Gaming Desktop"],
  "Monitor": ["24-inch FHD", "27-inch QHD", "32-inch 4K", "Ultrawide 34-inch+", "Curved Display", "Portable Monitor"],
  "Mobile Phone": ["iOS / iPhone", "Android / Samsung", "Android / Other", "Rugged / Field Device"],
  "Peripherals": ["Keyboard / Input Device", "Mouse / Trackpad", "Webcam / Video", "Headset / Audio", "USB Hub / Docking Station", "External Drive / Storage"],
  "Networking": ["Network Switch", "Wireless Router / AP", "Firewall / Security Appliance", "Ethernet Cables / Patch", "SFP / Transceiver Module"],
  "Server": ["Rack Mount Server", "Tower Server", "Blade Server", "Micro / Edge Server"],
  "Storage": ["SSD / Solid State Drive", "HDD / Hard Drive", "NAS / Network Attached", "USB Flash Drive", "Memory Card / SD"],
  "Software License": ["Microsoft 365 / Office", "Adobe Creative Suite", "Antivirus / Security", "ERP / SAP", "VPN / Remote Access", "CAD / Design Software", "Project Management"],
  "Access Card": ["Employee Access Badge", "Visitor Pass", "RFID Proximity Card"],
  "ID Card": ["Standard Employee ID", "Smart Card with Chip", "Biometric Card"],
  "Power Equipment": ["UPS / Battery Backup", "Surge Protector / Strip", "Voltage Regulator", "PDU / Power Distribution"],
  "Cables": ["USB-C / Thunderbolt", "HDMI / DisplayPort", "Ethernet / RJ45", "Power / IEC Cable"],
  "Other IT Equipment": ["Projector / Display", "Barcode / RFID Scanner", "Label Printer", "Document Scanner"],
};

const schema = z.object({
  category: z.string().min(1, "Category is required"),
  sub_category: z.string().optional(),
  item_description: z.string().min(5, "Please describe what you need (min 5 characters)"),
  reason: z.string().min(10, "Please explain why you need this (min 10 characters)"),
  priority: z.enum(["low", "normal", "urgent", "critical"]).default("normal"),
});

type FormData = z.infer<typeof schema>;

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low — No urgency", color: "text-[hsl(var(--muted-foreground))]" },
  { value: "normal", label: "Normal — Standard request", color: "text-blue-400" },
  { value: "urgent", label: "Urgent — Needed within days", color: "text-amber-400" },
  { value: "critical", label: "Critical — Blocking work", color: "text-red-400" },
];

type PriorityValue = "low" | "normal" | "urgent" | "critical";

// People who handle the request — shown in the "What happens next?" box so the
// requester knows exactly who reviews and who fulfils.
const WORKFLOW_CONTACTS = {
  approver: { name: "Lakshmi", role: "IT Manager (L1 Approver)" },
  fulfiller: { name: "Prabakar", role: "Inventory Specialist" },
};

// ─── Client-side AI priority classifier ────────────────────────────────────────
// Lightweight, offline keyword/intent analysis. Mirrors the app's existing
// client-side "AI" subcategory feature — no backend round-trip.
const PRIORITY_SIGNALS: { priority: PriorityValue; weight: number; terms: string[] }[] = [
  {
    priority: "critical",
    weight: 3,
    terms: [
      "blocked", "blocker", "cannot work", "can't work", "cant work", "unable to work",
      "down", "outage", "broken", "not working", "stopped working", "crash", "crashed",
      "data loss", "security", "breach", "production", "prod issue", "asap", "immediately",
      "right now", "today", "emergency", "critical",
    ],
  },
  {
    priority: "urgent",
    weight: 2,
    terms: [
      "urgent", "soon", "this week", "by friday", "by monday", "deadline", "client",
      "customer", "presentation", "demo", "travel", "trip", "onboarding", "new joiner",
      "new hire", "joining", "replacement", "replace", "failing", "slow", "lagging",
      "tomorrow", "few days", "couple of days",
    ],
  },
  {
    priority: "low",
    weight: 1,
    terms: [
      "whenever", "no rush", "not urgent", "nice to have", "eventually", "future",
      "backup", "spare", "optional", "when possible", "low priority", "someday",
      "down the line", "if available",
    ],
  },
];

function suggestPriority(text: string): {
  priority: PriorityValue;
  matched: string[];
  reason: string;
} {
  const lower = ` ${text.toLowerCase()} `;
  const matchedBy: Record<PriorityValue, string[]> = {
    critical: [], urgent: [], normal: [], low: [],
  };
  for (const sig of PRIORITY_SIGNALS) {
    for (const term of sig.terms) {
      if (lower.includes(` ${term} `) || lower.includes(`${term}`)) {
        if (lower.includes(term)) matchedBy[sig.priority].push(term);
      }
    }
  }
  // Highest-severity signal wins.
  let priority: PriorityValue = "normal";
  let matched: string[] = [];
  if (matchedBy.critical.length) { priority = "critical"; matched = matchedBy.critical; }
  else if (matchedBy.urgent.length) { priority = "urgent"; matched = matchedBy.urgent; }
  else if (matchedBy.low.length) { priority = "low"; matched = matchedBy.low; }

  const reasonMap: Record<PriorityValue, string> = {
    critical: "Your justification signals work is blocked or business-critical, so this should be expedited.",
    urgent: "Your justification mentions a near-term need or deadline, so a few-day turnaround is recommended.",
    low: "Your justification suggests this isn't time-sensitive, so it can be scheduled flexibly.",
    normal: "No urgency signals detected — a standard review timeline applies.",
  };

  return {
    priority,
    matched: [...new Set(matched)].slice(0, 4),
    reason: reasonMap[priority],
  };
}

export default function MakeRequestPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submitted, setSubmitted] = useState(false);
  const { data: categoriesData } = useCategories();
  const categories = categoriesData ?? [];
  const [requestCode, setRequestCode] = useState("");

  const [subCategoryOptions, setSubCategoryOptions] = useState<string[]>([]);
  const [loadingSubCat, setLoadingSubCat] = useState(false);
  const [customSubCat, setCustomSubCat] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: "normal" },
  });

  const selectedCategory = watch("category");
  const reasonText = watch("reason") ?? "";

  // ── AI priority suggestion (client-side heuristic) ──
  const [aiSuggestion, setAiSuggestion] = useState<ReturnType<typeof suggestPriority> | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [priorityTouched, setPriorityTouched] = useState(false);

  useEffect(() => {
    if (!reasonText || reasonText.trim().length < 12) {
      setAiSuggestion(null);
      setAiThinking(false);
      return;
    }
    setAiThinking(true);
    const t = setTimeout(() => {
      const s = suggestPriority(reasonText);
      setAiSuggestion(s);
      setAiThinking(false);
      // Auto-apply only while the user hasn't manually chosen a priority.
      if (!priorityTouched) setValue("priority", s.priority);
    }, 600);
    return () => clearTimeout(t);
  }, [reasonText, priorityTouched, setValue]);

  useEffect(() => {
    if (!selectedCategory) {
      setSubCategoryOptions([]);
      setCustomSubCat(false);
      return;
    }
    setLoadingSubCat(true);
    setCustomSubCat(false);
    setValue("sub_category", "");
    const timer = setTimeout(() => {
      setSubCategoryOptions(SUBCATEGORY_MAP[selectedCategory] ?? []);
      setLoadingSubCat(false);
    }, 650);
    return () => clearTimeout(timer);
  }, [selectedCategory]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => requestsApi.create(data).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.REQUESTS });
      setRequestCode(data.request_code);
      setSubmitted(true);
    },
    onError: () => {
      toast({ title: "Failed to submit request", description: "Please try again.", variant: "destructive" });
    },
  });

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/15"
        >
          <CheckCircle2 className="h-10 w-10 text-green-400" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h2 className="text-2xl font-bold text-[hsl(var(--foreground))]">Request Submitted!</h2>
          <p className="mt-2 text-[hsl(var(--muted-foreground))]">
            Your request <span className="font-mono font-semibold text-[hsl(var(--primary))]">{requestCode}</span> has been submitted.
          </p>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Your IT manager will review and respond soon. You'll receive a notification when it's approved or fulfilled.
          </p>
        </motion.div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate("/my-requests")}>View My Requests</Button>
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
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Raise a Request</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Request new IT equipment or software</p>
        </div>
      </div>

      <Card className="border-[hsl(var(--border))]">
        <CardHeader>
          <CardTitle>Request Details</CardTitle>
          <CardDescription>
            Provide details about what you need and why. Your manager will review and approve or fulfill the request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select onValueChange={(v) => setValue("category", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && <p className="text-xs text-red-400">{errors.category.message}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label>Sub-Category</Label>
                  {(loadingSubCat || subCategoryOptions.length > 0) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--primary))]/10 px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--primary))]">
                      <Sparkles className="h-2.5 w-2.5" />
                      AI
                    </span>
                  )}
                </div>
                {loadingSubCat ? (
                  <div className="flex h-9 items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/40 px-3 text-xs text-[hsl(var(--muted-foreground))]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[hsl(var(--primary))]" />
                    AI is suggesting subcategories…
                  </div>
                ) : subCategoryOptions.length > 0 && !customSubCat ? (
                  <Select
                    onValueChange={(v) => {
                      if (v === "__custom__") { setCustomSubCat(true); setValue("sub_category", ""); }
                      else setValue("sub_category", v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a subcategory…" />
                    </SelectTrigger>
                    <SelectContent>
                      {subCategoryOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                      <SelectItem value="__custom__">Other — type my own…</SelectItem>
                    </SelectContent>
                  </Select>
                ) : customSubCat ? (
                  <div className="flex gap-2">
                    <Input placeholder="Type your subcategory…" {...register("sub_category")} autoFocus />
                    <button type="button" onClick={() => setCustomSubCat(false)} className="shrink-0 text-xs text-[hsl(var(--primary))] hover:underline">
                      ← Suggestions
                    </button>
                  </div>
                ) : (
                  <Input placeholder="e.g., 15-inch, Wireless…" {...register("sub_category")} />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>What do you need? *</Label>
              <Input
                placeholder="e.g., Dell Latitude 14 Laptop, Microsoft Office License, USB-C Hub..."
                {...register("item_description")}
              />
              {errors.item_description && <p className="text-xs text-red-400">{errors.item_description.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Why do you need this? *</Label>
              <Textarea
                placeholder="Explain your use case and business justification..."
                rows={4}
                {...register("reason")}
              />
              {errors.reason && <p className="text-xs text-red-400">{errors.reason.message}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label>Priority *</Label>
                <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--primary))]/10 px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--primary))]">
                  <Sparkles className="h-2.5 w-2.5" />
                  AI-assisted
                </span>
              </div>

              {/* AI priority suggestion banner */}
              {aiThinking ? (
                <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/40 px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[hsl(var(--primary))]" />
                  AI is analysing your justification to suggest a priority…
                </div>
              ) : aiSuggestion ? (
                <div className="rounded-lg border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/5 px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <Brain className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[hsl(var(--foreground))]">
                        AI suggests{" "}
                        <span className="font-semibold text-[hsl(var(--primary))]">
                          {PRIORITY_OPTIONS.find((o) => o.value === aiSuggestion.priority)?.label.split(" — ")[0]}
                        </span>
                        {watch("priority") === aiSuggestion.priority && (
                          <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-[hsl(var(--primary))]">
                            <CheckCircle2 className="h-2.5 w-2.5" /> applied
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{aiSuggestion.reason}</p>
                      {aiSuggestion.matched.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {aiSuggestion.matched.map((m) => (
                            <span key={m} className="rounded-full bg-[hsl(var(--primary))]/10 px-1.5 py-0.5 text-[10px] text-[hsl(var(--primary))]">
                              “{m}”
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {watch("priority") !== aiSuggestion.priority && (
                      <button
                        type="button"
                        onClick={() => { setValue("priority", aiSuggestion.priority); setPriorityTouched(true); }}
                        className="shrink-0 inline-flex items-center gap-1 rounded-md border border-[hsl(var(--primary))]/40 px-2 py-1 text-[11px] font-medium text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10 transition-colors"
                      >
                        <Wand2 className="h-3 w-3" />
                        Apply
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Describe your reason above and AI will suggest a priority — you can always change it.
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                {PRIORITY_OPTIONS.map((opt) => {
                  const selected = watch("priority") === opt.value;
                  const isAiPick = aiSuggestion?.priority === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setValue("priority", opt.value as FormData["priority"]); setPriorityTouched(true); }}
                      className={`relative rounded-lg border px-3 py-2.5 text-left transition-all ${
                        selected
                          ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10"
                          : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/40"
                      }`}
                    >
                      {isAiPick && !selected && (
                        <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-[hsl(var(--primary))]/10 px-1 py-0.5 text-[9px] font-medium text-[hsl(var(--primary))]">
                          <Sparkles className="h-2 w-2" /> AI
                        </span>
                      )}
                      <p className={`text-sm font-medium ${selected ? "text-[hsl(var(--primary))]" : opt.color}`}>
                        {opt.label.split(" — ")[0]}
                      </p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{opt.label.split(" — ")[1]}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/60 p-4">
              <strong className="text-sm text-[hsl(var(--foreground))]">What happens next?</strong>
              <div className="mt-3 space-y-3">
                {/* Step 1 — approval */}
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]">
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-[hsl(var(--foreground))]">
                      <span className="font-semibold">{WORKFLOW_CONTACTS.approver.name}</span>{" "}
                      <span className="text-[hsl(var(--muted-foreground))]">— {WORKFLOW_CONTACTS.approver.role}</span>{" "}
                      reviews and approves your request.
                    </p>
                  </div>
                </div>
                {/* Step 2 — fulfilment */}
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--info))]/15 text-[hsl(var(--info))]">
                    <PackageCheck className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-[hsl(var(--foreground))]">
                      <span className="font-semibold">{WORKFLOW_CONTACTS.fulfiller.name}</span>{" "}
                      <span className="text-[hsl(var(--muted-foreground))]">— {WORKFLOW_CONTACTS.fulfiller.role}</span>{" "}
                      assigns an available asset to you from inventory.
                    </p>
                  </div>
                </div>
                {/* Step 3 — notifications */}
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]">
                    <BellRing className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-[hsl(var(--foreground))]">
                      You'll get a notification at each step — on approval and again when your asset is handed over.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full gap-2" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit Request
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
