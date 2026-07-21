import { Routes, Route, Navigate } from 'react-router';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { SessionsProvider } from '@/hooks/useSessions';
import { VoiceProvider } from '@/hooks/useVoice';
import { ToastProvider } from '@/hooks/useToast';
import ToastContainer from '@/components/ToastContainer';
import AuthPage from '@/pages/AuthPage';
import HistoryPage from '@/pages/HistoryPage';
import TrainerPage from '@/pages/TrainerPage';
import DietPlannerPage from '@/pages/DietPlannerPage';
import DietDashboardPage from '@/pages/DietDashboardPage';
import DashboardPage from '@/pages/DashboardPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workout"
        element={
          <ProtectedRoute>
            <TrainerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <HistoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/diet-planner"
        element={
          <ProtectedRoute>
            <DietPlannerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/diet-dashboard"
        element={
          <ProtectedRoute>
            <DietDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SessionsProvider>
        <VoiceProvider>
          <ToastProvider>
            <AppRoutes />
            <ToastContainer />
          </ToastProvider>
        </VoiceProvider>
      </SessionsProvider>
    </AuthProvider>
  );
}
