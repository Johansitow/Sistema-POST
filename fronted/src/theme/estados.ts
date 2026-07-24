/**
 * estados.ts — Un solo lugar donde un estado se traduce a color.
 *
 * ── El problema ─────────────────────────────────────────────────────────────
 *
 * Había 13 mapas "estado → color" repartidos por el código, en tres formatos
 * incompatibles (clases de Tailwind, prop `color` de MUI, y hex sueltos):
 *
 *   Ordenes.tsx:54   getEstadoConfig       → clases Tailwind
 *   Ordenes.tsx:65   getEstadoGlobalConfig → clases Tailwind
 *   Ordenes.tsx:77   getEstadoSedeConfig   → clases Tailwind
 *   Cocina.tsx:23    ESTADO_CFG            → clases Tailwind
 *   StatusChip.tsx   ORDEN_CONFIG          → color MUI
 *   Facturas.tsx:18  ESTADO_CFG            → clases Tailwind
 *   … y siete más
 *
 * Cambiar el color de "Pendiente" obligaba a tocar cinco archivos, y en la
 * práctica se desincronizaban: el mismo estado se veía ámbar en una pantalla y
 * amarillo en otra.
 *
 * ── La solución ─────────────────────────────────────────────────────────────
 *
 * Un estado se mapea a un TONO semántico (`alerta`, `exito`, …), no a un color.
 * Después dos adaptadores traducen ese tono al formato que necesita cada
 * consumidor. Añadir un estado nuevo es una línea, y sale igual en toda la app.
 *
 * Las clases se escriben literales a propósito: el JIT de Tailwind escanea el
 * código fuente en busca de nombres de clase completos, así que
 * `bg-${tono}-50` no generaría nada.
 */

// ── Tonos ─────────────────────────────────────────────────────────────────────

export type Tono = 'exito' | 'alerta' | 'peligro' | 'info' | 'neutro' | 'marca';

/** Clases Tailwind por tono, para insignias y tarjetas de estado. */
const CLASES: Record<Tono, { insignia: string; punto: string; tarjeta: string }> = {
  exito:   { insignia: 'bg-exito-50 text-exito-700 border border-exito-200',       punto: 'bg-exito-500',   tarjeta: 'border-exito-200 bg-exito-50'     },
  alerta:  { insignia: 'bg-alerta-50 text-alerta-700 border border-alerta-200',    punto: 'bg-alerta-500',  tarjeta: 'border-alerta-200 bg-alerta-50'   },
  peligro: { insignia: 'bg-peligro-50 text-peligro-700 border border-peligro-200', punto: 'bg-peligro-500', tarjeta: 'border-peligro-200 bg-peligro-50' },
  info:    { insignia: 'bg-info-50 text-info-700 border border-info-200',          punto: 'bg-info-500',    tarjeta: 'border-info-200 bg-info-50'       },
  neutro:  { insignia: 'bg-neutro-100 text-neutro-600 border border-neutro-200',   punto: 'bg-neutro-400',  tarjeta: 'border-neutro-200 bg-neutro-50'   },
  marca:   { insignia: 'bg-brand-50 text-brand-700 border border-brand-200',       punto: 'bg-brand-500',   tarjeta: 'border-brand-200 bg-brand-50'     },
};

/** Equivalente en la prop `color` de MUI, para Chip, Button, Alert, etc. */
const COLOR_MUI: Record<Tono, 'success' | 'warning' | 'error' | 'info' | 'default' | 'primary'> = {
  exito: 'success', alerta: 'warning', peligro: 'error',
  info: 'info',     neutro: 'default', marca: 'primary',
};

// ── Estados de orden ──────────────────────────────────────────────────────────
//
// Cubre los códigos de la arquitectura por sede (OrdenSede.estado) y los del
// estado global (Orden.estado_global). Conviven a propósito: son dominios
// distintos del sistema dual de órdenes, pero comparten vocabulario visual.

export interface DefinicionEstado {
  tono:  Tono;
  label: string;
}

const ESTADOS_ORDEN: Record<string, DefinicionEstado> = {
  // Por sede
  PENDIENTE:      { tono: 'alerta',  label: 'Pendiente'      },
  EN_PREPARACION: { tono: 'info',    label: 'En preparación' },
  LISTA:          { tono: 'exito',   label: 'Lista'          },
  ENTREGADA:      { tono: 'neutro',  label: 'Entregada'      },
  CANCELADA:      { tono: 'peligro', label: 'Cancelada'      },
  // Globales
  RECIBIDA:       { tono: 'alerta',  label: 'Recibida'       },
  EN_PROCESO:     { tono: 'info',    label: 'En proceso'     },
  CONFIRMADA:     { tono: 'info',    label: 'Confirmada'     },
};

const ESTADOS_ENTIDAD: Record<string, DefinicionEstado> = {
  activo:    { tono: 'exito',   label: 'Activo'    },
  inactivo:  { tono: 'neutro',  label: 'Inactivo'  },
  eliminado: { tono: 'peligro', label: 'Eliminado' },
};

const ESTADOS_FACTURA: Record<string, DefinicionEstado> = {
  pendiente: { tono: 'alerta',  label: 'Pendiente' },
  pagada:    { tono: 'exito',   label: 'Pagada'    },
  anulada:   { tono: 'peligro', label: 'Anulada'   },
};

// Lista de compras: el recorrido va de "la generé" a "llegó la mercancía".
// `parcial` era violeta, un color sin significado en el resto del sistema; pasa
// a info porque es un estado en curso, igual que "en preparación" de una orden.
const ESTADOS_LISTA: Record<string, DefinicionEstado> = {
  generada:  { tono: 'neutro',  label: 'Generada'  },
  enviada:   { tono: 'alerta',  label: 'Enviada'   },
  parcial:   { tono: 'info',    label: 'Parcial'   },
  recibida:  { tono: 'exito',   label: 'Recibida'  },
  cancelada: { tono: 'peligro', label: 'Cancelada' },
};

const ESTADOS_LOTE: Record<string, DefinicionEstado> = {
  activo:        { tono: 'exito',   label: 'Activo'        },
  vencido:       { tono: 'peligro', label: 'Vencido'       },
  agotado:       { tono: 'neutro',  label: 'Agotado'       },
  en_produccion: { tono: 'info',    label: 'En producción' },
};

const ESTADOS_CAJA: Record<string, DefinicionEstado> = {
  pendiente:      { tono: 'alerta',  label: 'Pendiente'      },
  en_proceso:     { tono: 'info',    label: 'En proceso'     },
  completado:     { tono: 'exito',   label: 'Completado'     },
  con_diferencia: { tono: 'peligro', label: 'Con diferencia' },
};

const DESCONOCIDO: DefinicionEstado = { tono: 'neutro', label: '—' };

// ── API pública ───────────────────────────────────────────────────────────────

export type DominioEstado = 'orden' | 'entidad' | 'factura' | 'lista' | 'lote' | 'caja';

/** Los dominios cuyos códigos van en minúscula (los de orden van en MAYÚSCULA). */
const CATALOGOS: Record<DominioEstado, { mapa: Record<string, DefinicionEstado>; minuscula: boolean }> = {
  orden:   { mapa: ESTADOS_ORDEN,   minuscula: false },
  entidad: { mapa: ESTADOS_ENTIDAD, minuscula: true  },
  factura: { mapa: ESTADOS_FACTURA, minuscula: true  },
  lista:   { mapa: ESTADOS_LISTA,   minuscula: true  },
  lote:    { mapa: ESTADOS_LOTE,    minuscula: true  },
  caja:    { mapa: ESTADOS_CAJA,    minuscula: true  },
};

/**
 * Resuelve un código de estado a su definición.
 *
 * Si el código no está en el catálogo devuelve tono neutro y el código como
 * etiqueta, en vez de romper: el backend puede introducir estados nuevos antes
 * de que el frontend los conozca.
 */
export function definirEstado(codigo: string | undefined, dominio: DominioEstado = 'orden'): DefinicionEstado {
  if (!codigo) return DESCONOCIDO;
  const { mapa, minuscula } = CATALOGOS[dominio];
  const clave = minuscula ? codigo.toLowerCase() : codigo.toUpperCase();
  return mapa[clave] ?? { tono: 'neutro', label: codigo };
}

/** Clases Tailwind de un estado — para las pantallas operativas. */
export function clasesEstado(codigo: string | undefined, dominio: DominioEstado = 'orden') {
  return CLASES[definirEstado(codigo, dominio).tono];
}

/** Prop `color` de MUI de un estado — para las pantallas admin. */
export function colorMuiEstado(codigo: string | undefined, dominio: DominioEstado = 'orden') {
  return COLOR_MUI[definirEstado(codigo, dominio).tono];
}

/** Clases de un tono, cuando ya se conoce el tono y no hay código de estado. */
export function clasesTono(tono: Tono) {
  return CLASES[tono];
}

/**
 * Color CSS de un estado, para cuando el consumidor necesita un valor suelto y
 * no una clase ni una prop de MUI (p. ej. `sx={{ color }}` o el borde de un
 * chip pintado a mano).
 *
 * Devuelve `rgb(var(--tono-600))` en vez de un hex fijo: así sigue las mismas
 * variables que el resto y, si es el tono de marca, cambia con el tenant.
 */
export function colorEstado(codigo: string | undefined, dominio: DominioEstado = 'orden'): string {
  const tono = definirEstado(codigo, dominio).tono;
  const variable = tono === 'marca' ? 'brand' : tono;
  return `rgb(var(--${variable}-600))`;
}
