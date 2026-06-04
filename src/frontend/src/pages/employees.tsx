import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search,
  Users,
  Laptop,
  MapPin,
  Building2,
  UserX,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { employeesApi } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Employee } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarBg(name: string): string {
  const palettes = [
    "bg-blue-500/20 text-blue-400",
    "bg-purple-500/20 text-purple-400",
    "bg-emerald-500/20 text-emerald-400",
    "bg-amber-500/20 text-amber-400",
    "bg-rose-500/20 text-rose-400",
    "bg-cyan-500/20 text-cyan-400",
    "bg-indigo-500/20 text-indigo-400",
    "bg-orange-500/20 text-orange-400",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palettes[Math.abs(hash) % palettes.length];
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonEmployeeCard() {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 animate-pulse rounded-full bg-[hsl(var(--secondary))]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/5 animate-pulse rounded bg-[hsl(var(--secondary))]" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-[hsl(var(--secondary))]" />
          <div className="flex gap-2 pt-1">
            <div className="h-5 w-20 animate-pulse rounded-full bg-[hsl(var(--secondary))]" />
            <div className="h-5 w-16 animate-pulse rounded-full bg-[hsl(var(--secondary))]" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Employee Card ────────────────────────────────────────────────────────────

function EmployeeCard({
  employee,
  onClick,
}: {
  employee: Employee;
  onClick: () => void;
}) {
  const avatarClass = getAvatarBg(employee.name);

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={onClick}
      className="group relative w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 text-left transition-shadow hover:border-[hsl(var(--primary))]/30 hover:shadow-lg"
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold ${avatarClass}`}
        >
          {getInitials(employee.name)}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          {/* Name + designation */}
          <p className="font-semibold text-[hsl(var(--foreground))] leading-tight">{employee.name}</p>
          {employee.designation && (
            <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">{employee.designation}</p>
          )}

          {/* Chips */}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {employee.department && (
              <span className="flex items-center gap-1 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-2 py-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                <Building2 className="h-3 w-3" />
                {employee.department}
              </span>
            )}
            {employee.location && (
              <span className="flex items-center gap-1 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-2 py-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                <MapPin className="h-3 w-3" />
                {employee.location}
              </span>
            )}
          </div>

          {/* ID + asset count row */}
          <div className="mt-3 flex items-center justify-between">
            <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
              {employee.employee_id}
            </span>
            <span
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                employee.asset_count > 0
                  ? "bg-blue-500/15 text-blue-400"
                  : "bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]"
              }`}
            >
              <Laptop className="h-3 w-3" />
              {employee.asset_count} asset{employee.asset_count !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (v: string) => {
    setSearch(v);
    if (searchTimer) clearTimeout(searchTimer);
    const t = setTimeout(() => {
      setDebouncedSearch(v);
      setPage(1);
    }, 300);
    setSearchTimer(t);
  };

  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.EMPLOYEES, debouncedSearch, departmentFilter, page],
    queryFn: () =>
      employeesApi
        .list({
          page,
          page_size: 18,
          search: debouncedSearch || undefined,
        })
        .then((r) => r.data),
  });

  // Separate stats query (no filter) for accurate totals
  const { data: statsData } = useQuery({
    queryKey: [...QUERY_KEYS.EMPLOYEES, "stats"],
    queryFn: () => employeesApi.list({ page_size: 100 }).then((r) => r.data),
  });

  const allEmployees = statsData?.items ?? [];

  // Derive departments from fetched employees
  const departments = useMemo(() => {
    const depts = new Set<string>();
    allEmployees.forEach((e) => {
      if (e.department) depts.add(e.department);
    });
    return Array.from(depts).sort();
  }, [allEmployees]);

  // Department-filtered employees (client-side, since the API doesn't support dept filter)
  const employees = useMemo(() => {
    let list = data?.items ?? [];
    if (departmentFilter !== "all") {
      list = list.filter((e) => e.department === departmentFilter);
    }
    return list;
  }, [data, departmentFilter]);

  const totalPages = data?.total_pages ?? 1;
  const totalEmployees = statsData?.total ?? 0;
  const totalDepartments = departments.length;
  const totalAssignedAssets = allEmployees.reduce((sum, e) => sum + e.asset_count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Employees</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          IT employees and their asset assignments
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Total Employees",
            value: totalEmployees,
            icon: Users,
            color: "text-[hsl(var(--primary))]",
            bg: "bg-[hsl(var(--primary))]/10",
          },
          {
            label: "Departments",
            value: totalDepartments,
            icon: Building2,
            color: "text-purple-400",
            bg: "bg-purple-500/10",
          },
          {
            label: "Assigned Assets",
            value: totalAssignedAssets,
            icon: Laptop,
            color: "text-blue-400",
            bg: "bg-blue-500/10",
          },
        ].map((s) => (
          <Card key={s.label} className="border-[hsl(var(--border))]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${s.bg}`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xl font-bold text-[hsl(var(--foreground))]">{s.value}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <Input
            placeholder="Search by name, ID, or email..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={departmentFilter}
          onValueChange={(v) => {
            setDepartmentFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Employee grid */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonEmployeeCard key={i} />
          ))}
        </div>
      ) : employees.length === 0 ? (
        <Card className="border-dashed border-[hsl(var(--border))]">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--secondary))]">
              <UserX className="h-8 w-8 text-[hsl(var(--muted-foreground))]/50" />
            </div>
            <div className="text-center">
              <p className="font-medium text-[hsl(var(--foreground))]">No employees found</p>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                {search || departmentFilter !== "all"
                  ? "Try adjusting your search or filter"
                  : "No active employees in the system"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {employees.map((emp) => (
              <EmployeeCard
                key={emp.id}
                employee={emp}
                onClick={() => navigate(`/employees/${emp.id}`)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-[hsl(var(--muted-foreground))]">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
