/**
 * proveedor.ts — Contrato de facturación electrónica, agnóstico al proveedor.
 *
 * Toda la app habla contra `ProveedorFacturacion`; el driver concreto (Factus real
 * o noop de dev) se elige por config. Molde: lib/pagos/pasarela.ts.
 *
 * Las credenciales del proveedor son POR TENANT (se resuelven de la config del
 * grupo, descifradas) y se pasan por parámetro; el driver es stateless respecto
 * al tenant.
 */

import { randomUUID } from 'crypto';

/** Estado normalizado de un documento, independiente del proveedor. */
export type EstadoProveedorFE = 'emitida' | 'pendiente' | 'rechazada' | 'error';

/** Credenciales de Factus (por tenant). numberingRangeId = rango/resolución DIAN. */
export interface CredencialesFactus {
  clientId:         string;
  clientSecret:     string;
  username:         string;
  password:         string;
  numberingRangeId: number;
}

/** Identificación fiscal del comprador (adquiriente). */
export interface AdquirienteFiscal {
  tipo_documento:   string; // código DIAN: '13' cédula, '31' NIT, '11' RC, etc.
  numero_documento: string;
  nombre:           string;
  email?:           string;
  telefono?:        string;
  direccion?:       string;
}

/** Línea de la factura con su impuesto (DIAN exige desglose por ítem). */
export interface LineaFactura {
  descripcion:     string;
  cantidad:        number;
  precio_unitario: number; // COP unidades
  descuento:       number;
  tarifa_impuesto: number; // % (19, 8, 0)
  tipo_impuesto:   string; // 'iva' | 'impoconsumo'
}

export interface PayloadFactura {
  referencia:  string;
  adquiriente: AdquirienteFiscal;
  lineas:      LineaFactura[];
  subtotal:    number;
  impuestos:   number;
  total:       number;
  observacion?: string;
}

export interface ResultadoEmision {
  estado:   EstadoProveedorFE;
  cufe?:    string | null;
  numero?:  string | null;
  qrUrl?:   string | null;
  pdfUrl?:  string | null;
  xml?:     string | null;
  raw?:     unknown;
  mensaje?: string | null;
}

export interface ProveedorFacturacion {
  /** true si el driver activo es real (Factus); false para el noop de dev. */
  disponible(): boolean;
  emitir(payload: PayloadFactura, cred: CredencialesFactus): Promise<ResultadoEmision>;
  consultarEstado(numero: string, cred: CredencialesFactus): Promise<ResultadoEmision>;
}

/** Referencia única e idempotente que se envía al proveedor. */
export function nuevaReferencia(grupoId: number): string {
  return `fe_${grupoId}_${Date.now()}_${randomUUID().slice(0, 8)}`;
}

/** Mapea el estado textual de Factus/DIAN al estado normalizado. */
export function mapEstadoFactus(status: unknown): EstadoProveedorFE {
  const s = String(status).toLowerCase();
  if (['valid', 'validated', 'aceptado', 'accepted', 'emitida'].some((x) => s.includes(x))) return 'emitida';
  if (['reject', 'rechaz'].some((x) => s.includes(x))) return 'rechazada';
  if (['pend', 'process'].some((x) => s.includes(x))) return 'pendiente';
  return 'error';
}
