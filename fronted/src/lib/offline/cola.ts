/**
 * cola.ts — Cola de ventas offline (dominio sobre la capa IndexedDB `db`).
 * Emite el evento `offline-cola` al cambiar, para que la UI actualice el contador.
 */

import * as db from './db';
import type { VentaPendiente } from './db';

export type { VentaPendiente };

function notificar() {
  window.dispatchEvent(new CustomEvent('offline-cola'));
}

export async function encolar(v: VentaPendiente): Promise<void> {
  await db.put(v);
  notificar();
}

export async function listar(): Promise<VentaPendiente[]> {
  return db.getAll();
}

export async function remover(client_uuid: string): Promise<void> {
  await db.del(client_uuid);
  notificar();
}

export async function marcarIntento(v: VentaPendiente): Promise<void> {
  await db.put({ ...v, intentos: v.intentos + 1 });
}

export async function contar(): Promise<number> {
  return db.count();
}
