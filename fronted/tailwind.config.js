/**
 * tailwind.config.js — El otro extremo del puente de tokens.
 *
 * Los colores NO se declaran aquí: se leen de las CSS variables que emite
 * src/theme/index.ts a partir de src/theme/tokens.ts. Así el color de marca que
 * el cliente guarda en Apariencia llega también a los 19 archivos de Tailwind
 * puro — entre ellos Órdenes, Dashboard, Cocina e Inventario, que antes se
 * quedaban con el azul/verde quemado a mano.
 *
 * La sintaxis `rgb(var(--x) / <alpha-value>)` es la que permite seguir usando
 * modificadores de opacidad (`bg-brand-500/20`) sobre una variable. Por eso las
 * variables guardan canales sueltos ("229 57 53") y no un hex.
 *
 * Nombres semánticos, no tintes: `exito` en vez de `emerald`, `peligro` en vez
 * de `red`. Antes había 13 familias de color en uso para ~5 conceptos.
 */

/** Azúcar para no repetir la plantilla en cada parada. */
const rampa = (nombre) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((parada) => [
      parada,
      `rgb(var(--${nombre}-${parada}) / <alpha-value>)`,
    ]),
  );

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand:   rampa('brand'),
        exito:   rampa('exito'),
        alerta:  rampa('alerta'),
        peligro: rampa('peligro'),
        info:    rampa('info'),
        neutro:  rampa('neutro'),

        // Alias de compatibilidad: `primary` era la escala azul quemada que ya
        // no existe. Ahora apunta a la marca del tenant para que cualquier uso
        // heredado quede correcto en vez de romperse.
        primary: rampa('brand'),
      },

      fontFamily: {
        // Debe coincidir con FUENTE de src/theme/tokens.ts. Sin esto MUI
        // renderiza en Inter y Tailwind en system-ui, en la misma pantalla.
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },

      // Espejo de TEXTO en tokens.ts. Se mantienen los valores por defecto de
      // Tailwind a propósito: hay 828 usos de text-xs/text-sm, y redefinir `sm`
      // más pequeño los habría encogido todos de golpe. La corrección de
      // legibilidad se hace migrando usos pantalla por pantalla, no bajando el
      // token. Lo único nuevo es `4xl`, para el KDS.
      fontSize: {
        '4xl': ['2.5rem', { lineHeight: '2.75rem' }],
      },

      // Los radios NO se redefinen: RADIO en tokens.ts ya adopta los valores de
      // Tailwind y sube MUI hasta ellos. Tocarlos aquí habría redondeado 269
      // usos de rounded-xl sin motivo.

      // Las sombras sí se suavizan. Antes había cinco niveles usados
      // indistintamente (había tarjetas con shadow-lg junto a otras con
      // shadow-sm sin diferencia jerárquica real); estos tres son más suaves y
      // hacen legible la elevación. Es un cambio sutil y reversible.
      boxShadow: {
        sm: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        md: '0 2px 4px -1px rgb(15 23 42 / 0.05), 0 4px 12px -2px rgb(15 23 42 / 0.08)',
        lg: '0 8px 16px -4px rgb(15 23 42 / 0.08), 0 20px 32px -8px rgb(15 23 42 / 0.12)',
      },

      // Objetivo táctil mínimo de WCAG 2.5.5 — el POS se usa en tablet.
      minHeight: { toque: '44px' },
      minWidth:  { toque: '44px' },
    },
  },
  plugins: [],
};
