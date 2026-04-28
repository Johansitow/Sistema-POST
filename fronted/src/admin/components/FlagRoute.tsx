/**
 * FlagRoute — Wrapper que renderiza children solo si un feature flag está activo
 *
 * Uso:
 *   <FlagRoute flag="variantes_productos">
 *     <VariantesPage />
 *   </FlagRoute>
 *
 * Si el flag está deshabilitado → redirige al dashboard.
 * Si el flag está habilitado → renderiza children normalmente.
 * Mientras carga → muestra nada (evita flash de contenido).
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useFeatureFlagStore, useFeatureFlag } from '../../store/featureFlagStore';

interface FlagRouteProps {
  /** Nombre del feature flag a verificar */
  flag: string;
  /** Contenido a mostrar si el flag está activo */
  children: React.ReactNode;
  /** Ruta a redirigir si el flag está deshabilitado (default: /dashboard) */
  fallbackPath?: string;
}

export const FlagRoute: React.FC<FlagRouteProps> = ({
  flag,
  children,
  fallbackPath = '/dashboard',
}) => {
  const loaded  = useFeatureFlagStore(s => s.loaded);
  const enabled = useFeatureFlag(flag);

  // Esperar que el store haya cargado para evitar flash de redirect.
  // Layout.tsx carga los flags al montar, así que esto es solo un frame.
  if (!loaded) return null;

  return enabled ? <>{children}</> : <Navigate to={fallbackPath} replace />;
};
