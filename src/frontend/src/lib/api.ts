import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL } from "./constants";

const TOKEN_KEY = "mavericks_token";
const USER_KEY = "mavericks_user";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getStoredToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearStoredAuth();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;

// ─── Auth ───────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ access_token: string; user: import("@/types").User }>("/auth/login", { email, password }),
  logout: () => api.post("/auth/logout"),
  me: () => api.get<import("@/types").User>("/auth/me"),
};

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const dashboardApi = {
  getSummary: () => api.get<import("@/types").DashboardSummary>("/dashboard/summary"),
  getActivity: (limit = 20) => api.get<import("@/types").Activity[]>(`/dashboard/activity?limit=${limit}`),
  getHealthScores: () => api.get<import("@/types").HealthScore[]>("/dashboard/health-scores"),
};

// ─── Stocks ───────────────────────────────────────────────────────────────────
export const stocksApi = {
  list: (params?: import("@/types").StockListParams) =>
    api.get<import("@/types").PaginatedResponse<import("@/types").Stock>>("/stocks", { params }),
  get: (id: string) => api.get<import("@/types").Stock>(`/stocks/${id}`),
  create: (data: import("@/types").CreateStockRequest) =>
    api.post<import("@/types").Stock>("/stocks", data),
  update: (id: string, data: Partial<import("@/types").CreateStockRequest>) =>
    api.put<import("@/types").Stock>(`/stocks/${id}`, data),
  delete: (id: string) => api.delete(`/stocks/${id}`),
  exportCsv: () => api.get("/stocks/export", { responseType: "blob" }),
};

// ─── Distributions ────────────────────────────────────────────────────────────
export const distributionsApi = {
  list: (params?: import("@/types").DistributionListParams) =>
    api.get<import("@/types").PaginatedResponse<import("@/types").Distribution>>("/distributions", { params }),
  get: (id: string) => api.get<import("@/types").Distribution>(`/distributions/${id}`),
  create: (data: import("@/types").CreateDistributionRequest) =>
    api.post<import("@/types").Distribution>("/distributions", data),
  update: (id: string, data: Partial<import("@/types").CreateDistributionRequest>) =>
    api.put<import("@/types").Distribution>(`/distributions/${id}`, data),
  delete: (id: string) => api.delete(`/distributions/${id}`),
  submit: (id: string) => api.post<import("@/types").Distribution>(`/distributions/${id}/submit`),
};

// ─── Approvals ────────────────────────────────────────────────────────────────
export const approvalsApi = {
  list: (params?: import("@/types").ApprovalListParams) =>
    api.get<import("@/types").PaginatedResponse<import("@/types").Approval>>("/approvals", { params }),
  get: (id: string) => api.get<import("@/types").Approval>(`/approvals/${id}`),
  approveL1: (id: string, remarks?: string) =>
    api.post<import("@/types").Approval>(`/approvals/${id}/l1-approve`, { remarks }),
  rejectL1: (id: string, remarks: string) =>
    api.post<import("@/types").Approval>(`/approvals/${id}/l1-reject`, { remarks }),
  approveL2: (id: string, remarks?: string) =>
    api.post<import("@/types").Approval>(`/approvals/${id}/l2-approve`, { remarks }),
  rejectL2: (id: string, remarks: string) =>
    api.post<import("@/types").Approval>(`/approvals/${id}/l2-reject`, { remarks }),
  bulkApprove: (ids: string[]) =>
    api.post<{ approved: number; failed: number }>("/approvals/bulk-approve", { ids }),
};

// ─── Anomalies ────────────────────────────────────────────────────────────────
export const anomaliesApi = {
  list: (params?: import("@/types").AnomalyListParams) =>
    api.get<import("@/types").PaginatedResponse<import("@/types").Anomaly>>("/anomalies", { params }),
  acknowledge: (id: string) =>
    api.post<import("@/types").Anomaly>(`/anomalies/${id}/acknowledge`),
  resolve: (id: string, notes: string) =>
    api.post<import("@/types").Anomaly>(`/anomalies/${id}/resolve`, { notes }),
  dismiss: (id: string) =>
    api.post<import("@/types").Anomaly>(`/anomalies/${id}/dismiss`),
};

// ─── AI Insights ─────────────────────────────────────────────────────────────
export const insightsApi = {
  getInventoryHealth: () =>
    api.get<import("@/types").InventoryInsight>("/insights/inventory-health"),
  nlQuery: (query: string) =>
    api.post<import("@/types").InsightQueryResponse>("/insights/query", { query }),
};

// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationsApi = {
  list: () => api.get<import("@/types").Notification[]>("/notifications"),
  markAllRead: () => api.post("/notifications/mark-all-read"),
};

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  listUsers: (params?: { page?: number; search?: string }) =>
    api.get<import("@/types").PaginatedResponse<import("@/types").User>>("/admin/users", { params }),
  createUser: (data: import("@/types").CreateUserRequest) =>
    api.post<import("@/types").User>("/admin/users", data),
  deactivateUser: (id: string) => api.post(`/admin/users/${id}/deactivate`),
  activateUser: (id: string) => api.post(`/admin/users/${id}/activate`),
  getSystemHealth: () =>
    api.get<import("@/types").SystemHealth>("/admin/system-health"),
  getSystemStats: () =>
    api.get<import("@/types").SystemStats>("/admin/system-stats"),
  getConfig: () => api.get<import("@/types").SystemConfig>("/admin/config"),
  updateConfig: (data: Partial<import("@/types").SystemConfig>) =>
    api.put<import("@/types").SystemConfig>("/admin/config", data),
};

// ─── Upload ───────────────────────────────────────────────────────────────────
export const uploadApi = {
  uploadStocks: (file: File, onProgress?: (pct: number) => void) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<import("@/types").UploadJob>("/upload/stocks", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
      },
    });
  },
  uploadDistributions: (file: File, onProgress?: (pct: number) => void) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<import("@/types").UploadJob>("/upload/distributions", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
      },
    });
  },
  getJobStatus: (jobId: string) =>
    api.get<import("@/types").UploadJob>(`/upload/jobs/${jobId}`),
  getJobHistory: (type?: string) =>
    api.get<import("@/types").UploadJob[]>("/upload/jobs", { params: { type } }),
  downloadTemplate: (type: "stocks" | "distributions") =>
    api.get(`/upload/templates/${type}`, { responseType: "blob" }),
};

// ─── Reports ──────────────────────────────────────────────────────────────────
export const reportsApi = {
  getReport: (type: string, params?: Record<string, string>) =>
    api.get<import("@/types").ReportData>(`/reports/${type}`, { params }),
  exportExcel: (type: string, params?: Record<string, string>) =>
    api.get(`/reports/${type}/export/excel`, { params, responseType: "blob" }),
  exportPdf: (type: string, params?: Record<string, string>) =>
    api.get(`/reports/${type}/export/pdf`, { params, responseType: "blob" }),
};

// ─── Ledger ───────────────────────────────────────────────────────────────────
export const ledgerApi = {
  list: (params?: { stock_id?: string; page?: number; page_size?: number }) =>
    api.get<import("@/types").PaginatedResponse<import("@/types").LedgerEntry>>("/ledger", { params }),
};

// ─── Audit Log ────────────────────────────────────────────────────────────────
export const auditApi = {
  list: (params?: import("@/types").AuditListParams) =>
    api.get<import("@/types").PaginatedResponse<import("@/types").AuditEntry>>("/audit-log", { params }),
};
