// ─── Core Entities ────────────────────────────────────────────────────────────

export interface User {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  location: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

export interface Stock {
  id: string;
  stock_code: string;
  name: string;
  category: string;
  uom: string;
  total_qty: number;
  available_qty: number;
  distributed_qty: number;
  min_level: number;
  max_level: number;
  location: string;
  status: "active" | "inactive" | "draft";
  health_score: number;
  health_status: "healthy" | "warning" | "critical";
  last_updated: string;
  created_at: string;
  created_by: string;
}

export interface Distribution {
  id: string;
  transaction_code: string;
  stock_id: string;
  stock_code: string;
  stock_name: string;
  stock_category: string;
  qty_requested: number;
  qty_approved: number | null;
  uom: string;
  recipient_type: "employee" | "project";
  recipient_id: string;
  recipient_name: string;
  distribution_date: string;
  location: string;
  purpose: string;
  status: string;
  risk_score: number;
  risk_level: "Low" | "Medium" | "High";
  ai_recommendation: "Approve" | "Review" | "Reject";
  ai_reasoning: string;
  submitted_at: string | null;
  created_at: string;
  created_by: string;
  created_by_name: string;
  approval_history: ApprovalEvent[];
}

export interface ApprovalEvent {
  action: string;
  actor_name: string;
  actor_role: string;
  timestamp: string;
  remarks: string | null;
}

export interface Approval {
  id: string;
  distribution_id: string;
  transaction_code: string;
  stock_name: string;
  stock_code: string;
  qty_requested: number;
  uom: string;
  recipient_name: string;
  recipient_type: string;
  purpose: string;
  location: string;
  distribution_date: string;
  status: string;
  risk_score: number;
  risk_level: "Low" | "Medium" | "High";
  ai_recommendation: "Approve" | "Review" | "Reject";
  ai_reasoning: string;
  submitted_at: string;
  days_pending: number;
  l1_approved_by: string | null;
  l1_approved_at: string | null;
  l1_remarks: string | null;
  l2_approved_by: string | null;
  l2_approved_at: string | null;
  l2_remarks: string | null;
  created_by_name: string;
}

export interface Anomaly {
  id: string;
  stock_id: string;
  stock_code: string;
  stock_name: string;
  anomaly_type: string;
  severity: "critical" | "warning" | "info";
  description: string;
  ai_explanation: string;
  recommended_action: string;
  detected_at: string;
  status: "active" | "acknowledged" | "resolved" | "dismissed";
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
}

export interface LedgerEntry {
  id: string;
  stock_id: string;
  stock_code: string;
  stock_name: string;
  transaction_type: "in" | "out" | "adjustment";
  qty_change: number;
  qty_before: number;
  qty_after: number;
  distribution_id: string | null;
  transaction_code: string | null;
  actor_name: string;
  remarks: string;
  created_at: string;
}

export interface Activity {
  id: string;
  event_type: string;
  description: string;
  actor_name: string;
  actor_role: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  created_at: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  event_type: string;
  description: string;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  ip_address: string | null;
  created_at: string;
}

// ─── Upload ────────────────────────────────────────────────────────────────────

export interface UploadJob {
  id: string;
  job_type: "stocks" | "distributions";
  filename: string;
  status: "queued" | "processing" | "completed" | "failed";
  total_rows: number;
  saved_rows: number;
  corrected_rows: number;
  failed_rows: number;
  corrections: CorrectionDetail[];
  errors: ErrorDetail[];
  uploaded_by: string;
  uploaded_at: string;
  completed_at: string | null;
}

export interface CorrectionDetail {
  row: number;
  field: string;
  original_value: string;
  corrected_value: string;
  reason: string;
}

export interface ErrorDetail {
  row: number;
  field: string;
  error: string;
  value: string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardSummary {
  total_stocks: number;
  total_distributions: number;
  pending_approvals: number;
  active_anomalies: number;
  critical_anomalies: number;
  my_distributions: number;
  my_pending: number;
  my_approved: number;
  my_rejected: number;
  approval_velocity_hours: number;
  stock_health_summary: {
    healthy: number;
    warning: number;
    critical: number;
  };
  distribution_by_status: {
    status: string;
    count: number;
  }[];
  top_distributed_items: {
    stock_name: string;
    total_qty: number;
  }[];
  transaction_trend: {
    date: string;
    count: number;
  }[];
}

export interface HealthScore {
  stock_id: string;
  stock_code: string;
  stock_name: string;
  health_score: number;
  health_status: "healthy" | "warning" | "critical";
  available_qty: number;
  min_level: number;
}

// ─── AI Insights ─────────────────────────────────────────────────────────────

export interface InventoryInsight {
  summary: string;
  observations: string[];
  recommended_actions: string[];
  last_refreshed: string;
  health_score: number;
}

export interface InsightQueryResponse {
  query: string;
  answer: string;
  data: Record<string, unknown>[];
  columns: string[];
  confidence: number;
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface SystemHealth {
  services: ServiceStatus[];
  overall: "healthy" | "degraded" | "down";
  checked_at: string;
}

export interface ServiceStatus {
  name: string;
  status: "healthy" | "degraded" | "down";
  response_time_ms: number;
  message: string;
}

export interface SystemStats {
  total_users: number;
  active_users: number;
  logins_today: number;
  total_stocks: number;
  total_distributions: number;
  total_anomalies: number;
  pending_approvals: number;
  pending_over_48h: ApprovalBottleneck[];
  top_distributed: {
    stock_name: string;
    total_qty: number;
  }[];
}

export interface ApprovalBottleneck {
  transaction_code: string;
  stock_name: string;
  hours_pending: number;
  risk_level: string;
  submitted_by: string;
}

export interface SystemConfig {
  l2_qty_threshold: number;
  l2_always_categories: string[];
  l1_sla_hours: number;
  l2_sla_hours: number;
  anomaly_sensitivity: "Low" | "Medium" | "High";
  session_timeout_minutes: number;
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export interface ReportData {
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  generated_at: string;
  total_rows: number;
}

export interface ReportColumn {
  key: string;
  label: string;
  type: "string" | "number" | "date" | "badge";
}

// ─── Request/Param Types ─────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface StockListParams {
  page?: number;
  page_size?: number;
  search?: string;
  category?: string;
  status?: string;
  location?: string;
  health?: string;
}

export interface DistributionListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string;
  stock_id?: string;
  date_from?: string;
  date_to?: string;
  risk_level?: string;
}

export interface ApprovalListParams {
  page?: number;
  page_size?: number;
  status?: string;
  risk_level?: string;
  level?: "l1" | "l2";
}

export interface AnomalyListParams {
  page?: number;
  page_size?: number;
  severity?: string;
  status?: string;
}

export interface AuditListParams {
  page?: number;
  page_size?: number;
  event_type?: string;
  actor_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface CreateStockRequest {
  stock_code: string;
  name: string;
  category: string;
  uom: string;
  total_qty: number;
  available_qty: number;
  min_level: number;
  max_level: number;
  location: string;
  status: "active" | "inactive" | "draft";
}

export interface CreateDistributionRequest {
  stock_id: string;
  qty_requested: number;
  recipient_type: "employee" | "project";
  recipient_id: string;
  recipient_name: string;
  distribution_date: string;
  location: string;
  purpose: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  employee_id: string;
  role: string;
  department: string;
  location: string;
  password: string;
}
