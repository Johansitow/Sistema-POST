/**
 * db.ts — IndexedDB para la cola de ventas creadas sin conexión.
 * Se usa IndexedDB (no localStorage) porque las ventas offline pueden ser muchas
 * y llevan payloads grandes; y sobrevive recargas/cierre del navegador.
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'krezco-offline';
const STORE   = 'ventas_pendientes';

export interface VentaPendiente {
  /** Clave de idempotencia (== keyPath). El backend deduplica por este uuid. */
  client_uuid: string;
  /** Payload listo para POST /ordenes/offline (incluye pagos y fecha real). */
  payload:     Record<string, unknown>;
  /** ISO de cuándo se encoló (hora real de la venta). */
  fecha:       string;
  intentos:    number;
}

let dbp: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbp) {
    dbp = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'client_uuid' });
        }
      },
    });
  }
  return dbp;
}

export async function put(v: VentaPendiente): Promise<void> {
  await (await getDB()).put(STORE, v);
}

export async function getAll(): Promise<VentaPendiente[]> {
  return (await getDB()).getAll(STORE) as Promise<VentaPendiente[]>;
}

export async function del(client_uuid: string): Promise<void> {
  await (await getDB()).delete(STORE, client_uuid);
}

export async function count(): Promise<number> {
  return (await getDB()).count(STORE);
}
