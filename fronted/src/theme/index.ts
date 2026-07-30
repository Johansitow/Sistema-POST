/**
 * theme/index.ts — El puente entre MUI y Tailwind.
 *
 * Construye dos cosas a partir de los mismos tokens:
 *
 *   1. El tema de MUI     → lo consumen los 41 archivos con componentes MUI
 *   2. Las CSS variables  → las lee tailwind.config.js, y con eso los 19
 *                           archivos de Tailwind puro quedan bajo el mismo
 *                           lenguaje visual
 *
 * Ese segundo punto es el que arregla el white-label: hasta ahora el color que
 * el cliente elegía en Apariencia moría en `palette.primary.main` y no tocaba
 * ninguna de las pantallas operativas.
 *
 * Ver src/theme/tokens.ts para el detalle de cada escala.
 */

import { createTheme, type Theme } from '@mui/material/styles';
import {
  construirRampaMarca,
  FUENTE,
  PARADAS,
  RADIO,
  SEMANTICOS,
  SOMBRA,
  TEXTO,
  TOQUE,
  type Rampa,
} from './tokens';

// ── CSS variables ─────────────────────────────────────────────────────────────

/** Vuelca una rampa como pares `--prefijo-parada: "R G B"`. */
function volcarRampa(prefijo: string, rampa: Rampa): Record<string, string> {
  return PARADAS.reduce<Record<string, string>>((acc, parada) => {
    acc[`--${prefijo}-${parada}`] = rampa[parada];
    return acc;
  }, {});
}

/**
 * Genera el bloque `:root` con todas las variables de color.
 *
 * Se inyecta con <GlobalStyles> de MUI (ver App.tsx) en vez de escribirlo en
 * index.css, porque la rampa de marca depende del color que el tenant guardó en
 * la base de datos y por tanto no se conoce en tiempo de compilación.
 */
export function construirVariablesCSS(colorPrimario: string): Record<string, Record<string, string>> {
  return {
    ':root': {
      ...volcarRampa('brand',   construirRampaMarca(colorPrimario)),
      ...volcarRampa('exito',   SEMANTICOS.exito),
      ...volcarRampa('alerta',  SEMANTICOS.alerta),
      ...volcarRampa('peligro', SEMANTICOS.peligro),
      ...volcarRampa('info',    SEMANTICOS.info),
      ...volcarRampa('neutro',  SEMANTICOS.neutro),

      // Consumidas por index.css (scrollbar y anillo de foco)
      '--scrollbar-track':       `rgb(${SEMANTICOS.neutro[100]})`,
      '--scrollbar-thumb':       `rgb(${SEMANTICOS.neutro[300]})`,
      '--scrollbar-thumb-hover': `rgb(${SEMANTICOS.neutro[400]})`,
    },
  };
}

// ── Tema MUI ──────────────────────────────────────────────────────────────────

/** `rgb(...)` a partir de una parada de rampa, para usar dentro del tema. */
const rgb = (canales: string) => `rgb(${canales})`;

/**
 * Construye el tema completo de MUI.
 *
 * Antes esto era `createTheme({ palette: { primary: { main: colorPrimario } } })`
 * y nada más. Sin tipografía MUI caía a Roboto y sin `shape` a un radio de 4px,
 * mientras Tailwind usaba system-ui con radio de 12px: dos lenguajes visuales
 * conviviendo en la misma pantalla.
 */
export function construirTema(colorPrimario: string): Theme {
  const marca = construirRampaMarca(colorPrimario);

  return createTheme({
    // ── Espaciado: se deja el default de MUI (8px por unidad) ──
    //
    // Es cierto que `p: 3` en MUI (24px) y `p-3` en Tailwind (12px) no son lo
    // mismo, pero bajar MUI a 4px habría reducido a la mitad los 711 usos de
    // espaciado numérico que ya existen en los .tsx. Cada sistema es coherente
    // consigo mismo; la confusión es de nomenclatura, no de render, y no
    // justifica romper 711 sitios.

    shape: { borderRadius: RADIO.lg },

    palette: {
      primary: {
        main:         rgb(marca[500]),
        light:        rgb(marca[300]),
        dark:         rgb(marca[700]),
        contrastText: '#fff',
      },
      success: { main: rgb(SEMANTICOS.exito[600]),   light: rgb(SEMANTICOS.exito[100]),   dark: rgb(SEMANTICOS.exito[800])   },
      warning: { main: rgb(SEMANTICOS.alerta[600]),  light: rgb(SEMANTICOS.alerta[100]),  dark: rgb(SEMANTICOS.alerta[800])  },
      error:   { main: rgb(SEMANTICOS.peligro[600]), light: rgb(SEMANTICOS.peligro[100]), dark: rgb(SEMANTICOS.peligro[800]) },
      info:    { main: rgb(SEMANTICOS.info[600]),    light: rgb(SEMANTICOS.info[100]),    dark: rgb(SEMANTICOS.info[800])    },
      divider: rgb(SEMANTICOS.neutro[200]),
      text: {
        primary:   rgb(SEMANTICOS.neutro[800]),
        secondary: rgb(SEMANTICOS.neutro[500]),
        disabled:  rgb(SEMANTICOS.neutro[400]),
      },
      background: {
        default: rgb(SEMANTICOS.neutro[50]),
        paper:   '#ffffff',
      },
    },

    typography: {
      fontFamily: FUENTE,
      // 15px de base en vez de los 16px de MUI: la app es densa y 15 encaja mejor
      // con la escala de Tailwind sin encoger el texto secundario.
      fontSize: 15,
      h1: { fontSize: TEXTO['3xl'].size, lineHeight: TEXTO['3xl'].line, fontWeight: 800, letterSpacing: '-0.02em' },
      h2: { fontSize: TEXTO['2xl'].size, lineHeight: TEXTO['2xl'].line, fontWeight: 800, letterSpacing: '-0.02em' },
      h3: { fontSize: TEXTO.xl.size,     lineHeight: TEXTO.xl.line,     fontWeight: 700, letterSpacing: '-0.01em' },
      h4: { fontSize: TEXTO.lg.size,     lineHeight: TEXTO.lg.line,     fontWeight: 700 },
      h5: { fontSize: TEXTO.lg.size,     lineHeight: TEXTO.lg.line,     fontWeight: 700 },
      h6: { fontSize: TEXTO.base.size,   lineHeight: TEXTO.base.line,   fontWeight: 700 },
      body1:    { fontSize: TEXTO.base.size, lineHeight: TEXTO.base.line },
      body2:    { fontSize: TEXTO.sm.size,   lineHeight: TEXTO.sm.line   },
      caption:  { fontSize: TEXTO.xs.size,   lineHeight: TEXTO.xs.line   },
      button:   { fontSize: TEXTO.sm.size,   fontWeight: 600, textTransform: 'none' },
      overline: { fontSize: TEXTO.xs.size,   fontWeight: 700, letterSpacing: '0.08em' },
    },

    components: {
      // `textTransform: none` — el MAYÚSCULAS por defecto de MUI choca con los
      // botones de Tailwind, que nunca lo tuvieron.
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: RADIO.md, minHeight: TOQUE.compacto, paddingInline: 14 },
          sizeLarge: { minHeight: TOQUE.minimo, fontSize: TEXTO.base.size },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            borderRadius: RADIO.lg,
            border: `1px solid ${rgb(SEMANTICOS.neutro[200])}`,
            boxShadow: SOMBRA.sm,
          },
        },
      },
      MuiPaper: { styleOverrides: { rounded: { borderRadius: RADIO.lg } } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: RADIO.xl } } },
      MuiTextField: { defaultProps: { size: 'small' } },
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: RADIO.md } } },
      MuiChip: { styleOverrides: { root: { borderRadius: RADIO.sm, fontWeight: 600 } } },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: RADIO.sm,
            fontSize: TEXTO.xs.size,
            backgroundColor: rgb(SEMANTICOS.neutro[800]),
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: rgb(SEMANTICOS.neutro[200]) },
          head: {
            fontWeight: 700,
            fontSize: TEXTO.xs.size,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: rgb(SEMANTICOS.neutro[500]),
            backgroundColor: rgb(SEMANTICOS.neutro[50]),
          },
        },
      },
    },
  });
}
