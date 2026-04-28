/**
 * utils/constants.ts
 *
 * Constantes globales de la app.
 * Centralizar aquí evita strings mágicos duplicados por toda la app
 * y facilita cambios en un solo lugar.
 *
 * Regla: si usas el mismo string/número en más de un archivo, va aquí.
 */

// ─── Estados ──────────────────────────────────────────────────────────────────

/**
 * Estados posibles de usuarios, productos y otras entidades
 * Coincide con el enum EstadoGeneral del schema de Prisma
 */
export const ESTADOS = {
  ACTIVO:    'activo',
  INACTIVO:  'inactivo',
  ELIMINADO: 'eliminado',
} as const;

export type Estado = typeof ESTADOS[keyof typeof ESTADOS];

// ─── Órdenes ──────────────────────────────────────────────────────────────────

export const TIPOS_ORDEN = {
  LOCAL:     'local',
  DOMICILIO: 'domicilio',
} as const;

export type TipoOrden = typeof TIPOS_ORDEN[keyof typeof TIPOS_ORDEN];

/**
 * Códigos de estado de órdenes — deben coincidir con la BD
 */
export const CODIGOS_ESTADO_ORDEN = {
  PENDIENTE:  'PENDIENTE',
  CONFIRMADA: 'CONFIRMADA',
  EN_PROCESO: 'EN_PROCESO',
  LISTA:      'LISTA',
  ENTREGADA:  'ENTREGADA',
  CANCELADA:  'CANCELADA',
} as const;

// ─── Inventario ───────────────────────────────────────────────────────────────

export const TIPOS_MATERIA = {
  PRIMA:     'prima',
  PROCESADA: 'procesada',
} as const;

export const UNIDADES_MEDIDA = {
  UNIDAD:     'unidad',
  GRAMO:      'gramo',
  KILOGRAMO:  'kilogramo',
  LITRO:      'litro',
  MILILITRO:  'mililitro',
  PORCION:    'porcion',
} as const;

/** Abreviaturas para mostrar en la UI */
export const UNIDAD_LABEL: Record<string, string> = {
  unidad:    'Unidad',
  gramo:     'Gramo (g)',
  kilogramo: 'Kilogramo (kg)',
  litro:     'Litro (L)',
  mililitro: 'Mililitro (mL)',
  porcion:   'Porción',
};

export const TIPOS_MOVIMIENTO = {
  ENTRADA:    'entrada',
  SALIDA:     'salida',
  AJUSTE:     'ajuste',
  MERMA:      'merma',
  PRODUCCION: 'produccion',
  VENTA:      'venta',
  DEVOLUCION: 'devolucion',
} as const;

// ─── Paginación ───────────────────────────────────────────────────────────────

export const PAGINATION = {
  DEFAULT_PAGE:  1,
  DEFAULT_LIMIT: 10,
  LIMIT_OPTIONS: [5, 10, 25, 50],
} as const;

// ─── Colores ──────────────────────────────────────────────────────────────────

/**
 * Colores principales de la app — usados en avatares, chips y badges
 * Coinciden con el tema de MUI configurado
 */
export const COLORS = {
  PRIMARY:   '#e53935',
  SECONDARY: '#ff6f00',
  SUCCESS:   '#4caf50',
  WARNING:   '#ff9800',
  ERROR:     '#f44336',
  INFO:      '#2196f3',
  DEFAULT:   '#9e9e9e',
} as const;

/**
 * Color de fallback cuando un rol no tiene color definido en BD
 */
export const DEFAULT_ROL_COLOR = '#e53935';

// ─── Rutas ────────────────────────────────────────────────────────────────────

/**
 * Rutas de la app — evita strings duplicados en navigate() y Link
 */
export const ROUTES = {
  LOGIN:           '/login',
  DASHBOARD:       '/dashboard',
  INVENTARIO:      '/inventario',
  ORDENES:         '/ordenes',
  REPORTES:        '/reportes',
  ADMIN_USUARIOS:  '/admin/usuarios',
} as const;

// ─── Validaciones ─────────────────────────────────────────────────────────────

export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  USUARIO_MIN_LENGTH:  3,
  NOMBRE_MIN_LENGTH:   2,
  SKU_MAX_LENGTH:      50,
  TELEFONO_MAX_LENGTH: 20,
} as const;

// ─── Mensajes de éxito ────────────────────────────────────────────────────────

/**
 * Mensajes reutilizables para los Snackbars
 */
export const MESSAGES = {
  CREATED:         'Creado correctamente',
  UPDATED:         'Actualizado correctamente',
  DELETED:         'Eliminado correctamente',
  ACTIVATED:       'Activado correctamente',
  DEACTIVATED:     'Desactivado correctamente',
  PASSWORD_RESET:  'Contraseña reseteada correctamente',
  ERROR_GENERIC:   'Ha ocurrido un error. Intenta de nuevo.',
  ERROR_NETWORK:   'No se pudo conectar con el servidor.',
} as const;
