/**
 * onboardingService — cliente HTTP para el wizard de configuración inicial.
 *
 * Reutiliza el singleton api.ts (ya incluye JWT + X-Restaurante-Id en cada request).
 * El scoping multi-tenant lo hace el backend vía ese header; aquí no se pasa restauranteId.
 *
 * previsualizar → POST /onboarding/apply?preview=true  (solo lectura, sin persistir)
 * aplicar       → POST /onboarding/apply               (transaccional, con cascada de huérfanos)
 */

import api from './api';
import type { EntradaOnboarding, PerfilResuelta } from '../types/onboarding.types';

interface ApiSuccess<T> {
  success: boolean;
  data:    T;
  message?: string;
}

export const onboardingService = {
  /**
   * Devuelve el plan de flags+configs+huérfanos SIN persistir.
   * Llamar antes de mostrarle al usuario lo que cambiará.
   */
  previsualizar: async (input: EntradaOnboarding): Promise<PerfilResuelta> => {
    const { data } = await api.post<ApiSuccess<PerfilResuelta>>(
      '/onboarding/apply',
      input,
      { params: { preview: 'true' } },
    );
    return data.data;
  },

  /**
   * Aplica el perfil de forma transaccional.
   * Solo invocar DESPUÉS de que el usuario confirme el preview.
   */
  aplicar: async (input: EntradaOnboarding): Promise<PerfilResuelta> => {
    const { data } = await api.post<ApiSuccess<PerfilResuelta>>(
      '/onboarding/apply',
      input,
    );
    return data.data;
  },
};
