import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
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
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-900 p-8 text-center">
          <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
          <p className="text-sm text-slate-400">{this.state.error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm text-white hover:bg-teal-500"
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuth();
  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = useAuth();
  if (user || accessToken) {
    return <Navigate to="/dashboard" replace />;
  }
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

function AppRoutes() {
  return (
    <Routes>
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
        <Route path="/stocks" element={<StocksPage />} />
        <Route path="/stocks/:id" element={<StockDetailPage />} />
        <Route path="/distributions" element={<DistributionsPage />} />
        <Route path="/distributions/new" element={<NewDistributionPage />} />
        <Route
          path="/approvals"
          element={
            <ManagerRoute>
              <ApprovalsPage />
            </ManagerRoute>
          }
        />
        <Route path="/anomalies" element={<AnomaliesPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route
          path="/audit-log"
          element={
            <ManagerRoute>
              <AuditLogPage />
            </ManagerRoute>
          }
        />
        <Route path="/upload" element={<UploadPage />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
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
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
