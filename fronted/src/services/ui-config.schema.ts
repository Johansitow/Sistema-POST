/**
 * ui-config.schema.ts — Tipos y helpers para la configuración de UI almacenada en DB
 *
 * La tabla UiConfiguracion guarda pares (scope, clave, valor) como strings JSON.
 * Este módulo provee:
 *   - Tipos TS tipados para cada scope
 *   - Helpers parse/serialize para convertir entre DB ↔ objetos tipados
 *   - Valores por defecto para cada configuración
 *
 * Scopes y claves:
 *   navegacion / items_ocultos   → string[]    (paths de rutas ocultas)
 *   navegacion / orden_items     → string[]    (paths en orden personalizado)
 *   apariencia / nombre_sistema  → string
 *   apariencia / color_primario  → string      (hex: "#FF5722")
 *   apariencia / logo_url        → string
 *   impresion  / ancho_papel     → "58" | "80"
 *   impresion  / copias_comanda  → number
 *   impresion  / pie_ticket      → string
 */

// ── Tipos tipados por scope ──────────────────────────────────────────────────

export interface NavegacionConfig {
  items_ocultos: string[];
  orden_items:   string[];
}

export interface AparienciaConfig {
  nombre_sistema: string;
  color_primario: string;
  logo_url:       string;
}

export interface ImpresionConfig {
  ancho_papel:    '58' | '80';
  copias_comanda: number;
  pie_ticket:     string;
  /** Resolución DIAN a imprimir en la factura (opcional; no hay campo en Restaurante). */
  resolucion_dian: string;
}

// ── Valores por defecto ──────────────────────────────────────────────────────

export const DEFAULTS: {
  navegacion: NavegacionConfig;
  apariencia: AparienciaConfig;
  impresion:  ImpresionConfig;
} = {
  navegacion: {
    items_ocultos: [],
    orden_items:   [],
  },
  apariencia: {
    nombre_sistema: 'Krezco',
    // Verde esmeralda: color de identidad de la marca Krezco (de "crecer").
    // Es solo el default cuando un tenant no configuró su propio color.
    color_primario: '#10B981',
    logo_url:       '',
  },
  impresion: {
    ancho_papel:    '80',
    copias_comanda: 1,
    pie_ticket:     '',
    resolucion_dian: '',
  },
};

// ── Helpers parse / serialize ─────────────────────────────────────────────────

/** Parsea un valor almacenado en DB (string JSON) al tipo T */
export function parseConfigValue<T>(value: string | undefined | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/** Serializa un valor tipado a string JSON para guardar en DB */
export function serializeConfigValue(value: unknown): string {
  return JSON.stringify(value);
}

// ── Claves conocidas por scope ───────────────────────────────────────────────

export const CONFIG_KEYS = {
  navegacion: {
    items_ocultos: 'items_ocultos',
    orden_items:   'orden_items',
  },
  apariencia: {
    nombre_sistema: 'nombre_sistema',
    color_primario: 'color_primario',
    logo_url:       'logo_url',
  },
  impresion: {
    ancho_papel:    'ancho_papel',
    copias_comanda: 'copias_comanda',
    pie_ticket:     'pie_ticket',
    resolucion_dian: 'resolucion_dian',
  },
} as const;

export type ConfigScope = keyof typeof CONFIG_KEYS;
