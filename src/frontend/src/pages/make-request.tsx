import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { ArrowLeft, Send, Loader2, CheckCircle2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { requestsApi } from "@/lib/api";
import { QUERY_KEYS, STOCK_CATEGORIES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  category: z.string().min(1, "Category is required"),
  sub_category: z.string().optional(),
  item_description: z.string().min(5, "Please describe what you need (min 5 characters)"),
  reason: z.string().min(10, "Please explain why you need this (min 10 characters)"),
  priority: z.enum(["low", "normal", "urgent", "critical"]).default("normal"),
});

type FormData = z.infer<typeof schema>;

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low — No urgency", color: "text-slate-400" },
  { value: "normal", label: "Normal — Standard request", color: "text-blue-400" },
  { value: "urgent", label: "Urgent — Needed within days", color: "text-amber-400" },
  { value: "critical", label: "Critical — Blocking work", color: "text-red-400" },
];

export default function MakeRequestPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submitted, setSubmitted] = useState(false);
  const [requestCode, setRequestCode] = useState("");

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: "normal" },
  });

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
                    {STOCK_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && <p className="text-xs text-red-400">{errors.category.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Sub-Category</Label>
                <Input placeholder="e.g., 15-inch, Wireless..." {...register("sub_category")} />
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
              <Label>Priority *</Label>
              <div className="grid grid-cols-2 gap-2">
                {PRIORITY_OPTIONS.map((opt) => {
                  const selected = watch("priority") === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setValue("priority", opt.value as FormData["priority"])}
                      className={`rounded-lg border px-3 py-2.5 text-left transition-all ${
                        selected
                          ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10"
                          : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/40"
                      }`}
                    >
                      <p className={`text-sm font-medium ${selected ? "text-[hsl(var(--primary))]" : opt.color}`}>
                        {opt.label.split(" — ")[0]}
                      </p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{opt.label.split(" — ")[1]}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg bg-[hsl(var(--secondary))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
              <strong className="text-[hsl(var(--foreground))]">What happens next?</strong>
              <ol className="mt-1 list-decimal pl-4 space-y-0.5">
                <li>Your IT manager receives a notification</li>
                <li>They review your request and approve or reject it</li>
                <li>If approved, they'll assign an available asset to you</li>
                <li>You'll get notified at each step</li>
              </ol>
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
