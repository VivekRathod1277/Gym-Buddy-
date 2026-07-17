import { Routes, Route, Navigate } from 'react-router';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { SessionsProvider } from '@/hooks/useSessions';
import { VoiceProvider } from '@/hooks/useVoice';
import { ToastProvider } from '@/hooks/useToast';
import ToastContainer from '@/components/ToastContainer';
import AuthPage from '@/pages/AuthPage';
import WorkoutPage from '@/pages/WorkoutPage';
import HistoryPage from '@/pages/HistoryPage';
import TrainerPage from '@/pages/TrainerPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AuthPage />} />
      <Route
        path="/workout"
        element={
          <ProtectedRoute>
            <WorkoutPage />
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
        path="/trainer"
        element={
          <ProtectedRoute>
            <TrainerPage />
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
