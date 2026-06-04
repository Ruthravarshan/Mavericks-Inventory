import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { AppLayout } from "@/components/app-layout";
import { Toaster } from "@/components/ui/toaster";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      // Use literal colors here since ThemeProvider variables may not be ready
      // if the crash happened before the provider mounted.
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 32,
            textAlign: "center",
            background: "#0b0d12",
            color: "#f4f5f7",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: "#94a3b8", maxWidth: 480 }}>
            {this.state.error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              borderRadius: 8,
              background: "#f5a623",
              color: "#1a1208",
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Pages
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import StocksPage from "@/pages/stocks";
import StockDetailPage from "@/pages/stock-detail";
import DistributionsPage from "@/pages/distributions";
import NewDistributionPage from "@/pages/new-distribution";
import ApprovalsPage from "@/pages/approvals";
import UploadPage from "@/pages/upload";
import ReportsPage from "@/pages/reports";
import InsightsPage from "@/pages/insights";
import AnomaliesPage from "@/pages/anomalies";
import AuditLogPage from "@/pages/audit-log";
import AdminPage from "@/pages/admin";
import NotFoundPage from "@/pages/not-found";
import MyAssetsPage from "@/pages/my-assets";
import MakeRequestPage from "@/pages/make-request";
import MyRequestsPage from "@/pages/my-requests";
import AssetAuditPage from "@/pages/asset-audit";
import EmployeesPage from "@/pages/employees";
import AssetsPage from "@/pages/assets";
import ManageRequestsPage from "@/pages/manage-requests";
import EmployeeDetailPage from "@/pages/employee-detail";
import ProfilePage from "@/pages/profile";
import LedgerPage from "@/pages/ledger";
import ReconciliationPage from "@/pages/reconciliation";
import LegalHoldsPage from "@/pages/legal-holds";
import MobileAuditPage from "@/pages/mobile-audit";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { accessToken, user, isLoading } = useAuth();
  // While hydrating the stored token, render nothing rather than bouncing.
  if (isLoading) return null;
  if (!accessToken) return <Navigate to="/login" replace />;
  // Token present but user not yet hydrated → keep waiting.
  if (!user) return null;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { accessToken, isLoading } = useAuth();
  if (isLoading) return null;
  if (accessToken) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function ManagerRoute({ children }: { children: React.ReactNode }) {
  const { isManagerOrAbove } = useAuth();
  if (!isManagerOrAbove) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Allows any role except auditor (auditors are read-only) for write operations. */
function NonAuditorRoute({ children }: { children: React.ReactNode }) {
  const { isAuditor } = useAuth();
  if (isAuditor) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Pages that show org-wide data — managers, admin, L2, auditor only. */
function StaffRoute({ children }: { children: React.ReactNode }) {
  const { isManagerOrAbove, isAuditor } = useAuth();
  if (!isManagerOrAbove && !isAuditor) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Fully public — no auth, used by mobile QR scan */}
      <Route path="/mobile-audit" element={<MobileAuditPage />} />

      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Catalog — everyone can browse stock */}
        <Route path="/stocks" element={<StocksPage />} />
        <Route path="/stocks/:id" element={<StockDetailPage />} />

        {/* Distributions — view: staff + execs; create: non-auditors */}
        <Route
          path="/distributions"
          element={
            <StaffRoute>
              <DistributionsPage />
            </StaffRoute>
          }
        />
        <Route
          path="/distributions/new"
          element={
            <NonAuditorRoute>
              <NewDistributionPage />
            </NonAuditorRoute>
          }
        />

        {/* Approvals — managers + L2 + admin only */}
        <Route
          path="/approvals"
          element={
            <ManagerRoute>
              <ApprovalsPage />
            </ManagerRoute>
          }
        />

        {/* Anomalies — staff (manager/L2/admin) + auditor */}
        <Route
          path="/anomalies"
          element={
            <StaffRoute>
              <AnomaliesPage />
            </StaffRoute>
          }
        />

        {/* Insights / Reports — staff + auditor */}
        <Route
          path="/insights"
          element={
            <StaffRoute>
              <InsightsPage />
            </StaffRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <StaffRoute>
              <ReportsPage />
            </StaffRoute>
          }
        />

        {/* Audit log — manager+ and auditor */}
        <Route
          path="/audit-log"
          element={
            <StaffRoute>
              <AuditLogPage />
            </StaffRoute>
          }
        />

        {/* Bulk upload — manager+ only (write op) */}
        <Route
          path="/upload"
          element={
            <ManagerRoute>
              <UploadPage />
            </ManagerRoute>
          }
        />

        {/* Admin console — admin only */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />

        {/* IT Asset Management routes */}
        <Route path="/my-assets" element={<MyAssetsPage />} />
        <Route
          path="/make-request"
          element={
            <NonAuditorRoute>
              <MakeRequestPage />
            </NonAuditorRoute>
          }
        />
        <Route path="/my-requests" element={<MyRequestsPage />} />
        <Route
          path="/asset-audit"
          element={
            <NonAuditorRoute>
              <AssetAuditPage />
            </NonAuditorRoute>
          }
        />

        {/* Asset registry — manager+ and auditor (auditor read-only) */}
        <Route
          path="/assets"
          element={
            <StaffRoute>
              <AssetsPage />
            </StaffRoute>
          }
        />

        {/* People — manager+ and auditor */}
        <Route
          path="/employees"
          element={
            <StaffRoute>
              <EmployeesPage />
            </StaffRoute>
          }
        />
        <Route
          path="/employees/:id"
          element={
            <StaffRoute>
              <EmployeeDetailPage />
            </StaffRoute>
          }
        />

        <Route
          path="/manage-requests"
          element={
            <ManagerRoute>
              <ManageRequestsPage />
            </ManagerRoute>
          }
        />

        <Route path="/profile" element={<ProfilePage />} />

        {/* Stock Ledger — manager+ and auditor */}
        <Route
          path="/ledger"
          element={
            <StaffRoute>
              <LedgerPage />
            </StaffRoute>
          }
        />

        {/* Reconciliation — admin only (sensitive accounting) */}
        <Route
          path="/reconciliation"
          element={
            <AdminRoute>
              <ReconciliationPage />
            </AdminRoute>
          }
        />

        {/* Legal holds — admin only */}
        <Route
          path="/legal-holds"
          element={
            <StaffRoute>
              <LegalHoldsPage />
            </StaffRoute>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
            <Toaster />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
