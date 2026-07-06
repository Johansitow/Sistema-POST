/**
 * PlantillaPreview — Panel de vista previa en vivo para el editor de plantillas.
 *
 * Usa buildComandaHTML / buildFacturaHTML del mismo ticketRenderer que usa print.ts,
 * garantizando que preview ≡ impresión real (mismo CSS, mismo HTML).
 *
 * Los datos de muestra vienen de ejemploDatos.ts (fuente única).
 */

import { useMemo, useState, useRef, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
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

// ── componente ────────────────────────────────────────────────────────────────

export interface PlantillaPreviewProps {
  tipo:   TipoPlantilla;
  config: PlantillaConfig;
}

export function PlantillaPreview({ tipo, config }: PlantillaPreviewProps) {
  const html = useMemo(() => {
    const tmpl = configToTmpl(config);
    const body = (tipo === 'comanda' || tipo === 'cocina')
      ? buildComandaHTML(ORDEN_EJEMPLO, tmpl)
      : buildFacturaHTML(ORDEN_EJEMPLO, PAGOS_EJEMPLO, NEGOCIO_EJEMPLO, undefined, tmpl);
    return buildFullHTML(body, tmpl);
  }, [tipo, config]);

  // ── Altura elástica ─────────────────────────────────────────────────────────
  // El iframe reporta su altura real mediante ResizeObserver sobre el body del
  // documento cargado. Un rAF tras el load garantiza que el layout esté completo
  // antes de leer scrollHeight (onLoad sintético mide antes del layout → siempre 0).
  // El ResizeObserver re-mide automáticamente cuando cambia el contenido (secciones,
  // ancho de papel, tamaño de fuente) sin necesidad de lógica por-ancho.
  const [iframeHeight, setIframeHeight] = useState<number>(200);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let ro: ResizeObserver | null = null;

    const measure = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;
      const h = Math.max(
        doc.body?.scrollHeight              ?? 0,
        doc.documentElement?.scrollHeight   ?? 0,
      );
      if (h > 0) setIframeHeight(h);
    };

    const onLoad = () => {
      ro?.disconnect();
      // rAF: espera al primer frame después del parse para que el layout esté listo.
      requestAnimationFrame(() => {
        measure();
        const body = iframe.contentDocument?.body;
        if (body) {
          // ResizeObserver re-mide cuando el contenido crece/encoge (reactivo a cambios).
          ro = new ResizeObserver(measure);
          ro.observe(body);
        }
      });
    };

    iframe.addEventListener('load', onLoad);
    return () => {
      iframe.removeEventListener('load', onLoad);
      ro?.disconnect();
    };
  }, []); // una sola vez — el listener 'load' persiste y se dispara en cada srcDoc nuevo

  const widthPx = paperWidthPx(config.config.paperWidth);

  return (
    <Box
      sx={{
        display:        'flex',
        flexDirection:  'column',
        height:         '100%',
        background:     '#e8e8e8',
        borderRadius:   2,
        overflow:       'hidden',
      }}
    >
      {/* Barra de título */}
      <Box sx={{ px: 2, py: 1, background: '#d0d0d0', borderBottom: '1px solid #bbb' }}>
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
          overflow:       'auto',
          display:        'flex',
          justifyContent: 'center',
          py:             3,
          px:             2,
        }}
      >
        <Box
          sx={{
            width:        widthPx,
            flexShrink:   0,
            background:   'white',
            boxShadow:    '0 4px 24px rgba(0,0,0,0.32), 0 1px 6px rgba(0,0,0,0.18)',
            borderRadius: '1px',
          }}
        >
          <iframe
            ref={iframeRef}
            data-testid="preview-iframe"
            srcDoc={html}
            scrolling="no"
            style={{ width: '100%', height: iframeHeight, border: 'none', display: 'block' }}
            title="Vista previa de impresión"
          />
        </Box>
      </Box>
    </Box>
  );
}
