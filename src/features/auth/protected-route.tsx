import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';

export function ProtectedRoute({ children }: PropsWithChildren) {
  const isAuthenticated = useLabStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
