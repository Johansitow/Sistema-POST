/**
 * Onboarding — ruta /onboarding.
 *
 * Dos modos según si el usuario puede completar el onboarding:
 *
 *   puedeConfigurar = true  → wizard de 3 pasos (WizardOnboarding)
 *   puedeConfigurar = false → pantalla informativa ("pide al administrador")
 *
 * Proxy de permiso (hasta que permisos lleguen al JWT):
 *   - Usuario con restaurantes asignados → puede configurar (es owner/admin de sede)
 *   - Usuario sin restaurantes           → no puede
 *
 * El backend aplica RBAC real (requirePermission('onboarding.aplicar')) en el POST,
 * así que el peor caso es un 403 al intentar aplicar — no un bypass de seguridad.
 */

import { Box, Typography } from '@mui/material';
import { LockOutlined } from '@mui/icons-material';
import { useAuthStore } from '../store/useStore';
import { WizardOnboarding } from '../components/onboarding/WizardOnboarding';

function puedeConfigurar(restaurantes: { id: number }[]): boolean {
  return restaurantes.length > 0;
}

export function Onboarding() {
  const user = useAuthStore(s => s.user);
  const puedeCompletar = puedeConfigurar(user?.restaurantes ?? []);

  if (!puedeCompletar) {
    return (
      <Box
        sx={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '70vh', gap: 2, p: 4, textAlign: 'center',
        }}
      >
        <LockOutlined sx={{ fontSize: 72, color: 'text.disabled' }} />
        <Typography variant="h6" fontWeight={700} color="text.secondary">
          Esta sede aún no está configurada
        </Typography>
        <Typography variant="body2" color="text.disabled" maxWidth={420}>
          El administrador debe completar el asistente de configuración antes de que
          puedas usar el sistema. Pídele que acceda a esta pantalla con su cuenta.
        </Typography>
      </Box>
    );
  }

  return <WizardOnboarding />;
}
