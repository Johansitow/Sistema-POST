/**
 * TourAutostart — dispara el tour de bienvenida la primera vez, una sola vez.
 *
 * Condiciones para arrancar:
 *   · hay sesión y el usuario aún NO completó el tutorial (flag del token),
 *   · el onboarding de la sede ya está completado (si no, OnboardingGuard manda
 *     a /onboarding y ahí no queremos tour),
 *   · no estamos en la propia ruta /onboarding.
 *
 * No renderiza nada: solo efecto. El estado "ya visto" lo persiste el tourStore
 * al finalizar/omitir (backend + flag en memoria), así que no vuelve a dispararse.
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useStore';
import { useFeatureFlagStore } from '../../store/featureFlagStore';
import { FLAG_ONBOARDING } from '../common/OnboardingGuard';
import { useTourStore } from '../../store/tourStore';

export function TourAutostart() {
  const { pathname } = useLocation();
  const usuario = useAuthStore(s => s.user);
  const flagsLoaded = useFeatureFlagStore(s => s.loaded);
  const onboardingOk = useFeatureFlagStore(s => s.flags[FLAG_ONBOARDING] ?? false);
  const iniciar = useTourStore(s => s.iniciar);
  const activo = useTourStore(s => s.activo);

  const yaDisparado = useRef(false);

  useEffect(() => {
    if (yaDisparado.current || activo) return;
    if (!usuario || usuario.tutorial_completado !== false) return;
    if (!flagsLoaded || !onboardingOk) return;
    if (pathname === '/onboarding') return;

    // Arranca de inmediato: el primer paso es la tarjeta de bienvenida (sin
    // ancla), así que no depende de que el sidebar ya esté pintado. Los pasos
    // anclados resuelven su elemento al navegar, cuando el chasis ya está en el
    // DOM. Nada de setTimeout: un cleanup que se dispare en el siguiente
    // re-render (datos async, socket) cancelaría el arranque para siempre.
    yaDisparado.current = true;
    iniciar();
  }, [usuario, flagsLoaded, onboardingOk, pathname, activo, iniciar]);

  return null;
}

export default TourAutostart;
