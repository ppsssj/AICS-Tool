import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';

export function ProtectedRoute({ children }: PropsWithChildren) {
  const authStatus = useLabStore((state) => state.authStatus);
  const isAuthenticated = useLabStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (authStatus !== 'ready') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm font-medium text-slate-200">
        Checking session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
