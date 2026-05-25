import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  dashboardApi,
  stocksApi,
  distributionsApi,
  approvalsApi,
  anomaliesApi,
  insightsApi,
  notificationsApi,
  adminApi,
  uploadApi,
  reportsApi,
  ledgerApi,
  auditApi,
} from "@/lib/api";
import { QUERY_KEYS } from "@/lib/constants";
import type {
  StockListParams,
  DistributionListParams,
  ApprovalListParams,
  AnomalyListParams,
  AuditListParams,
  CreateStockRequest,
  CreateDistributionRequest,
  CreateUserRequest,
} from "@/types";

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function useGetDashboardSummary() {
  return useQuery({
    queryKey: QUERY_KEYS.DASHBOARD_SUMMARY,
    queryFn: () => dashboardApi.getSummary().then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useGetDashboardActivity(limit = 20) {
  return useQuery({
    queryKey: [...QUERY_KEYS.DASHBOARD_ACTIVITY, limit],
    queryFn: () => dashboardApi.getActivity(limit).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useGetHealthScores() {
  return useQuery({
    queryKey: QUERY_KEYS.HEALTH_SCORES,
    queryFn: () => dashboardApi.getHealthScores().then((r) => r.data),
    staleTime: 60_000,
  });
}

// ─── Stocks ───────────────────────────────────────────────────────────────────

export function useListStocks(params?: StockListParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.STOCKS, params],
    queryFn: () => stocksApi.list(params).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useGetStock(
  id: string,
  options?: Partial<UseQueryOptions<ReturnType<typeof stocksApi.get> extends Promise<infer D> ? D : never>>
) {
  return useQuery({
    queryKey: [...QUERY_KEYS.STOCKS, id],
    queryFn: () => stocksApi.get(id).then((r) => r.data),
    enabled: !!id,
    ...options,
  });
}

export function useCreateStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStockRequest) => stocksApi.create(data).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.STOCKS });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD_SUMMARY });
    },
  });
}

export function useUpdateStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateStockRequest> }) =>
      stocksApi.update(id, data).then((r) => r.data),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.STOCKS });
      void qc.invalidateQueries({ queryKey: [...QUERY_KEYS.STOCKS, id] });
    },
  });
}

export function useDeleteStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => stocksApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.STOCKS });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD_SUMMARY });
    },
  });
}

// ─── Distributions ────────────────────────────────────────────────────────────

export function useListDistributions(params?: DistributionListParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.DISTRIBUTIONS, params],
    queryFn: () => distributionsApi.list(params).then((r) => r.data),
    staleTime: 20_000,
  });
}

export function useGetDistribution(id: string) {
  return useQuery({
    queryKey: [...QUERY_KEYS.DISTRIBUTIONS, id],
    queryFn: () => distributionsApi.get(id).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateDistribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDistributionRequest) =>
      distributionsApi.create(data).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.DISTRIBUTIONS });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD_SUMMARY });
    },
  });
}

export function useUpdateDistribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreateDistributionRequest>;
    }) => distributionsApi.update(id, data).then((r) => r.data),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.DISTRIBUTIONS });
      void qc.invalidateQueries({ queryKey: [...QUERY_KEYS.DISTRIBUTIONS, id] });
    },
  });
}

export function useDeleteDistribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => distributionsApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.DISTRIBUTIONS });
    },
  });
}

export function useSubmitDistribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => distributionsApi.submit(id).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.DISTRIBUTIONS });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.APPROVALS });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD_SUMMARY });
    },
  });
}

// ─── Approvals ────────────────────────────────────────────────────────────────

export function useListApprovals(params?: ApprovalListParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.APPROVALS, params],
    queryFn: () => approvalsApi.list(params).then((r) => r.data),
    staleTime: 20_000,
  });
}

export function useGetApproval(id: string) {
  return useQuery({
    queryKey: [...QUERY_KEYS.APPROVALS, id],
    queryFn: () => approvalsApi.get(id).then((r) => r.data),
    enabled: !!id,
  });
}

export function useApproveL1() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks?: string }) =>
      approvalsApi.approveL1(id, remarks).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.APPROVALS });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.DISTRIBUTIONS });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD_SUMMARY });
    },
  });
}

export function useRejectL1() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks: string }) =>
      approvalsApi.rejectL1(id, remarks).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.APPROVALS });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.DISTRIBUTIONS });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD_SUMMARY });
    },
  });
}

export function useApproveL2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks?: string }) =>
      approvalsApi.approveL2(id, remarks).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.APPROVALS });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.DISTRIBUTIONS });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD_SUMMARY });
    },
  });
}

export function useRejectL2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks: string }) =>
      approvalsApi.rejectL2(id, remarks).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.APPROVALS });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.DISTRIBUTIONS });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD_SUMMARY });
    },
  });
}

export function useBulkApprove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      approvalsApi.bulkApprove(ids).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.APPROVALS });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.DISTRIBUTIONS });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD_SUMMARY });
    },
  });
}

// ─── Anomalies ────────────────────────────────────────────────────────────────

export function useListAnomalies(params?: AnomalyListParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.ANOMALIES, params],
    queryFn: () => anomaliesApi.list(params).then((r) => r.data),
    staleTime: 20_000,
  });
}

export function useAcknowledgeAnomaly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => anomaliesApi.acknowledge(id).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.ANOMALIES });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD_SUMMARY });
    },
  });
}

export function useResolveAnomaly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      anomaliesApi.resolve(id, notes).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.ANOMALIES });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD_SUMMARY });
    },
  });
}

export function useDismissAnomaly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => anomaliesApi.dismiss(id).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.ANOMALIES });
    },
  });
}

// ─── AI Insights ─────────────────────────────────────────────────────────────

export function useGetInventoryHealth() {
  return useQuery({
    queryKey: QUERY_KEYS.INVENTORY_HEALTH,
    queryFn: () => insightsApi.getInventoryHealth().then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useNLQuery() {
  return useMutation({
    mutationFn: (query: string) =>
      insightsApi.nlQuery(query).then((r) => r.data),
  });
}

// ─── Notifications ────────────────────────────────────────────────────────────

export function useGetNotifications() {
  return useQuery({
    queryKey: QUERY_KEYS.NOTIFICATIONS,
    queryFn: () => notificationsApi.list().then((r) => r.data),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.NOTIFICATIONS });
    },
  });
}

// ─── Admin Users ─────────────────────────────────────────────────────────────

export function useGetAdminUsers(params?: { page?: number; search?: string }) {
  return useQuery({
    queryKey: [...QUERY_KEYS.ADMIN_USERS, params],
    queryFn: () => adminApi.listUsers(params).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserRequest) =>
      adminApi.createUser(data).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN_USERS });
    },
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deactivateUser(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN_USERS });
    },
  });
}

export function useActivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.activateUser(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN_USERS });
    },
  });
}

export function useGetSystemHealth() {
  return useQuery({
    queryKey: QUERY_KEYS.SYSTEM_HEALTH,
    queryFn: () => adminApi.getSystemHealth().then((r) => r.data),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useGetSystemStats() {
  return useQuery({
    queryKey: [...QUERY_KEYS.SYSTEM_HEALTH, "stats"],
    queryFn: () => adminApi.getSystemStats().then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useGetSystemConfig() {
  return useQuery({
    queryKey: [...QUERY_KEYS.SYSTEM_HEALTH, "config"],
    queryFn: () => adminApi.getConfig().then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useUpdateSystemConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof adminApi.updateConfig>[0]) =>
      adminApi.updateConfig(data).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.SYSTEM_HEALTH });
    },
  });
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export function useUploadStocks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      onProgress,
    }: {
      file: File;
      onProgress?: (pct: number) => void;
    }) => uploadApi.uploadStocks(file, onProgress).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.STOCKS });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.UPLOAD_JOBS });
    },
  });
}

export function useUploadDistributions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      onProgress,
    }: {
      file: File;
      onProgress?: (pct: number) => void;
    }) => uploadApi.uploadDistributions(file, onProgress).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.DISTRIBUTIONS });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.UPLOAD_JOBS });
    },
  });
}

export function useGetJobStatus(jobId: string | null) {
  return useQuery({
    queryKey: [...QUERY_KEYS.UPLOAD_JOBS, jobId],
    queryFn: () => uploadApi.getJobStatus(jobId!).then((r) => r.data),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === "completed" || data?.status === "failed") return false;
      return 2_000;
    },
  });
}

export function useGetJobHistory(type?: string) {
  return useQuery({
    queryKey: [...QUERY_KEYS.UPLOAD_JOBS, "history", type],
    queryFn: () => uploadApi.getJobHistory(type).then((r) => r.data),
    staleTime: 30_000,
  });
}

// ─── Ledger ───────────────────────────────────────────────────────────────────

export function useGetLedger(params?: {
  stock_id?: string;
  page?: number;
  page_size?: number;
}) {
  return useQuery({
    queryKey: [...QUERY_KEYS.LEDGER, params],
    queryFn: () => ledgerApi.list(params).then((r) => r.data),
    staleTime: 30_000,
  });
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export function useGetAuditLog(params?: AuditListParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.AUDIT_LOG, params],
    queryFn: () => auditApi.list(params).then((r) => r.data),
    staleTime: 30_000,
  });
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export function useGetReport(
  type: string,
  params?: Record<string, string>,
  enabled = true
) {
  return useQuery({
    queryKey: ["reports", type, params],
    queryFn: () => reportsApi.getReport(type, params).then((r) => r.data),
    enabled,
    staleTime: 30_000,
  });
}
