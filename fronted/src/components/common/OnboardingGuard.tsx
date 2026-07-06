/**
 * OnboardingGuard — gate de primer arranque.
 *
 * Uso como route layout element (Outlet-based), igual que PrivateGuard:
 *
 *   <Route element={<OnboardingGuard />}>
 *     <Route path="/dashboard" element={<Dashboard />} />
 *     ...
 *   </Route>
 *
 * Comportamiento:
 *   - flags aún no cargados          → spinner (evita flash de redirect)
 *   - onboarding_completado = true   → renderiza <Outlet /> (acceso normal)
 *   - onboarding_completado = false  → redirige a /onboarding
 *
 * El flag onboarding_completado llega en GET /feature-flags/client (scope=contexto,
 * resuelto por sede vía X-Restaurante-Id). Layout.tsx carga los flags al montar,
 * por lo que este componente solo espera un frame antes de resolver.
 *
 * La ruta /onboarding debe estar FUERA de OnboardingGuard en el árbol de rutas
 * para evitar bucle de redirección.
 */

import { CircularProgress, Box } from '@mui/material';
import { Navigate, Outlet }      from 'react-router-dom';
import { useFeatureFlagStore }   from '../../store/featureFlagStore';

export const FLAG_ONBOARDING = 'onboarding_completado';

export const OnboardingGuard: React.FC = () => {
  const loaded               = useFeatureFlagStore(s => s.loaded);
  const onboardingCompletado = useFeatureFlagStore(s => s.flags[FLAG_ONBOARDING] ?? false);

  if (!loaded) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return onboardingCompletado ? <Outlet /> : <Navigate to="/onboarding" replace />;
};
