import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL } from "./constants";

const TOKEN_KEY = "mavericks_token";
const USER_KEY = "mavericks_user";

export function getStoredToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token || token === "undefined" || token === "null") return null;
  return token;
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
  withCredentials: true,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getStoredToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function flushQueue(err: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => (err ? reject(err) : resolve(token!)));
  pendingQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Don't retry auth endpoints to avoid loops
    if (
      error.response?.status !== 401 ||
      original._retry ||
      original.url?.includes("/auth/")
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((token) => {
        if (original.headers) original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const { data } = await api.post<{ accessToken: string }>("/auth/refresh");
      const newToken = data.accessToken;
      setStoredToken(newToken);
      api.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
      flushQueue(null, newToken);
      if (original.headers) original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (refreshErr) {
      flushQueue(refreshErr, null);
      clearStoredAuth();
      window.location.replace("/login");
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;

// ─── Auth ───────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ accessToken: string; user: import("@/types").User }>("/auth/login", { email, password }),
  logout: () => api.post("/auth/logout"),
  me: () => api.get<import("@/types").User>("/auth/me"),
  changePassword: (oldPassword: string, newPassword: string) =>
    api.post<{ message: string }>("/auth/change-password", {
      old_password: oldPassword,
      new_password: newPassword,
    }),
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

// ─── Assets ───────────────────────────────────────────────────────────────────
export const assetsApi = {
  list: (params?: import("@/types").AssetListParams) =>
    api.get<import("@/types").PaginatedResponse<import("@/types").Asset>>("/assets", { params }),
  get: (id: string) => api.get<import("@/types").Asset>(`/assets/${id}`),
  create: (data: import("@/types").CreateAssetRequest) =>
    api.post<import("@/types").Asset>("/assets", data),
  update: (id: string, data: Partial<import("@/types").CreateAssetRequest>) =>
    api.put<import("@/types").Asset>(`/assets/${id}`, data),
  delete: (id: string) => api.delete(`/assets/${id}`),
  assign: (id: string, data: { employee_id: string; validity_date?: string; purpose?: string; notes?: string }) =>
    api.post(`/assets/${id}/assign`, data),
  return: (id: string, notes?: string) =>
    api.post(`/assets/${id}/return`, { notes }),
};

// ─── My Assets ────────────────────────────────────────────────────────────────
export const myAssetsApi = {
  list: () => api.get<{ items: import("@/types").MyAsset[]; total: number }>("/my-assets"),
  history: (params?: { page?: number; page_size?: number }) =>
    api.get<import("@/types").PaginatedResponse<import("@/types").MyAsset>>("/my-assets/history", { params }),
  audits: () => api.get<{ items: import("@/types").AssetAudit[] }>("/my-assets/audits"),
};

// ─── Asset Requests ───────────────────────────────────────────────────────────
export const requestsApi = {
  list: (params?: import("@/types").RequestListParams) =>
    api.get<import("@/types").PaginatedResponse<import("@/types").AssetRequest>>("/requests", { params }),
  create: (data: import("@/types").CreateItemRequest) =>
    api.post<{ id: string; request_code: string; status: string; message: string }>("/requests", data),
  approve: (id: string, notes?: string, asset_id?: string) =>
    api.post(`/requests/${id}/approve`, { review_notes: notes, asset_id }),
  reject: (id: string, notes: string) =>
    api.post(`/requests/${id}/reject`, { review_notes: notes }),
  fulfill: (id: string, asset_id: string, validity_date?: string, notes?: string) =>
    api.post(`/requests/${id}/fulfill`, { asset_id, validity_date, notes }),
};

// ─── Asset Audit ──────────────────────────────────────────────────────────────
export const assetAuditApi = {
  list: (params?: { page?: number; page_size?: number; needs_review?: boolean }) =>
    api.get<import("@/types").PaginatedResponse<import("@/types").AssetAudit>>("/asset-audit", { params }),
  submit: (asset_id: string, files: File[], audit_type?: string, notes?: string, onProgress?: (pct: number) => void) => {
    const form = new FormData();
    form.append("asset_id", asset_id);
    if (audit_type) form.append("audit_type", audit_type);
    if (notes) form.append("notes", notes);
    files.forEach((f) => form.append("media", f));
    return api.post<{ audit_id: string; audit_code: string; status: string; message: string }>(
      "/asset-audit/submit",
      form,
      {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
        },
      }
    );
  },
  humanReview: (id: string, final_status: string, review_notes?: string) =>
    api.post(`/asset-audit/${id}/human-review`, { final_status, review_notes }),
};

// ─── Employees ────────────────────────────────────────────────────────────────
export const employeesApi = {
  list: (params?: { page?: number; page_size?: number; search?: string; department?: string }) =>
    api.get<import("@/types").PaginatedResponse<import("@/types").Employee>>("/employees", { params }),
  getAssets: (employeeId: string) =>
    api.get<{ items: import("@/types").EmployeeAsset[]; total: number }>(`/employees/${employeeId}/assets`),
};

// ─── Reconciliation ───────────────────────────────────────────────────────────
export const reconciliationApi = {
  list: () =>
    api.get<{
      items: ReconciliationItem[];
      total: number;
      summary: { matched: number; variance: number; draft_adjustment: number; pending: number };
    }>("/reconciliation"),
  submitCount: (stock_id: string, physical_qty: number) =>
    api.post<{ ok: boolean; stock_id: string; physical_qty: number }>("/reconciliation/count", { stock_id, physical_qty }),
  reset: () => api.post<{ ok: boolean; message: string }>("/reconciliation/reset"),
};

export interface ReconciliationItem {
  id: string;
  stock_code: string;
  stock_name: string;
  category: string;
  location: string;
  system_qty: number;
  physical_qty: number | null;
  variance: number | null;
  status: "matched" | "variance" | "pending" | "draft_adjustment";
  last_counted: string | null;
  counted_by: string | null;
}

// ─── Config (categories / locations / UOM) ────────────────────────────────────
export const configApi = {
  getCategories: () => api.get<{ items: string[] }>("/config/categories"),
  getLocations: () => api.get<{ items: Array<{ name: string; type: string }> }>("/config/locations"),
  getUOM: () => api.get<{ items: string[] }>("/config/uom"),
  addCategory: (name: string) => api.post<{ items: string[] }>("/config/categories", { name }),
  deleteCategory: (name: string) => api.delete<{ items: string[] }>(`/config/categories/${encodeURIComponent(name)}`),
  addLocation: (name: string, location_type = "warehouse") => api.post<{ items: Array<{ name: string; type: string }> }>("/config/locations", { name, location_type }),
  deleteLocation: (name: string) => api.delete<{ items: Array<{ name: string; type: string }> }>(`/config/locations/${encodeURIComponent(name)}`),
  addUOM: (name: string, abbreviation?: string) => api.post<{ items: string[] }>("/config/uom", { name, abbreviation }),
  deleteUOM: (name: string) => api.delete<{ items: string[] }>(`/config/uom/${encodeURIComponent(name)}`),
  getNavVisibility: () => api.get<{ items: Record<string, string[]> }>("/config/nav-visibility"),
  updateNavVisibility: (role: string, hidden: string[]) =>
    api.put<{ items: Record<string, string[]> }>("/config/nav-visibility", { role, hidden }),
};

// ─── Legal Holds ──────────────────────────────────────────────────────────────
export const legalHoldsApi = {
  list: (params?: { status?: string; search?: string }) =>
    api.get<{
      items: LegalHoldItem[];
      total: number;
      active_count: number;
      total_locked: number;
    }>("/legal-holds", { params }),
  get: (id: string) => api.get<LegalHoldItem>(`/legal-holds/${id}`),
  create: (data: { title: string; scope: string; reason: string; case_number: string; records_locked?: number }) =>
    api.post<LegalHoldItem>("/legal-holds", data),
  release: (id: string) => api.post<LegalHoldItem>(`/legal-holds/${id}/release`),
};

export interface LegalHoldItem {
  id: number;
  hold_reference: string;
  title: string;
  scope: "transaction" | "stock_master" | "user_records";
  status: "active" | "released";
  records_locked: number;
  initiated_by: string;
  initiated_at: string;
  reason: string;
  case_number: string;
  released_at: string | null;
  released_by: string | null;
}

// ─── Audit Mobile Sessions ────────────────────────────────────────────────────
export const auditSessionApi = {
  createSession: (asset_id: string) =>
    api.post<{ token: string; expires_at: string }>("/asset-audit/sessions", { asset_id }),
  pollStatus: (token: string) =>
    api.get<{ status: "waiting" | "received"; photo_data_url?: string }>(`/asset-audit/sessions/${token}`),
  // Public upload — no auth interceptor needed; uses raw fetch on mobile page
};

export const API_BASE = API_BASE_URL;
