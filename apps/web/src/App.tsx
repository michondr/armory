import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { useAuth } from './lib/auth';
import { AmmoPage } from './pages/AmmoPage';
import { AuthPage } from './pages/AuthPage';
import { BallisticsPage } from './pages/BallisticsPage';
import { DashboardPage } from './pages/DashboardPage';
import { GunsPage } from './pages/GunsPage';
import { SessionDetailPage } from './pages/SessionDetailPage';
import { SessionsPage } from './pages/SessionsPage';
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
        <Route path="/guns" element={<GunsPage />} />
        <Route path="/ammo" element={<AmmoPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/sessions/:id" element={<SessionDetailPage />} />
        <Route path="/ballistics" element={<BallisticsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
