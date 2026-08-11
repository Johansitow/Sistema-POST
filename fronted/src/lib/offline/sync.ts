/**
 * sync.ts — Sincroniza la cola de ventas offline al recuperar conexión.
 *
 * El backend /ordenes/offline es idempotente (dedup por client_uuid), así que
 * reintentar o reenviar una venta ya sincronizada es seguro. En éxito se remueve
 * de la cola; ante error de red se conserva (se reintenta luego). Un error de
 * validación del servidor (4xx) se conserva también, incrementando `intentos`
 * para que la UI pueda señalarlo, en vez de perder la venta silenciosamente.
 */

import api from '../../services/api';
import { listar, remover, marcarIntento, contar } from './cola';

let sincronizando = false;

export async function sincronizarPendientes(): Promise<{ ok: number; fail: number }> {
  if (sincronizando || !navigator.onLine) return { ok: 0, fail: 0 };
  sincronizando = true;
  let ok = 0, fail = 0;
  try {
    const pendientes = await listar();
    for (const v of pendientes) {
      try {
        await api.post('/ordenes/offline', v.payload);
        await remover(v.client_uuid);
        ok++;
      } catch {
        await marcarIntento(v);
        fail++;
      }
    }
  } finally {
    sincronizando = false;
  }
  const restantes = await contar();
  window.dispatchEvent(new CustomEvent('offline-sync', { detail: { ok, fail, restantes } }));
  return { ok, fail };
}

/** Arranca el auto-sync: al volver online y una vez al cargar (si hay red). */
export function iniciarAutoSync(): () => void {
  const handler = () => { void sincronizarPendientes(); };
  window.addEventListener('online', handler);
  if (navigator.onLine) void sincronizarPendientes();
  return () => window.removeEventListener('online', handler);
}
