/**
 * Z-index constants — centralized layer ordering.
 * Use these instead of raw numbers to keep overlaps explicit and predictable.
 */
export const Z_INDEX = {
  STICKY:          10,
  SIDEBAR:        100,
  NAVBAR:         110,
  DROPDOWN:       200,
  TOOLTIP:        210,
  MODAL_BACKDROP: 1300,
  MODAL_BASE:     1400,  // modales normales
  MODAL_NESTED:   1500,  // modales sobre modales (ej: pago dentro de detalle)
  NOTIFICATION:   1600,
} as const;

export type ZIndexValue = (typeof Z_INDEX)[keyof typeof Z_INDEX];
