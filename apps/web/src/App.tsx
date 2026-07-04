import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { useAuth } from './lib/auth';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  return auth ? <>{children}</> : <Navigate to="/login" replace />;
}

export function App() {
  const { auth } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={auth ? <Navigate to="/" replace /> : <AuthPage mode="login" />}
      />
      <Route
        path="/register"
        element={auth ? <Navigate to="/" replace /> : <AuthPage mode="register" />}
      />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
