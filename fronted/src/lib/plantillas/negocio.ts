/**
 * negocio.ts — Arma los datos reales del negocio + ajustes de impresión para
 * los tickets/facturas, en un solo lugar.
 *
 * Antes el nombre del negocio estaba hardcodeado como "Cocina Oculta" en
 * Ordenes.tsx y Facturas.tsx; aquí se resuelve desde la sede activa
 * (restaurantesService.obtener) y desde la configuración de impresión
 * (uiConfig scope `impresion`), respetando el multi-tenant.
 *
 * Se cachea por sede: al cambiar de sede la clave difiere y se recalcula; tras
 * guardar la config de impresión, llamar `invalidarConfigImpresion()`.
 */

import { restaurantesService } from '../../services/restaurantes.service';
import { uiConfigService } from '../../services/ui-config.service';
import { useRestauranteStore } from '../../store/restauranteStore';
import type { PrintNegocio } from './ticketRenderer';

export interface ConfigImpresion {
  negocio:       PrintNegocio;
  pieTicket:     string;
  copiasComanda: number;
}

let cache: { sedeId: number; data: ConfigImpresion } | null = null;

/** Invalida el caché (llamar tras guardar la configuración de impresión). */
export function invalidarConfigImpresion(): void {
  cache = null;
}

/** Carga (o reutiliza) los datos del negocio y los ajustes de impresión de la sede activa. */
export async function cargarConfigImpresion(): Promise<ConfigImpresion> {
  const activo = useRestauranteStore.getState().activo;
  const sedeId = activo?.id ?? 0;
  if (cache && cache.sedeId === sedeId) return cache.data;

  const [rest, pie, copias, dian] = await Promise.all([
    sedeId ? restaurantesService.obtener(sedeId).catch(() => null) : Promise.resolve(null),
    uiConfigService.getConfig('impresion', 'pie_ticket').catch(() => null),
    uiConfigService.getConfig('impresion', 'copias_comanda').catch(() => null),
    uiConfigService.getConfig('impresion', 'resolucion_dian').catch(() => null),
  ]);

  const direccionCompleta = [rest?.direccion, rest?.ciudad].filter(Boolean).join(', ');

  const negocio: PrintNegocio = {
    nombre:         rest?.nombre ?? activo?.nombre ?? 'Mi Negocio',
    nit:            rest?.nit ?? undefined,
    telefono:       rest?.telefono ?? undefined,
    ciudad:         direccionCompleta || undefined,
    resolucionDian: dian?.valor ? String(dian.valor) : undefined,
    logoUrl:        rest?.logo_url ?? activo?.logo_url ?? undefined,
  };

  const data: ConfigImpresion = {
    negocio,
    pieTicket:     pie?.valor ? String(pie.valor) : '',
    copiasComanda: copias?.valor ? Number(copias.valor) : 1,
  };

  cache = { sedeId, data };
  return data;
}
