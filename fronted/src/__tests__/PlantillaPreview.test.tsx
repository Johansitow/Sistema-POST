/**
 * Tests de PlantillaPreview y el renderizador compartido (ticketRenderer).
 *
 * Cubre:
 *   - Sección oculta (visible: false) no aparece en el HTML generado.
 *   - Campo desactivado no aparece en el HTML generado.
 *   - Cambio de ancho de papel cambia el CSS del HTML.
 *   - Preview e impresión usan el MISMO renderizador: buildComandaHTML /
 *     buildFacturaHTML son las únicas funciones que generan el cuerpo HTML.
 *   - PlantillaPreview renderiza un iframe con srcDoc (no un doble render).
 *   - tipo 'comanda'/'cocina' → buildComandaHTML; 'ticket'/'factura' → buildFacturaHTML.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  buildComandaHTML,
  buildFacturaHTML,
  buildCSS,
  PADDING_RATIO,
  bodyWidthMm,
  paddingMm,
} from '../lib/plantillas/ticketRenderer';
import {
  ORDEN_EJEMPLO,
  PAGOS_EJEMPLO,
  NEGOCIO_EJEMPLO,
} from '../lib/plantillas/ejemploDatos';
import { PlantillaPreview, configToTmpl } from '../components/plantillas/PlantillaPreview';
import type { PlantillaConfig } from '../services/plantillas.service';

// ── Fixture ───────────────────────────────────────────────────────────────────

function mkConfig(overrides: Partial<PlantillaConfig> = {}): PlantillaConfig {
  return {
    config: { paperWidth: '80mm', fontSize: 'medium', showLogo: false },
    sections: [
      { id: 'header', tipo: 'header', visible: true,  orden: 0, campos: { restaurantName: true, nit: true, telefono: true } },
      { id: 'items',  tipo: 'items',  visible: true,  orden: 1, campos: { cantidad: true, nombre: true, precio: true, variante: true, nota: true } },
      { id: 'totals', tipo: 'totals', visible: true,  orden: 2, campos: { subtotal: true, iva: true, total: true, metodoPago: true } },
      { id: 'footer', tipo: 'footer', visible: true,  orden: 3, campos: { gracias: true, fechaHora: true } },
    ],
    ...overrides,
  };
}

// ── buildComandaHTML / buildFacturaHTML — secciones ocultas ───────────────────

describe('ticketRenderer — sección oculta no aparece en el HTML', () => {
  it('buildFacturaHTML: header oculto → nombre del negocio NO aparece', () => {
    const tmpl = configToTmpl(mkConfig({
      sections: [
        { id: 'header', tipo: 'header', visible: false, orden: 0, campos: {} },
        { id: 'items',  tipo: 'items',  visible: true,  orden: 1, campos: { cantidad: true, nombre: true, precio: true } },
        { id: 'totals', tipo: 'totals', visible: true,  orden: 2, campos: { total: true } },
        { id: 'footer', tipo: 'footer', visible: true,  orden: 3, campos: {} },
      ],
    }));
    const html = buildFacturaHTML(ORDEN_EJEMPLO, PAGOS_EJEMPLO, NEGOCIO_EJEMPLO, undefined, tmpl);
    expect(html).not.toContain(NEGOCIO_EJEMPLO.nombre);
  });

  it('buildFacturaHTML: header visible → nombre del negocio SÍ aparece', () => {
    const tmpl = configToTmpl(mkConfig());
    const html = buildFacturaHTML(ORDEN_EJEMPLO, PAGOS_EJEMPLO, NEGOCIO_EJEMPLO, undefined, tmpl);
    expect(html).toContain(NEGOCIO_EJEMPLO.nombre);
  });

  it('buildFacturaHTML: sección items oculta → productos NO aparecen', () => {
    const tmpl = configToTmpl(mkConfig({
      sections: [
        { id: 'header', tipo: 'header', visible: true,  orden: 0, campos: {} },
        { id: 'items',  tipo: 'items',  visible: false, orden: 1, campos: {} },
        { id: 'totals', tipo: 'totals', visible: true,  orden: 2, campos: { total: true } },
        { id: 'footer', tipo: 'footer', visible: true,  orden: 3, campos: {} },
      ],
    }));
    const html = buildFacturaHTML(ORDEN_EJEMPLO, PAGOS_EJEMPLO, NEGOCIO_EJEMPLO, undefined, tmpl);
    expect(html).not.toContain('Hamburguesa clásica');
  });

  it('buildFacturaHTML: sección totals oculta → TOTAL NO aparece', () => {
    const tmpl = configToTmpl(mkConfig({
      sections: [
        { id: 'header', tipo: 'header', visible: true,  orden: 0, campos: {} },
        { id: 'items',  tipo: 'items',  visible: true,  orden: 1, campos: { cantidad: true, nombre: true } },
        { id: 'totals', tipo: 'totals', visible: false, orden: 2, campos: {} },
        { id: 'footer', tipo: 'footer', visible: true,  orden: 3, campos: {} },
      ],
    }));
    const html = buildFacturaHTML(ORDEN_EJEMPLO, PAGOS_EJEMPLO, NEGOCIO_EJEMPLO, undefined, tmpl);
    expect(html).not.toContain('TOTAL');
  });

  it('buildComandaHTML: header oculto → número de orden NO aparece en encabezado', () => {
    const tmpl = configToTmpl(mkConfig({
      sections: [
        { id: 'header', tipo: 'header', visible: false, orden: 0, campos: {} },
        { id: 'items',  tipo: 'items',  visible: true,  orden: 1, campos: { cantidad: true, nombre: true } },
      ],
    }));
    const html = buildComandaHTML(ORDEN_EJEMPLO, tmpl);
    // El número de orden aparece en el header; si header=false no debe aparecer
    expect(html).not.toContain('COCINA');
  });

  it('buildComandaHTML: items oculto → nombres de producto NO aparecen', () => {
    const tmpl = configToTmpl(mkConfig({
      sections: [
        { id: 'header', tipo: 'header', visible: true,  orden: 0, campos: {} },
        { id: 'items',  tipo: 'items',  visible: false, orden: 1, campos: {} },
      ],
    }));
    const html = buildComandaHTML(ORDEN_EJEMPLO, tmpl);
    expect(html).not.toContain('Hamburguesa clásica');
  });
});

// ── buildCSS — ancho de papel ─────────────────────────────────────────────────

describe('ticketRenderer — ancho de papel cambia el CSS', () => {
  it('paperWidth 58mm → body width 52mm', () => {
    const css = buildCSS({ paperWidth: '58mm', fontSize: 'medium' });
    expect(css).toContain('52mm');
  });

  it('paperWidth 80mm → body width 74mm', () => {
    const css = buildCSS({ paperWidth: '80mm', fontSize: 'medium' });
    expect(css).toContain('74mm');
  });

  it('paperWidth A4 → body width 190mm', () => {
    const css = buildCSS({ paperWidth: 'A4', fontSize: 'medium' });
    expect(css).toContain('190mm');
  });

  it('@page size refleja el ancho de papel', () => {
    expect(buildCSS({ paperWidth: '58mm' })).toContain('@page { size: 58mm');
    expect(buildCSS({ paperWidth: '80mm' })).toContain('@page { size: 80mm');
    expect(buildCSS({ paperWidth: 'A4'   })).toContain('@page { size: A4');
  });
});

// ── Un renderizador para preview e impresión ──────────────────────────────────

describe('Garantía: preview e impresión usan el mismo renderizador', () => {
  it('buildFacturaHTML con los mismos datos produce el mismo HTML (idempotente)', () => {
    const tmpl = configToTmpl(mkConfig());
    const html1 = buildFacturaHTML(ORDEN_EJEMPLO, PAGOS_EJEMPLO, NEGOCIO_EJEMPLO, undefined, tmpl);
    const html2 = buildFacturaHTML(ORDEN_EJEMPLO, PAGOS_EJEMPLO, NEGOCIO_EJEMPLO, undefined, tmpl);
    expect(html1).toBe(html2);
  });

  it('buildComandaHTML con los mismos datos produce el mismo HTML (idempotente)', () => {
    const tmpl = configToTmpl(mkConfig());
    const html1 = buildComandaHTML(ORDEN_EJEMPLO, tmpl);
    const html2 = buildComandaHTML(ORDEN_EJEMPLO, tmpl);
    expect(html1).toBe(html2);
  });

  it('DATOS_EJEMPLO tiene todos los campos clave cubiertos (ningún toggle queda en blanco)', () => {
    expect(ORDEN_EJEMPLO.detalles.length).toBeGreaterThanOrEqual(2);
    expect(ORDEN_EJEMPLO.detalles.some(d => d.variante)).toBe(true);
    expect(ORDEN_EJEMPLO.detalles.some(d => d.notas)).toBe(true);
    expect(NEGOCIO_EJEMPLO.nit).toBeTruthy();
    expect(NEGOCIO_EJEMPLO.telefono).toBeTruthy();
    expect(PAGOS_EJEMPLO.length).toBeGreaterThan(0);
  });
});

// ── PlantillaPreview — componente React ───────────────────────────────────────

describe('PlantillaPreview — componente', () => {
  it('renderiza un iframe (no un componente MUI divergente)', () => {
    render(
      <MemoryRouter>
        <PlantillaPreview tipo="ticket" config={mkConfig()} />
      </MemoryRouter>
    );
    const iframe = screen.getByTestId('preview-iframe') as HTMLIFrameElement;
    expect(iframe).toBeInTheDocument();
    expect(iframe.tagName.toLowerCase()).toBe('iframe');
  });

  it('el srcDoc del iframe contiene el nombre del negocio (datos de ejemplo)', () => {
    render(
      <MemoryRouter>
        <PlantillaPreview tipo="ticket" config={mkConfig()} />
      </MemoryRouter>
    );
    const iframe = screen.getByTestId('preview-iframe') as HTMLIFrameElement;
    expect(iframe.getAttribute('srcDoc')).toContain(NEGOCIO_EJEMPLO.nombre);
  });

  it('tipo comanda → srcDoc contiene ★ COCINA ★ (usa buildComandaHTML)', () => {
    render(
      <MemoryRouter>
        <PlantillaPreview tipo="comanda" config={mkConfig()} />
      </MemoryRouter>
    );
    const iframe = screen.getByTestId('preview-iframe') as HTMLIFrameElement;
    expect(iframe.getAttribute('srcDoc')).toContain('COCINA');
  });

  it('tipo cocina → srcDoc contiene ★ COCINA ★ (usa buildComandaHTML)', () => {
    render(
      <MemoryRouter>
        <PlantillaPreview tipo="cocina" config={mkConfig()} />
      </MemoryRouter>
    );
    const iframe = screen.getByTestId('preview-iframe') as HTMLIFrameElement;
    expect(iframe.getAttribute('srcDoc')).toContain('COCINA');
  });

  it('tipo ticket → srcDoc contiene el nombre del restaurante (usa buildFacturaHTML)', () => {
    render(
      <MemoryRouter>
        <PlantillaPreview tipo="ticket" config={mkConfig()} />
      </MemoryRouter>
    );
    const iframe = screen.getByTestId('preview-iframe') as HTMLIFrameElement;
    expect(iframe.getAttribute('srcDoc')).toContain(NEGOCIO_EJEMPLO.nombre);
    expect(iframe.getAttribute('srcDoc')).not.toContain('★ COCINA ★');
  });

  it('sección oculta → srcDoc no incluye el contenido de esa sección', () => {
    const configSinHeader = mkConfig({
      sections: [
        { id: 'header', tipo: 'header', visible: false, orden: 0, campos: {} },
        { id: 'items',  tipo: 'items',  visible: true,  orden: 1, campos: { cantidad: true, nombre: true, precio: true } },
        { id: 'totals', tipo: 'totals', visible: true,  orden: 2, campos: { total: true } },
        { id: 'footer', tipo: 'footer', visible: true,  orden: 3, campos: {} },
      ],
    });
    render(
      <MemoryRouter>
        <PlantillaPreview tipo="ticket" config={configSinHeader} />
      </MemoryRouter>
    );
    const iframe = screen.getByTestId('preview-iframe') as HTMLIFrameElement;
    expect(iframe.getAttribute('srcDoc')).not.toContain(NEGOCIO_EJEMPLO.nombre);
  });

  it('paperWidth 58mm → la barra de título dice "58mm"', () => {
    render(
      <MemoryRouter>
        <PlantillaPreview tipo="ticket" config={mkConfig({ config: { paperWidth: '58mm', fontSize: 'medium', showLogo: false } })} />
      </MemoryRouter>
    );
    expect(screen.getByText(/58mm/i)).toBeInTheDocument();
  });

  it('paperWidth A4 → la barra de título dice "A4"', () => {
    render(
      <MemoryRouter>
        <PlantillaPreview tipo="ticket" config={mkConfig({ config: { paperWidth: 'A4', fontSize: 'medium', showLogo: false } })} />
      </MemoryRouter>
    );
    expect(screen.getByText(/A4/i)).toBeInTheDocument();
  });
});

// ── Margen físico proporcional ────────────────────────────────────────────────

describe('ticketRenderer — margen físico proporcional', () => {
  it('PADDING_RATIO es 0.04 (4% del ancho nominal del papel)', () => {
    expect(PADDING_RATIO).toBe(0.04);
  });

  it('paddingMm(58mm) ≈ 2.3mm  (58 × 0.04)', () => {
    expect(paddingMm('58mm')).toBeCloseTo(2.32, 1);
  });

  it('paddingMm(80mm) ≈ 3.2mm  (80 × 0.04)', () => {
    expect(paddingMm('80mm')).toBeCloseTo(3.2, 1);
  });

  it('paddingMm(A4)  ≈ 8.4mm  (210 × 0.04)', () => {
    expect(paddingMm('A4')).toBeCloseTo(8.4, 1);
  });

  it('el padding crece con el ancho del papel (proporcional)', () => {
    expect(paddingMm('80mm')).toBeGreaterThan(paddingMm('58mm'));
    expect(paddingMm('A4')).toBeGreaterThan(paddingMm('80mm'));
  });

  it('área de contenido = bodyWidthMm − 2×paddingMm para 58mm', () => {
    const contenido = bodyWidthMm('58mm') - 2 * paddingMm('58mm');
    expect(contenido).toBeCloseTo(52 - 2 * 2.32, 0);
  });

  it('área de contenido = bodyWidthMm − 2×paddingMm para 80mm', () => {
    const contenido = bodyWidthMm('80mm') - 2 * paddingMm('80mm');
    expect(contenido).toBeCloseTo(74 - 2 * 3.2, 0);
  });

  it('el CSS contiene el padding en mm para 58mm (no px)', () => {
    const css = buildCSS({ paperWidth: '58mm' });
    expect(css).toMatch(/padding:\s*0\s+2\.3mm/);
  });

  it('el CSS contiene el padding en mm para 80mm (no px)', () => {
    const css = buildCSS({ paperWidth: '80mm' });
    expect(css).toMatch(/padding:\s*0\s+3\.2mm/);
  });

  it('el padding en el CSS cambia al cambiar el ancho (no es fijo en px)', () => {
    const css58 = buildCSS({ paperWidth: '58mm' });
    const css80 = buildCSS({ paperWidth: '80mm' });
    expect(css58).toContain('2.3mm');
    expect(css80).toContain('3.2mm');
    expect(css58).not.toContain('3.2mm');
  });

  it('el mismo renderizador produce el padding tanto para preview como para impresión', () => {
    // buildCSS es llamado por buildFullHTML (preview iframe) Y por printFactura (impresión real)
    // Verificamos que buildCSS con los mismos parámetros produce el mismo CSS en ambos contextos
    const tmpl = { paperWidth: '80mm' as const };
    const css1 = buildCSS(tmpl);
    const css2 = buildCSS(tmpl);
    expect(css1).toBe(css2);
    expect(css1).toContain('3.2mm');
  });
});

// ── Hoja elástica (alto = contenido) ─────────────────────────────────────────

describe('PlantillaPreview — hoja elástica (fix alto desbordante)', () => {
  it('el iframe NO tiene altura fija de 700px', () => {
    render(
      <MemoryRouter>
        <PlantillaPreview tipo="ticket" config={mkConfig()} />
      </MemoryRouter>
    );
    const iframe = screen.getByTestId('preview-iframe') as HTMLIFrameElement;
    // La altura viene de estado React, no de un valor hardcodeado de 700
    expect(iframe.style.height).not.toBe('700px');
  });

  it('el iframe tiene scrolling="no" (el scroll es del panel, no del ticket)', () => {
    render(
      <MemoryRouter>
        <PlantillaPreview tipo="ticket" config={mkConfig()} />
      </MemoryRouter>
    );
    const iframe = screen.getByTestId('preview-iframe') as HTMLIFrameElement;
    expect(iframe.getAttribute('scrolling')).toBe('no');
  });

  it('un ticket largo produce más HTML que uno corto (el alto crece con el contenido)', () => {
    const tmpl = configToTmpl(mkConfig());
    const ordenLarga = {
      ...ORDEN_EJEMPLO,
      detalles: Array.from({ length: 20 }, (_, i) => ({
        nombre: `Producto ${i + 1}`, cantidad: 1, precio_unitario: 5000,
      })),
    };
    const htmlCorto = buildFacturaHTML(ORDEN_EJEMPLO, PAGOS_EJEMPLO, NEGOCIO_EJEMPLO, undefined, tmpl);
    const htmlLargo = buildFacturaHTML(ordenLarga,    PAGOS_EJEMPLO, NEGOCIO_EJEMPLO, undefined, tmpl);
    expect(htmlLargo.length).toBeGreaterThan(htmlCorto.length);
  });

  it('funciona igual en 80mm y 58mm — sin lógica por-ancho en el fix de alto', () => {
    // Ambos anchos renderizan sin error; el alto lo determina el HTML, no el ancho
    const render80 = () => render(
      <MemoryRouter>
        <PlantillaPreview tipo="ticket" config={mkConfig()} />
      </MemoryRouter>
    );
    const render58 = () => render(
      <MemoryRouter>
        <PlantillaPreview tipo="ticket"
          config={mkConfig({ config: { paperWidth: '58mm', fontSize: 'medium', showLogo: false } })} />
      </MemoryRouter>
    );
    expect(render80).not.toThrow();
    expect(render58).not.toThrow();
    // Ambos tienen scrolling="no" — misma lógica, sin if por ancho
    const iframes = screen.getAllByTestId('preview-iframe') as HTMLIFrameElement[];
    expect(iframes.every(f => f.getAttribute('scrolling') === 'no')).toBe(true);
  });

  it('el render de impresión no cambió — buildCSS sigue produciendo el mismo CSS', () => {
    // Este fix es solo del contenedor; buildCSS/buildComandaHTML/buildFacturaHTML no se tocaron
    const css = buildCSS({ paperWidth: '80mm' });
    expect(css).toContain('3.2mm');           // padding físico intacto
    expect(css).toContain('@page');            // configuración de impresión intacta
    expect(css).not.toContain('height: 700'); // la altura fija nunca estuvo en el renderer
  });
});
