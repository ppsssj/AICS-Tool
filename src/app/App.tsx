import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/app/layouts/app-layout';
import { useLabStore } from '@/app/store/use-lab-store';
import { ProtectedRoute } from '@/features/auth/protected-route';
import { CalendarPage } from '@/pages/calendar-page';
import { DashboardPage } from '@/pages/dashboard-page';
import { LoginPage } from '@/pages/login-page';
import { NotFoundPage } from '@/pages/not-found-page';
import { ProjectDetailPage } from '@/pages/project-detail-page';
import { ProjectsPage } from '@/pages/projects-page';
import { SettingsPage } from '@/pages/settings-page';

function ThemeEffect() {
  const appTheme = useLabStore((state) => state.appTheme);
  const authStatus = useLabStore((state) => state.authStatus);
  const hydrateSession = useLabStore((state) => state.hydrateSession);
  const hydrateFromServer = useLabStore((state) => state.hydrateFromServer);
  const hasHydratedFromServer = useLabStore((state) => state.hasHydratedFromServer);
  const isHydratingFromServer = useLabStore((state) => state.isHydratingFromServer);
  const isAuthenticated = useLabStore((state) => state.isAuthenticated);

  useEffect(() => {
    document.documentElement.dataset.theme = appTheme;
  }, [appTheme]);

  useEffect(() => {
    if (authStatus !== 'idle') {
      return;
    }

    void hydrateSession();
  }, [authStatus, hydrateSession]);

  useEffect(() => {
    if (
      authStatus !== 'ready' ||
      !isAuthenticated ||
      hasHydratedFromServer ||
      isHydratingFromServer
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      void hydrateFromServer();
    }, 600);

    return () => window.clearTimeout(timer);
  }, [authStatus, hasHydratedFromServer, hydrateFromServer, isAuthenticated, isHydratingFromServer]);

  return null;
}

export function App() {
  return (
    <BrowserRouter>
      <ThemeEffect />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId/*" element={<ProjectDetailPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
