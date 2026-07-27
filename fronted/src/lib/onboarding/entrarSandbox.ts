/**
 * useEntrarSandbox — cambia el contexto de sesión al de un sandbox y navega al POS.
 *
 * Mismo patrón que Login.tsx: setAuth + initFromToken con la sesión fresca que el
 * backend devuelve (ya incluye la sede de prueba en restaurantes[]), y además fija
 * la sede activa = primera sede del sandbox y (superadmin) el grupo activo.
 */

import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useStore';
import { useRestauranteStore } from '../../store/restauranteStore';
import { useFeatureFlagStore } from '../../store/featureFlagStore';
import type { SandboxCreado } from '../../types/onboarding.types';

export function useEntrarSandbox() {
  const navigate       = useNavigate();
  const setAuth        = useAuthStore(s => s.setAuth);
  const isSuperAdmin   = useAuthStore(s => s.isSuperAdmin);
  const initFromToken  = useRestauranteStore(s => s.initFromToken);
  const setActivo      = useRestauranteStore(s => s.setActivo);
  const setGrupoActivo = useRestauranteStore(s => s.setGrupoActivo);
  const reloadFlags    = useFeatureFlagStore(s => s.reloadFlags);

  return async ({ sandbox, session }: SandboxCreado) => {
    // 1. Nueva sesión — el JWT ya incluye la(s) sede(s) de prueba.
    setAuth(session.user, session.tokens.accessToken, session.tokens.refreshToken);
    initFromToken(session.user.restaurantes);

    // 2. Sede activa = primera sede del sandbox (ninguna es_default para no
    //    contaminar el tenant real, por eso la elegimos explícitamente).
    const sedeEntrada = sandbox.sedes[0];
    const sedeMini    = session.user.restaurantes.find(r => r.id === sedeEntrada?.id);
    if (sedeMini) setActivo(sedeMini);

    // 3. Grupo activo (superadmin) = grupo del sandbox.
    if (isSuperAdmin()) {
      setGrupoActivo({ id: sandbox.id_grupo, nombre: sandbox.nombre });
    }

    // 4. Refrescar flags del nuevo contexto y entrar al POS.
    await reloadFlags();
    navigate('/dashboard', { replace: true });
  };
}
