import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Loader2, UserCheck, UserX } from "lucide-react";
import {
  useGetAdminUsers,
  useCreateUser,
  useDeactivateUser,
  useActivateUser,
  useGetSystemHealth,
  useGetSystemStats,
  useGetSystemConfig,
  useUpdateSystemConfig,
} from "@/hooks/use-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, LOCATIONS } from "@/lib/constants";
import type { CreateUserRequest } from "@/types";

const userSchema = z.object({
  name: z.string().min(2, "Min 2 characters"),
  email: z.string().email("Valid email required"),
  employee_id: z.string().min(1, "Required"),
  role: z.string().min(1, "Required"),
  department: z.string().min(1, "Required"),
  location: z.string().min(1, "Required"),
  password: z.string().min(8, "Min 8 characters"),
});

type UserFormValues = z.infer<typeof userSchema>;

function AddUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createUser = useCreateUser();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<UserFormValues>({ resolver: zodResolver(userSchema) });

  async function onSubmit(data: UserFormValues) {
    try {
      await createUser.mutateAsync(data as CreateUserRequest);
      toast({ title: "User created successfully" });
      reset();
      onClose();
    } catch {
      toast({ title: "Failed to create user", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Full Name *</Label>
              <Input {...register("name")} />
              {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Employee ID *</Label>
              <Input placeholder="EMP001" {...register("employee_id")} />
              {errors.employee_id && <p className="text-xs text-red-400">{errors.employee_id.message}</p>}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Email *</Label>
            <Input type="email" {...register("email")} />
            {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Role *</Label>
              <Select onValueChange={(v) => setValue("role", v)}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.role && <p className="text-xs text-red-400">{errors.role.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Department *</Label>
              <Input placeholder="IT, HR, Finance..." {...register("department")} />
              {errors.department && <p className="text-xs text-red-400">{errors.department.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Location *</Label>
              <Select onValueChange={(v) => setValue("location", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.location && <p className="text-xs text-red-400">{errors.location.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Password *</Label>
              <Input type="password" {...register("password")} />
              {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UsersTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const deactivate = useDeactivateUser();
  const activate = useActivateUser();

  const { data, isLoading } = useGetAdminUsers({ page, search: search || undefined });
  const users = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-xs"
        />
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      <div className="rounded-lg border border-[hsl(var(--border))]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Employee ID</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-[hsl(var(--muted-foreground))]">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">{user.email}</div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{user.employee_id}</TableCell>
                  <TableCell>
                    <span className="rounded-full bg-[hsl(var(--primary))]/15 px-2 py-0.5 text-xs font-medium text-[hsl(var(--primary))]">
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{user.department}</TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      user.is_active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                    }`}>
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-[hsl(var(--muted-foreground))]">
                    {user.last_login ? formatRelativeTime(user.last_login) : "Never"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={user.is_active ? "text-red-400 hover:text-red-300" : "text-green-400 hover:text-green-300"}
                      disabled={deactivate.isPending || activate.isPending}
                      onClick={async () => {
                        try {
                          if (user.is_active) {
                            await deactivate.mutateAsync(user.id);
                            toast({ title: `${user.name} deactivated` });
                          } else {
                            await activate.mutateAsync(user.id);
                            toast({ title: `${user.name} activated` });
                          }
                        } catch {
                          toast({ title: "Operation failed", variant: "destructive" });
                        }
                      }}
                    >
                      {user.is_active ? (
                        <><UserX className="h-4 w-4" /> Deactivate</>
                      ) : (
                        <><UserCheck className="h-4 w-4" /> Activate</>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AddUserModal open={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
}

function SystemHealthTab() {
  const { data: health, isLoading } = useGetSystemHealth();
  const { data: stats } = useGetSystemStats();

  const statusDot = {
    healthy: "bg-green-500",
    degraded: "bg-yellow-500",
    down: "bg-red-500",
  };

  return (
    <div className="space-y-6">
      {/* Services */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-base">Service Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)
              : health?.services.map((svc) => (
                  <div key={svc.name} className="rounded-lg border border-[hsl(var(--border))] bg-slate-900/50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{svc.name}</span>
                      <span className={cn("h-2.5 w-2.5 rounded-full", statusDot[svc.status])} />
                    </div>
                    <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                      {svc.response_time_ms}ms · {svc.status}
                    </p>
                    {svc.message && (
                      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{svc.message}</p>
                    )}
                  </div>
                ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Users", value: stats?.total_users ?? 0 },
          { label: "Active Users", value: stats?.active_users ?? 0 },
          { label: "Total Stocks", value: stats?.total_stocks ?? "—" },
          { label: "Total Distributions", value: stats?.total_distributions ?? "—" },
        ].map(({ label, value }) => (
          <Card key={label} className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-4">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{label}</p>
              <p className="mt-1 text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottlenecks */}
      {(stats?.pending_over_48h?.length ?? 0) > 0 && (
        <Card className="bg-slate-800/50 border-red-500/20">
          <CardHeader>
            <CardTitle className="text-base text-red-400">Approval Bottlenecks (&gt;48h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats?.pending_over_48h?.map((item) => (
                <div key={item.transaction_code} className="flex items-center justify-between rounded-lg bg-red-500/5 px-3 py-2 text-sm">
                  <span className="font-medium">{item.transaction_code}</span>
                  <span className="text-[hsl(var(--muted-foreground))]">{item.stock_name}</span>
                  <span className="text-red-400">{item.hours_pending}h pending</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ConfigTab() {
  const { data: config, isLoading } = useGetSystemConfig();
  const updateConfig = useUpdateSystemConfig();

  const [form, setForm] = useState<Record<string, string | number>>({});

  function getVal(key: string, fallback: string | number) {
    return form[key] !== undefined ? form[key] : (config as Record<string, unknown>)?.[key] ?? fallback;
  }

  async function handleSave() {
    try {
      await updateConfig.mutateAsync(form as Parameters<typeof updateConfig.mutateAsync>[0]);
      toast({ title: "Configuration saved" });
      setForm({});
    } catch {
      toast({ title: "Failed to save configuration", variant: "destructive" });
    }
  }

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-base">Approval Thresholds</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>L2 Qty Threshold</Label>
              <Input
                type="number"
                value={String(getVal("l2_qty_threshold", 100))}
                onChange={(e) => setForm((f) => ({ ...f, l2_qty_threshold: Number(e.target.value) }))}
              />
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Distributions above this quantity require L2 approval
              </p>
            </div>
            <div className="space-y-1">
              <Label>Anomaly Sensitivity</Label>
              <Select
                value={String(getVal("anomaly_sensitivity", "Medium"))}
                onValueChange={(v) => setForm((f) => ({ ...f, anomaly_sensitivity: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-base">SLA Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>L1 SLA (hours)</Label>
              <Input
                type="number"
                value={String(getVal("l1_sla_hours", 24))}
                onChange={(e) => setForm((f) => ({ ...f, l1_sla_hours: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1">
              <Label>L2 SLA (hours)</Label>
              <Input
                type="number"
                value={String(getVal("l2_sla_hours", 48))}
                onChange={(e) => setForm((f) => ({ ...f, l2_sla_hours: Number(e.target.value) }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-base">Session Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 max-w-xs">
            <Label>Session Timeout (minutes)</Label>
            <Input
              type="number"
              value={String(getVal("session_timeout_minutes", 60))}
              onChange={(e) => setForm((f) => ({ ...f, session_timeout_minutes: Number(e.target.value) }))}
            />
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={handleSave}
        disabled={updateConfig.isPending || Object.keys(form).length === 0}
      >
        {updateConfig.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Save Changes
      </Button>
    </div>
  );
}

// ─── Catalog Tab ──────────────────────────────────────────────────────────────

function CatalogTab() {
  const statsQuery = useGetSystemStats();
  const configQuery = useGetSystemConfig();
  const categories = statsQuery.data ? (statsQuery.data as any).categories ?? [] : [];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <h3 className="text-sm font-semibold mb-4">Stock Categories</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {["Laptop","Desktop","Monitor","Mobile Phone","Peripherals","Networking","Server","Storage","Software License","Access Card","ID Card","Power Equipment","Cables","Other IT Equipment"].map((cat) => (
            <div key={cat} className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-xs text-[hsl(var(--foreground))]">
              <span className="h-2 w-2 rounded-full bg-[hsl(var(--primary))]" />
              {cat}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-[hsl(var(--muted-foreground))]">Categories are managed at the system level. Contact support to add new categories.</p>
      </div>
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <h3 className="text-sm font-semibold mb-4">Units of Measure</h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {["Pieces","Boxes","Kg","Liters","Meters","Sets","Packs","Units","Rolls","Sheets"].map((uom) => (
            <div key={uom} className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-center text-xs text-[hsl(var(--foreground))]">{uom}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── AI Policy Tab ────────────────────────────────────────────────────────────

function AIPolicyTab() {
  const configQuery = useGetSystemConfig();
  const updateConfig = useUpdateSystemConfig();

  const config = configQuery.data ?? {};
  const getVal = (k: string, d: unknown) => (config as any)[k] ?? d;

  const [sensitivity, setSensitivity] = useState<string>("");
  useEffect(() => { setSensitivity(String(getVal("anomaly_sensitivity", "Medium"))); }, [config]);

  async function handleSave() {
    await updateConfig.mutateAsync({ anomaly_sensitivity: sensitivity } as any);
    toast({ title: "AI policy updated" });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 space-y-5">
        <h3 className="text-sm font-semibold">Anomaly Detection Policy</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Sensitivity Level</Label>
            <Select value={sensitivity} onValueChange={setSensitivity}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">Low — fewer alerts</SelectItem>
                <SelectItem value="Medium">Medium — balanced</SelectItem>
                <SelectItem value="High">High — all anomalies</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button size="sm" onClick={handleSave} disabled={updateConfig.isPending}>
              {updateConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Policy"}
            </Button>
          </div>
        </div>
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/30 p-4 space-y-2">
          <p className="text-xs font-semibold text-[hsl(var(--foreground))]">AI Features Status</p>
          {[
            { label: "Anomaly Detection", status: "active" },
            { label: "Inventory Health Scoring", status: "active" },
            { label: "Natural Language Query", status: "active" },
            { label: "Auto-Classification on Upload", status: "active" },
            { label: "Risk Scoring for Approvals", status: "active" },
          ].map(({ label, status }) => (
            <div key={label} className="flex items-center justify-between text-xs">
              <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">{status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Workflow Tab ─────────────────────────────────────────────────────────────

function WorkflowTab() {
  const configQuery = useGetSystemConfig();
  const updateConfig = useUpdateSystemConfig();
  const config = configQuery.data ?? {};
  const getVal = (k: string, d: unknown) => (config as any)[k] ?? d;
  const [l2Threshold, setL2Threshold] = useState("");
  const [l1Sla, setL1Sla] = useState("");
  const [l2Sla, setL2Sla] = useState("");
  useEffect(() => {
    setL2Threshold(String(getVal("l2_qty_threshold", 100)));
    setL1Sla(String(getVal("l1_sla_hours", 24)));
    setL2Sla(String(getVal("l2_sla_hours", 48)));
  }, [config]);

  async function handleSave() {
    await updateConfig.mutateAsync({
      l2_qty_threshold: Number(l2Threshold),
      l1_sla_hours: Number(l1Sla),
      l2_sla_hours: Number(l2Sla),
    } as any);
    toast({ title: "Workflow rules updated" });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 space-y-5">
        <h3 className="text-sm font-semibold">Approval Routing Rules</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label className="text-xs">L2 Qty Threshold</Label>
            <Input className="mt-1" type="number" value={l2Threshold} onChange={(e) => setL2Threshold(e.target.value)} />
            <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">Distributions above this qty escalate to L2</p>
          </div>
          <div>
            <Label className="text-xs">L1 SLA (hours)</Label>
            <Input className="mt-1" type="number" value={l1Sla} onChange={(e) => setL1Sla(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">L2 SLA (hours)</Label>
            <Input className="mt-1" type="number" value={l2Sla} onChange={(e) => setL2Sla(e.target.value)} />
          </div>
        </div>
        <Button size="sm" onClick={handleSave} disabled={updateConfig.isPending}>
          {updateConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Rules"}
        </Button>
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <h3 className="text-sm font-semibold mb-4">Active Workflow Stages</h3>
        <div className="space-y-2">
          {[
            { stage: "Draft", desc: "Distribution created, not yet submitted", role: "Employee" },
            { stage: "L1 Review", desc: "Manager review and approval", role: "Manager" },
            { stage: "L2 Review", desc: "Triggered when qty exceeds threshold", role: "L2 Authority" },
            { stage: "Approved", desc: "Stock movement authorised and recorded", role: "System" },
            { stage: "Rejected", desc: "Returned to requester with remarks", role: "Manager / L2" },
          ].map(({ stage, desc, role }) => (
            <div key={stage} className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] px-4 py-2.5 text-xs">
              <div>
                <p className="font-medium text-[hsl(var(--foreground))]">{stage}</p>
                <p className="text-[hsl(var(--muted-foreground))]">{desc}</p>
              </div>
              <span className="rounded-full bg-[hsl(var(--primary))]/10 px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--primary))]">{role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Monitoring Tab ───────────────────────────────────────────────────────────

function MonitoringTab() {
  const healthQuery = useGetSystemHealth();
  const statsQuery = useGetSystemStats();

  const health = healthQuery.data;
  const stats = statsQuery.data;

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total Users",       value: stats.total_users },
            { label: "Total Stocks",      value: stats.total_stocks },
            { label: "Active Stocks",     value: (stats as any).active_stocks ?? "—" },
            { label: "Total Anomalies",   value: (stats as any).open_anomalies ?? "—" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-[hsl(var(--foreground))]">{value}</p>
            </div>
          ))}
        </div>
      )}
      {health && (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">System Services</h3>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", health.overall === "healthy" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400")}>
              {health.overall}
            </span>
          </div>
          <div className="space-y-2">
            {health.services?.map((svc: any) => (
              <div key={svc.name} className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] px-4 py-2.5 text-xs">
                <span className="text-[hsl(var(--foreground))]">{svc.name}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", svc.status === "healthy" || svc.status === "connected" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400")}>
                  {svc.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const VALID_TABS = ["users", "catalog", "system", "config", "policy", "workflow", "monitoring"] as const;
  type TabId = (typeof VALID_TABS)[number];
  const rawTab = searchParams.get("tab") ?? "users";
  const activeTab: TabId = (VALID_TABS as readonly string[]).includes(rawTab) ? (rawTab as TabId) : "users";

  function handleTabChange(tab: string) {
    setSearchParams({ tab });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Administration</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          System management and configuration
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="system">System Health</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="policy">AI Policy</TabsTrigger>
          <TabsTrigger value="workflow">Workflows</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <UsersTab />
        </TabsContent>

        <TabsContent value="catalog" className="mt-4">
          <CatalogTab />
        </TabsContent>

        <TabsContent value="system" className="mt-4">
          <SystemHealthTab />
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <ConfigTab />
        </TabsContent>

        <TabsContent value="policy" className="mt-4">
          <AIPolicyTab />
        </TabsContent>

        <TabsContent value="workflow" className="mt-4">
          <WorkflowTab />
        </TabsContent>

        <TabsContent value="monitoring" className="mt-4">
          <MonitoringTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
