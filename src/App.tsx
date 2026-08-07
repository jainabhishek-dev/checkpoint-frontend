import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import AppLayout from "./components/layout/AppLayout";
import LoginPage from "./components/auth/LoginPage";
import DashboardPage from "./components/dashboard/DashboardPage";
import ProcessPage from "./components/jobs/ProcessPage";
import CicProcessPage from "./components/jobs/CicProcessPage";
import HistoryPage from "./components/history/HistoryPage";
import RunDetailPage from "./components/history/RunDetailPage";
import CicRunDetailPage from "./components/history/CicRunDetailPage";
import AkProcessPage from "./components/jobs/AkProcessPage";
import AkRunDetailPage from "./components/history/AkRunDetailPage";
import CheckpointsPage from "./components/admin/CheckpointsPage";
import WorkflowsPage from "./components/admin/WorkflowsPage";
import AdminsPage from "./components/admin/AdminsPage";
import OngoingTasksPage from "./components/admin/OngoingTasksPage";
import { Loader2 } from "lucide-react";

// ── Auth guard ────────────────────────────────────────────────────────────────

function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function RequireAdmin() {
  const { isAdmin, isLoading } = useAuth();

  if (isLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  return <Outlet />;
}

// ── App routes ────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected */}
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/process/:job_id" element={<ProcessPage />} />
          <Route path="/cic-process/:job_id" element={<CicProcessPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/history/cic/:run_id" element={<CicRunDetailPage />} />
          <Route path="/history/ak/:run_id" element={<AkRunDetailPage />} />
          <Route path="/history/:run_id" element={<RunDetailPage />} />
          <Route path="/ak-process/:job_id" element={<AkProcessPage />} />

          {/* Admin-only */}
          <Route element={<RequireAdmin />}>
            <Route path="/admin/workflows" element={<WorkflowsPage />} />
            <Route path="/admin/checkpoints" element={<CheckpointsPage />} />
            <Route path="/admin/admins" element={<AdminsPage />} />
            <Route path="/admin/ongoing-tasks" element={<OngoingTasksPage />} />
          </Route>
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
