import { Navigate, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';

interface PrivateRouteProps {
  adminOnly?: boolean;
}

export default function PrivateRoute({ adminOnly = false }: PrivateRouteProps) {
  const { isAuthenticated, user, bootstrapped, fetchUser } = useAuthStore();

  useEffect(() => {
    if (!bootstrapped) {
      fetchUser();
    }
  }, [bootstrapped, fetchUser]);

  // Wait until we know whether a cookie session exists before deciding to redirect.
  if (!bootstrapped) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user && !user.is_superuser) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
