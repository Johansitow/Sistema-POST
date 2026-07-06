/**
 * onboarding.types.ts — tipos del wizard de configuración inicial.
 *
 * Deben coincidir con la respuesta real del backend (PerfilResuelta).
 * Fuente: backend/src/lib/onboarding/resolverPerfil.ts
 */

export type NivelConfig = 'grupo' | 'sede';

export interface FlagSalida {
  nombre:    string;
  habilitado: boolean;
  nivel:     NivelConfig;
}

export interface ConfigSalida {
  clave: string;
  valor: string;
  nivel: NivelConfig;
}

/** Flag que quedaría activo pero cuyo módulo-padre fue apagado. */
export interface HuerfanoDetectado {
  clave:      string;
  dependeDe:  string;
  motivo:     string;
}

/** Respuesta del endpoint POST /onboarding/apply (preview o apply). */
export interface PerfilResuelta {
  flags:   FlagSalida[];
  configs: ConfigSalida[];
  /** Orphans que el apply desactivó en cascada (o que el preview advierte). */
  desactivadosPorDependencia?: HuerfanoDetectado[];
  /** Orphans que no se pudieron desactivar porque es_editable=false. */
  omitidosPorDependencia?:     HuerfanoDetectado[];
}

/** Cuerpo del POST /onboarding/apply */
export interface EntradaOnboarding {
  /** Slug del arquetipo (preset de ejes). */
  arquetipo?: string;
  /** Overrides del usuario aplicados encima del preset. */
  ejes?: Record<string, string>;
}
