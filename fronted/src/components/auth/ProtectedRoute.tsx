/**
 * ProtectedRoute - Protege rutas que requieren autenticación
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSuperAdmin?: boolean; // corregido: era requireAdmin
}

export default function ProtectedRoute({
  children,
  requireSuperAdmin = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireSuperAdmin && !user?.es_super_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}