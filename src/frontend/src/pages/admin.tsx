import { useState } from "react";
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

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Administration</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          System management and configuration
        </p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="system">System Health</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <UsersTab />
        </TabsContent>

        <TabsContent value="system" className="mt-4">
          <SystemHealthTab />
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <ConfigTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
