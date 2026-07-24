/**
 * tokens.ts — Fuente única de verdad del lenguaje visual.
 *
 * ── El problema que resuelve ────────────────────────────────────────────────
 *
 * Antes de esto convivían dos sistemas de diseño sin autoridad común:
 *   · 41 archivos con MUI, 19 con Tailwind puro
 *   · 52 colores hex escritos a mano en los .tsx
 *   · 13 familias de color de Tailwind en uso simultáneo
 *   · el tema MUI definía SOLO palette.primary.main — sin tipografía ni radios
 *
 * La consecuencia visible era que el color de marca que el cliente elige en
 * Apariencia solo llegaba al login y al panel admin. La pantalla de Órdenes,
 * donde el cajero pasa el turno completo, seguía verde esmeralda pasara lo que
 * pasara. Una promesa white-label rota.
 *
 * ── Cómo funciona el puente ─────────────────────────────────────────────────
 *
 *   tokens.ts  →  theme/index.ts  →  CSS variables en :root
 *                        ↓                    ↓
 *                   tema MUI          tailwind.config.js
 *
 * Los dos mundos leen los MISMOS valores. Cambiar un token aquí cambia las 66
 * pantallas, sean MUI o Tailwind.
 *
 * ── Formato de color ────────────────────────────────────────────────────────
 *
 * Los colores se guardan como canales RGB separados por espacio ("229 57 53"),
 * no como hex. Es lo que exige Tailwind para poder aplicar opacidad sobre una
 * CSS variable: `rgb(var(--brand-500) / <alpha-value>)` permite escribir
 * `bg-brand-500/20`. Con un hex en la variable, esa sintaxis no funciona.
 */

import { darken, decomposeColor, lighten } from '@mui/material/styles';

// ── Tipos ─────────────────────────────────────────────────────────────────────

/** Paradas de la escala. Coinciden con las de Tailwind para no reeducar a nadie. */
export type Parada = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

/** Rampa completa de un color. Los valores son canales RGB: "229 57 53". */
export type Rampa = Record<Parada, string>;

export const PARADAS: Parada[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

// ── Colores semánticos ────────────────────────────────────────────────────────
//
// Se nombran por SIGNIFICADO, no por tinte. Antes el código decía `bg-emerald-50`
// en un sitio y `bg-green-100` en otro para la misma idea ("esto salió bien"), y
// por eso había 13 familias de color en uso.
//
// Los valores salen de la paleta de Tailwind que la app ya usaba (emerald, amber,
// red, sky, slate): son escalas bien construidas y mantienen la app reconocible.
// Lo que cambia no es el color, es que ahora hay UN nombre por concepto.

export const SEMANTICOS: Record<'exito' | 'alerta' | 'peligro' | 'info' | 'neutro', Rampa> = {
  // Verde — operación completada, stock sano, orden lista, ganancia
  exito: {
    50: '236 253 245', 100: '209 250 229', 200: '167 243 208', 300: '110 231 183',
    400: '52 211 153',  500: '16 185 129',  600: '5 150 105',   700: '4 120 87',
    800: '6 95 70',     900: '6 78 59',
  },
  // Ámbar — requiere atención pero no está roto: stock bajo, orden pendiente
  alerta: {
    50: '255 251 235', 100: '254 243 199', 200: '253 230 138', 300: '252 211 77',
    400: '251 191 36',  500: '245 158 11',  600: '217 119 6',   700: '180 83 9',
    800: '146 64 14',   900: '120 53 15',
  },
  // Rojo — error, cancelación, vencido, pérdida
  peligro: {
    50: '254 242 242', 100: '254 226 226', 200: '254 202 202', 300: '252 165 165',
    400: '248 113 113', 500: '239 68 68',   600: '220 38 38',   700: '185 28 28',
    800: '153 27 27',   900: '127 29 29',
  },
  // Azul — información neutra, en proceso, enlaces
  info: {
    50: '240 249 255', 100: '224 242 254', 200: '186 230 253', 300: '125 211 252',
    400: '56 189 248',  500: '14 165 233',  600: '2 132 199',   700: '3 105 161',
    800: '7 89 133',    900: '12 74 110',
  },
  // Gris — texto, bordes, fondos. La escala más usada de toda la app (1.262 usos).
  neutro: {
    50: '248 250 252', 100: '241 245 249', 200: '226 232 240', 300: '203 213 225',
    400: '148 163 184', 500: '100 116 139', 600: '71 85 105',   700: '51 65 85',
    800: '30 41 59',    900: '15 23 42',
  },
};

// ── Rampa de marca (derivada en tiempo de ejecución) ──────────────────────────

/**
 * Cuánto se aclara/oscurece el color base en cada parada.
 *
 * La 500 es el color exacto que eligió el cliente — no se toca, porque es el que
 * aprobó y el que espera ver en su logo. El resto se deriva alrededor.
 */
const MEZCLA: Record<Parada, number> = {
  50: 0.95, 100: 0.88, 200: 0.74, 300: 0.56, 400: 0.30,
  500: 0,
  600: 0.15, 700: 0.30, 800: 0.45, 900: 0.60,
};

/** Convierte cualquier color CSS a canales RGB: "#e53935" → "229 57 53". */
function aCanales(color: string): string {
  const { values } = decomposeColor(color);
  return `${Math.round(values[0])} ${Math.round(values[1])} ${Math.round(values[2])}`;
}

/**
 * Construye la rampa 50–900 a partir del color de marca del tenant.
 *
 * Usa lighten/darken de MUI en vez de una implementación propia: ya son una
 * dependencia del proyecto, están probadas y manejan los formatos de color raros
 * (rgb, hsl, hex de 3 y 6 dígitos) que un cliente puede pegar en Apariencia.
 *
 * Si el color es inválido (un cliente escribió cualquier cosa en el campo de
 * texto), cae al color por defecto en vez de dejar la app sin marca.
 */
export function construirRampaMarca(colorBase: string): Rampa {
  let base = colorBase;
  try {
    decomposeColor(base);
  } catch {
    base = '#e53935';
  }

  return PARADAS.reduce((rampa, parada) => {
    const coef = MEZCLA[parada];
    const color =
      parada === 500 ? base
      : parada < 500 ? lighten(base, coef)
      : darken(base, coef);
    rampa[parada] = aCanales(color);
    return rampa;
  }, {} as Rampa);
}

// ── Radios ────────────────────────────────────────────────────────────────────
//
// El desajuste real no estaba en Tailwind sino entre los dos sistemas: las
// páginas Tailwind usan rounded-xl (269 usos, 12px) y rounded-lg (130, 8px),
// mientras MUI se quedaba en su default de 4px. Por eso una tarjeta MUI y una
// tarjeta Tailwind, lado a lado, parecían de productos distintos.
//
// La corrección es subir MUI hasta donde ya está Tailwind, NO mover Tailwind:
// cambiar rounded-xl a 20px habría redondeado 269 sitios de golpe sin que nadie
// lo pidiera. Estos valores son exactamente los de Tailwind.

export const RADIO = {
  sm: 4,   // chips, badges          → rounded
  md: 8,   // botones, campos        → rounded-lg
  lg: 12,  // tarjetas, paneles      → rounded-xl
  xl: 16,  // modales, hojas         → rounded-2xl
  full: 9999,
} as const;

// ── Sombras ───────────────────────────────────────────────────────────────────
//
// Antes cinco niveles (sm/md/lg/xl/2xl) usados indistintamente: había tarjetas
// con shadow-lg junto a otras con shadow-sm sin diferencia jerárquica real.
// Tres niveles bastan y hacen la jerarquía legible.

export const SOMBRA = {
  sm: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
  md: '0 2px 4px -1px rgb(15 23 42 / 0.05), 0 4px 12px -2px rgb(15 23 42 / 0.08)',
  lg: '0 8px 16px -4px rgb(15 23 42 / 0.08), 0 20px 32px -8px rgb(15 23 42 / 0.12)',
} as const;

// ── Tipografía ────────────────────────────────────────────────────────────────
//
// Diagnóstico: text-xs (403 usos) y text-sm (425) dominan la app — casi todo el
// producto está en 12 y 14px. En una caja con luz de local, y sobre todo en el
// KDS visto a 2-3 metros, eso no se lee.
//
// Decisión: la escala se queda en los valores de Tailwind y NO se encoge nada.
// Redefinir `sm` a 13px habría reducido el texto en 425 sitios de golpe — lo
// contrario de lo que hace falta. El arreglo real es migrar cada pantalla del
// par xs/sm hacia base/lg cuando se rediseñe (fases 2 y 4); el token solo tiene
// que ofrecer los peldaños para hacerlo.
//
// Lo único que se añade es `4xl`, que no existía y que el KDS necesita.

export const FUENTE =
  "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** Monoespaciada para códigos, SKUs, números de orden y hashes de documentos. */
export const FUENTE_MONO =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export const TEXTO = {
  xs:   { size: '0.75rem',  line: '1rem'    }, // 12px — solo metadatos densos
  sm:   { size: '0.875rem', line: '1.25rem' }, // 14px — texto secundario
  base: { size: '1rem',     line: '1.5rem'  }, // 16px — cuerpo por defecto
  lg:   { size: '1.125rem', line: '1.75rem' }, // 18px — subtítulos
  xl:   { size: '1.25rem',  line: '1.75rem' }, // 20px — títulos de sección
  '2xl':{ size: '1.5rem',   line: '2rem'    }, // 24px — título de página
  '3xl':{ size: '1.875rem', line: '2.25rem' }, // 30px — cifras destacadas
  '4xl':{ size: '2.5rem',   line: '2.75rem' }, // 40px — KDS, lectura a 2-3 m
} as const;

// ── Espaciado ─────────────────────────────────────────────────────────────────
//
// Deliberadamente NO se unifica. MUI usa 8px por unidad y Tailwind 4px, así que
// `p: 3` (MUI, 24px) y `p-3` (Tailwind, 12px) no son lo mismo. Es confuso al
// leer el código, pero alinearlos exigía bajar MUI a 4px y eso reduciría a la
// mitad los 711 usos de espaciado numérico que ya existen en los .tsx.
//
// Cada sistema es coherente consigo mismo. Se documenta la trampa en vez de
// romper 711 sitios por resolverla.

// ── Alturas mínimas táctiles ──────────────────────────────────────────────────
//
// El POS se usa en tablet. WCAG 2.5.5 pide 44×44px para un objetivo táctil, y
// hoy hay botones de 28px de alto. Se declara aquí para que el POS lo aplique.

export const TOQUE = {
  minimo:  44, // requisito táctil
  compacto: 36, // tablas densas de escritorio, solo con ratón
} as const;
