/**
 * RequireModulo — gatea una ruta por el módulo del plan del grupo.
 *
 * Si el plan incluye el módulo (o el grupo está grandfathered) → renderiza la ruta.
 * Si no → muestra la pantalla de upsell <ModuloBloqueado> (no redirige, para que
 * el usuario entienda por qué y pueda mejorar).
 *
 * El backend (requireModulo) es la autoridad real; esto es la capa de UX.
 */

import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { usePlanStore, moduloHabilitado } from '../../store/planStore';
import type { ModuloPlan } from '../../services/planes.service';
import ModuloBloqueado from './ModuloBloqueado';

interface Props {
  modulo: ModuloPlan;
  children?: React.ReactNode;
}

export default function RequireModulo({ modulo, children }: Props) {
  const loaded    = usePlanStore(s => s.loaded);
  const planYUso  = usePlanStore(s => s.planYUso);
  const loadMiPlan = usePlanStore(s => s.loadMiPlan);

  useEffect(() => { loadMiPlan(); }, [loadMiPlan]);

  // Esperar a que el plan cargue para no parpadear el upsell.
  if (!loaded) return null;

  return moduloHabilitado(planYUso, modulo)
    ? <>{children ?? <Outlet />}</>
    : <ModuloBloqueado modulo={modulo} />;
}
