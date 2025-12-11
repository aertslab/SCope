import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

interface PrivateRouteProps {
  adminOnly?: boolean;
}

export default function PrivateRoute({ adminOnly = false }: PrivateRouteProps) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user && !user.is_superuser) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
