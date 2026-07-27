/**
 * PlantillaPreview — Panel de vista previa en vivo para el editor de plantillas.
 *
 * Usa buildComandaHTML / buildFacturaHTML del mismo ticketRenderer que usa print.ts,
 * garantizando que preview ≡ impresión real (mismo CSS, mismo HTML).
 *
 * Los datos de muestra vienen de ejemploDatos.ts (fuente única).
 *
 * La "hoja" imita un rollo térmico: ancho fijo (según los mm elegidos) y alto
 * variable que CRECE y ENCOGE con el contenido. El alto no es fijo: se deriva
 * midiendo el body del iframe con un ResizeObserver (ver más abajo).
 */

import { useMemo, useState, useRef, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import ReceiptLong from '@mui/icons-material/ReceiptLong';
import {
  buildComandaHTML,
  buildFacturaHTML,
  buildFullHTML,
} from '../../lib/plantillas/ticketRenderer';
import type { PrintTemplateConfig } from '../../lib/plantillas/ticketRenderer';
import {
  ORDEN_EJEMPLO,
  PAGOS_EJEMPLO,
  NEGOCIO_EJEMPLO,
} from '../../lib/plantillas/ejemploDatos';
import type { TipoPlantilla, PlantillaConfig } from '../../services/plantillas.service';
import { SOMBRA, RADIO } from '../../theme/tokens';

// ── helpers ───────────────────────────────────────────────────────────────────

/** Convierte PlantillaConfig (formato editor/BD) a PrintTemplateConfig (formato renderer). */
export function configToTmpl(config: PlantillaConfig): PrintTemplateConfig {
  return {
    paperWidth: config.config.paperWidth,
    fontSize:   config.config.fontSize as 'small' | 'medium' | 'large',
    showLogo:   config.config.showLogo,
    sections:   config.sections,
  };
}

/** Ancho en píxeles para representar el papel en pantalla. */
function paperWidthPx(paperWidth: string): number {
  if (paperWidth === '58mm') return 220;
  if (paperWidth === 'A4')   return 560;
  return 302; // 80mm default
}

// Grises/bordes del sistema de diseño (variables CSS inyectadas en :root por App.tsx).
const GRIS_FONDO  = 'rgb(var(--neutro-200))'; // lienzo detrás del papel
const GRIS_BARRA  = 'rgb(var(--neutro-100))'; // barra de título
const GRIS_BORDE  = 'rgb(var(--neutro-200))'; // divisores

// Diente del recorte térmico (zig-zag) en px. Un solo valor, mismo para 80/58/A4.
const DIENTE = 10;

// ── componente ────────────────────────────────────────────────────────────────

export interface PlantillaPreviewProps {
  tipo:   TipoPlantilla;
  config: PlantillaConfig;
}

export function PlantillaPreview({ tipo, config }: PlantillaPreviewProps) {
  // El cuerpo del ticket se calcula aparte para poder detectar el estado vacío
  // (todas las secciones ocultas → body en blanco) antes de armar el documento.
  const { html, isEmpty } = useMemo(() => {
    const tmpl = configToTmpl(config);
    const body = (tipo === 'comanda' || tipo === 'cocina')
      ? buildComandaHTML(ORDEN_EJEMPLO, tmpl)
      : buildFacturaHTML(ORDEN_EJEMPLO, PAGOS_EJEMPLO, NEGOCIO_EJEMPLO, undefined, tmpl);
    return { html: buildFullHTML(body, tmpl), isEmpty: body.trim() === '' };
  }, [tipo, config]);

  // ── Altura elástica ─────────────────────────────────────────────────────────
  // El alto de la hoja se DERIVA del contenido, no es fijo. Se mide SOLO el body
  // del iframe: su CSS fija width en mm pero deja el height en auto, así que la
  // altura del body sigue al contenido tanto al crecer como al encoger.
  //
  // No se usa documentElement.scrollHeight: en un iframe html.scrollHeight nunca
  // baja del alto del viewport (scrollHeight ≥ clientHeight), de modo que una vez
  // que el iframe crece ya no podría volver a encoger. Medir el body lo evita.
  //
  // El ResizeObserver re-mide en cada reflow (fuente cargada, logo, etc.). El
  // efecto se re-ejecuta con [html]: al cambiar ancho, tamaño de texto, secciones
  // o pie, el srcDoc cambia, el iframe recarga y se vuelve a enganchar y medir.
  const [sheetHeight, setSheetHeight] = useState<number>(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (isEmpty) { setSheetHeight(0); return; }
    const iframe = iframeRef.current;
    if (!iframe) return;

    let ro: ResizeObserver | null = null;

    const measure = () => {
      const body = iframe.contentDocument?.body;
      if (!body) return;
      const h = Math.max(body.scrollHeight, Math.ceil(body.getBoundingClientRect().height));
      if (h > 0) setSheetHeight(h);
    };

    const attach = () => {
      ro?.disconnect();
      const body = iframe.contentDocument?.body;
      if (!body) return;
      measure();
      // Re-mide automáticamente cuando el contenido reflowa (reactivo a cambios).
      ro = new ResizeObserver(measure);
      ro.observe(body);
    };

    // rAF: espera al primer frame tras el parse para que el layout esté listo.
    const onLoad = () => requestAnimationFrame(attach);
    iframe.addEventListener('load', onLoad);

    // El documento puede haber cargado antes de montar este efecto (srcDoc ya
    // presente tras un re-render): engancha de inmediato si el body existe.
    if (iframe.contentDocument?.body) requestAnimationFrame(attach);

    return () => {
      iframe.removeEventListener('load', onLoad);
      ro?.disconnect();
    };
  }, [html, isEmpty]);

  const widthPx = paperWidthPx(config.config.paperWidth);

  return (
    <Box
      sx={{
        display:        'flex',
        flexDirection:  'column',
        height:         '100%',
        background:     GRIS_FONDO,
        borderRadius:   `${RADIO.lg}px`,
        overflow:       'hidden',
      }}
    >
      {/* Barra de título */}
      <Box sx={{ px: 2, py: 1, background: GRIS_BARRA, borderBottom: `1px solid ${GRIS_BORDE}` }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary">
          VISTA PREVIA — {config.config.paperWidth} · {
            config.config.fontSize === 'small'  ? 'Texto pequeño' :
            config.config.fontSize === 'large'  ? 'Texto grande'  : 'Texto mediano'
          }
        </Typography>
      </Box>

      {/* Área de papel — scroll en el panel, no en el ticket */}
      <Box
        sx={{
          flex:           1,
          minHeight:      0,           // permite que overflow-y funcione dentro del flex
          overflowY:      'auto',
          overflowX:      'hidden',
          display:        'flex',
          justifyContent: 'center',
          alignItems:     isEmpty ? 'center' : 'flex-start',
          py:             3,
          px:             2,
        }}
      >
        {isEmpty ? (
          // Placeholder discreto (no una hoja rota vacía). Se replica el estilo de
          // EmptyState en vez de importarlo: EmptyState arrastra el barrel de
          // @mui/icons-material, que satura los descriptores de archivo en test.
          <Box
            sx={{
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            1.25,
              px:             3,
              textAlign:      'center',
              color:          'text.secondary',
            }}
          >
            <ReceiptLong sx={{ fontSize: 44, color: 'text.disabled' }} />
            <Typography variant="body1" fontWeight={500} color="text.secondary">
              Sin contenido para previsualizar
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Activa al menos una sección para ver el ticket.
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              position:     'relative',
              width:        widthPx,
              flexShrink:   0,
              bgcolor:      'background.paper', // papel térmico: blanco del tema
              boxShadow:    SOMBRA.lg,
              borderRadius: `${RADIO.sm}px`,
              // Espacio para que el contenido no toque el recorte térmico.
              py:           `${DIENTE}px`,
              // Recorte térmico (zig-zag) arriba y abajo: triángulos del color del
              // fondo gris pintados sobre el borde blanco del papel.
              '&::before, &::after': {
                content:      '""',
                position:     'absolute',
                left:         0,
                right:        0,
                height:       `${DIENTE}px`,
                background: `
                  linear-gradient(-45deg, ${GRIS_FONDO} 50%, transparent 0) 0 0,
                  linear-gradient( 45deg, ${GRIS_FONDO} 50%, transparent 0) 0 0`,
                backgroundSize:   `${DIENTE * 2}px ${DIENTE}px`,
                backgroundRepeat: 'repeat-x',
              },
              '&::before': { top: 0, transform: 'scaleY(-1)' }, // dientes apuntando hacia adentro
              '&::after':  { bottom: 0 },
            }}
          >
            <iframe
              ref={iframeRef}
              data-testid="preview-iframe"
              srcDoc={html}
              scrolling="no"
              style={{
                width:   '100%',
                height:  sheetHeight || undefined,
                border:  'none',
                display: 'block',
              }}
              title="Vista previa de impresión"
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
