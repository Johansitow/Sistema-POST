/**
 * DocumentoPreviewA4 — chrome de vista previa para documentos laborales (A4).
 *
 * El HTML lo genera SIEMPRE el backend (valor probatorio); aquí solo se muestra
 * dentro de un iframe. Reusa el patrón ya pulido de PlantillaPreview: hoja blanca
 * centrada sobre un lienzo gris con scroll, sombra suave y alto ELÁSTICO medido
 * con ResizeObserver sobre el body del iframe (crece y encoge con el contenido),
 * pero con ancho A4 en vez de rollo térmico.
 */

import { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { SOMBRA, RADIO } from '../../theme/tokens';

// A4 = 210mm de ancho. Se representa a un ancho fijo en px (≈96dpi) y la hoja
// crece en alto según el contenido. Un solo valor, sin lógica por-tamaño.
const A4_ANCHO_PX = 794; // 210mm @ 96dpi

// Grises del sistema de diseño (variables CSS inyectadas en :root por App.tsx).
const GRIS_FONDO = 'rgb(var(--neutro-200))';

interface DocumentoPreviewA4Props {
  html: string;
}

export function DocumentoPreviewA4({ html }: DocumentoPreviewA4Props) {
  // El alto se DERIVA del contenido: se mide SOLO el body (su altura es
  // content-driven), no documentElement, que en un iframe nunca baja del alto
  // del viewport y por eso impediría encoger.
  const [sheetHeight, setSheetHeight] = useState<number>(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
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
      ro = new ResizeObserver(measure);
      ro.observe(body);
    };

    const onLoad = () => requestAnimationFrame(attach);
    iframe.addEventListener('load', onLoad);
    if (iframe.contentDocument?.body) requestAnimationFrame(attach);

    return () => {
      iframe.removeEventListener('load', onLoad);
      ro?.disconnect();
    };
  }, [html]);

  return (
    <Box
      sx={{
        background:     GRIS_FONDO,
        borderRadius:   `${RADIO.lg}px`,
        overflowY:      'auto',
        overflowX:      'auto',
        display:        'flex',
        justifyContent: 'center',
        py:             3,
        px:             2,
        maxHeight:      '70vh',
      }}
    >
      <Box
        sx={{
          width:        A4_ANCHO_PX,
          flexShrink:   0,
          bgcolor:      'background.paper',
          boxShadow:    SOMBRA.lg,
          borderRadius: `${RADIO.sm}px`,
        }}
      >
        <iframe
          ref={iframeRef}
          data-testid="documento-preview-iframe"
          srcDoc={html}
          scrolling="no"
          style={{
            width:   '100%',
            height:  sheetHeight || undefined,
            border:  'none',
            display: 'block',
          }}
          title="Vista previa del documento"
        />
      </Box>
    </Box>
  );
}
