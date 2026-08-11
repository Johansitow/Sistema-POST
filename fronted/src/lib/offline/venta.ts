/**
 * venta.ts — Registrar una venta de mostrador (offline-first).
 * Online: POST /ordenes/offline (idempotente). Offline o ante fallo de red: se
 * encola en IndexedDB y se sincroniza al reconectar.
 */

import api from '../../services/api';
import { encolar } from './cola';

export interface PagoVenta { id_metodo_pago: number; monto: number; referencia?: string; notas?: string }

export interface VentaOfflinePayload {
  id_grupo:      number;
  tipo_orden:    string;
  id_cliente?:   number;
  observaciones?: string;
  propina?:      number;
  descuento?:    number;
  sedes:         Array<{ id_restaurante: number; items: unknown[] }>;
  pagos:         PagoVenta[];
}

function nuevoUuid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  return c?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

/**
 * registrarVenta — crea la venta o la encola si no hay red.
 * Devuelve { encolada } para que el POS avise al usuario.
 */
export async function registrarVenta(
  payload: VentaOfflinePayload,
): Promise<{ encolada: boolean; data?: unknown; client_uuid: string }> {
  const client_uuid = nuevoUuid();
  const venta = { ...payload, client_uuid, fecha_apertura: new Date().toISOString() };

  const guardarEnCola = async () => {
    await encolar({ client_uuid, payload: venta, fecha: venta.fecha_apertura, intentos: 0 });
    return { encolada: true as const, client_uuid };
  };

  if (!navigator.onLine) return guardarEnCola();

  try {
    const r = await api.post('/ordenes/offline', venta);
    return { encolada: false, data: r.data.data, client_uuid };
  } catch (e: any) {
    // Error de RED (sin respuesta) → encolar; error del servidor → propagar.
    if (e?.request && !e?.response) return guardarEnCola();
    throw e;
  }
}
