/**
 * ticketRenderer.ts — Generador puro de HTML para tickets e impresión.
 *
 * Única fuente de verdad para el HTML que se imprime Y que aparece en el
 * preview del editor. `print.ts` llama estas funciones y abre window.print();
 * `PlantillaPreview` las llama y muestra el resultado en un <iframe srcDoc>.
 *
 * Regla: ningún cambio visual debe hacerse solo en `print.ts` ni solo en el
 * preview — solo aquí, y ambos lo reflejan automáticamente.
 */

// ── Tipos públicos reutilizados por print.ts y PlantillaPreview ──────────────

export interface PrintItem {
  nombre:          string;
  cantidad:        number;
  precio_unitario: number;
  notas?:          string;
  variante?:       string;
}

export interface PrintOrden {
  numero_orden:       string;
  tipo_orden:         string;
  fecha_apertura:     string;
  nombre_contacto?:   string;
  telefono?:          string;
  direccion_entrega?: string;
  costo_domicilio?:   number;
  observaciones?:     string;
  mesa?:              string;
  mesero?:            string;
  prioridad?:         string;
  detalles:           PrintItem[];
  subtotal:           number;
  impuestos:          number;
  /** 'iva' | 'impoconsumo' — snapshot del tipo aplicado al crear la orden. */
  impuesto_tipo?:     string;
  total:              number;
}

const IMPUESTO_LABEL: Record<string, string> = {
  iva:         'IVA',
  impoconsumo: 'Impoconsumo (INC)',
};

export interface PrintPago {
  metodo: string;
  monto:  number;
}

export interface PrintNegocio {
  nombre:        string;
  nit?:          string;
  telefono?:     string;
  ciudad?:       string;
  resolucionDian?: string;
}

export interface PrintTemplateConfig {
  paperWidth?: string;
  fontSize?:   'small' | 'medium' | 'large';
  showLogo?:   boolean;
  sections?:   { id: string; visible: boolean; campos?: Record<string, boolean> }[];
}

// ── Helpers internos ──────────────────────────────────────────────────────────

export function fmtMoney(v: number): string {
  return '$ ' + Math.round(v).toLocaleString('es-CO');
}

export function fmtFecha(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function sec(tmpl: PrintTemplateConfig | undefined, id: string): boolean {
  return !tmpl?.sections || tmpl.sections.find(s => s.id === id)?.visible !== false;
}

function cam(tmpl: PrintTemplateConfig | undefined, secId: string, campo: string): boolean {
  if (!tmpl?.sections) return true;
  const s = tmpl.sections.find(x => x.id === secId);
  return !s?.campos || s.campos[campo] !== false;
}

// ── Margen físico proporcional ────────────────────────────────────────────────

/** Ancho nominal del papel en mm. */
export function paperWidthMm(paper: string): number {
  if (paper === '58mm') return 58;
  if (paper === 'A4')   return 210;
  return 80;
}

/** Ancho imprimible del body (área de página menos márgenes @page). */
export function bodyWidthMm(paper: string): number {
  if (paper === 'A4') return 190; // 210 − 2×10mm margen @page
  return paperWidthMm(paper) - 6; // 2×3mm margen @page
}

/**
 * Padding interno del ticket en mm.
 * Regla única: PADDING_RATIO × ancho nominal del papel.
 * Al cambiar el ancho, el padding se recalcula proporcionalmente;
 * el texto nunca queda pegado al borde del área imprimible.
 */
export const PADDING_RATIO = 0.04;
export function paddingMm(paper: string): number {
  return paperWidthMm(paper) * PADDING_RATIO;
}

export function buildCSS(cfg?: PrintTemplateConfig): string {
  const paper    = cfg?.paperWidth ?? '80mm';
  const isA4     = paper === 'A4';
  const bodyW    = `${bodyWidthMm(paper)}mm`;
  const pad      = paddingMm(paper).toFixed(1);
  const baseSize = cfg?.fontSize === 'small' ? '11px' : cfg?.fontSize === 'large' ? '15px' : '13px';

  return `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: ${paper} auto; margin: ${isA4 ? '10mm' : '3mm'} 3mm; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: ${baseSize};
    font-weight: 600;
    line-height: 1.6;
    color: #000;
    width: ${bodyW};
    padding: 0 ${pad}mm;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .center  { text-align: center; }
  .right   { text-align: right; }
  .bold    { font-weight: 900; }
  .large   { font-size: 15px; font-weight: 900; }
  .xlarge  { font-size: 18px; font-weight: 900; letter-spacing: 1px; }
  .divider { border: none; border-top: 2px dashed #000; margin: 5px 0; }
  .divider-solid { border: none; border-top: 2px solid #000; margin: 5px 0; }
  table    { width: 100%; border-collapse: collapse; }
  .item-row td { padding: 2px 0; vertical-align: top; }
  .item-nombre  { width: 58%; }
  .item-cant    { width: 10%; text-align: center; }
  .item-precio  { width: 32%; text-align: right; }
  .notas        { font-size: 11px; font-weight: 600; color: #222; padding-left: 6px; font-style: italic; }
  .totales td   { padding: 2px 0; }
  .totales .label { width: 58%; }
  .totales .valor { width: 42%; text-align: right; }
  .total-final  { font-size: 15px; font-weight: 900; }
  .badge {
    display: inline-block;
    border: 2px solid #000;
    padding: 2px 8px;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 2px;
  }
`;
}

// ── HTML builders ─────────────────────────────────────────────────────────────

/** Genera el cuerpo HTML para comanda de cocina / comanda de mesero. */
export function buildComandaHTML(orden: PrintOrden, tmpl?: PrintTemplateConfig): string {
  const tipo = orden.tipo_orden === 'domicilio' ? 'DOMICILIO' : 'LOCAL';

  const items = orden.detalles.map(d => `
    <tr class="item-row">
      <td class="item-cant bold large">${d.cantidad}x</td>
      <td class="item-nombre bold">${d.nombre}${d.variante ? ` <em style="font-weight:600">(${d.variante})</em>` : ''}</td>
    </tr>
    ${d.notas ? `<tr><td></td><td class="notas">↳ ${d.notas}</td></tr>` : ''}
  `).join('');

  const totalItems = orden.detalles.reduce((acc, d) => acc + d.cantidad, 0);

  return `
    ${sec(tmpl, 'header') ? `
    <div class="center">
      <div class="bold xlarge">★ COCINA ★</div>
      <div class="bold large">${orden.numero_orden}</div>
      <div class="badge">${tipo}</div>
    </div>
    <hr class="divider" />
    ${cam(tmpl, 'header', 'mesa') && orden.mesa ? `<div><span class="bold">Mesa:</span> ${orden.mesa}</div>` : ''}
    ${cam(tmpl, 'header', 'mesero') && orden.mesero ? `<div><span class="bold">Mesero:</span> ${orden.mesero}</div>` : ''}
    ${cam(tmpl, 'header', 'fechaHora') ? `<div><span class="bold">Hora:</span> ${fmtFecha(orden.fecha_apertura)}</div>` : ''}
    ${cam(tmpl, 'header', 'prioridad') && orden.prioridad ? `<div><span class="bold">Prioridad:</span> ${orden.prioridad}</div>` : ''}
    ${cam(tmpl, 'header', 'orden') ? `<div><span class="bold">Orden:</span> ${orden.numero_orden}</div>` : ''}
    ` : ''}
    <hr class="divider-solid" />

    ${sec(tmpl, 'items') ? `<table>${items}</table>` : ''}

    <hr class="divider" />
    ${sec(tmpl, 'footer') ? `
      ${cam(tmpl, 'footer', 'totalItems') ? `<div class="center bold">Total ítems: ${totalItems}</div>` : ''}
      ${orden.observaciones ? `<div class="notas bold">Obs: ${orden.observaciones}</div>` : ''}
      <div class="center" style="margin-top:6px; font-size:10px;">— Fin de comanda —</div>
    ` : ''}
  `;
}

/** Genera el cuerpo HTML para ticket/factura de cliente. */
export function buildFacturaHTML(
  orden:         PrintOrden,
  pagos:         PrintPago[],
  negocio:       PrintNegocio,
  numeroFactura?: string,
  tmpl?:         PrintTemplateConfig,
): string {
  const tipo = orden.tipo_orden === 'domicilio' ? 'DOMICILIO' : 'LOCAL';

  const items = orden.detalles.map(d => `
    <tr class="item-row">
      <td class="item-nombre">${d.nombre}${d.variante ? ` <em>(${d.variante})</em>` : ''}</td>
      ${cam(tmpl, 'items', 'cantidad') ? `<td class="item-cant">${d.cantidad}</td>` : ''}
      ${cam(tmpl, 'items', 'precio')   ? `<td class="item-precio">${fmtMoney(d.precio_unitario * d.cantidad)}</td>` : ''}
    </tr>
    ${d.notas ? `<tr><td colspan="3" class="notas">↳ ${d.notas}</td></tr>` : ''}
  `).join('');

  const pagosRows = pagos.map(p => `
    <tr class="totales">
      <td class="label">  ${p.metodo}</td>
      <td class="valor">${fmtMoney(p.monto)}</td>
    </tr>
  `).join('');

  const domicilioRow = (orden.costo_domicilio && orden.costo_domicilio > 0)
    ? `<tr class="totales"><td class="label">Domicilio</td><td class="valor">${fmtMoney(orden.costo_domicilio)}</td></tr>`
    : '';

  return `
    ${sec(tmpl, 'header') ? `
    <div class="center">
      <div class="bold xlarge">${negocio.nombre}</div>
      ${cam(tmpl, 'header', 'nit')       && negocio.nit            ? `<div>NIT: ${negocio.nit}</div>` : ''}
      ${cam(tmpl, 'header', 'telefono')  && negocio.telefono        ? `<div>Tel: ${negocio.telefono}</div>` : ''}
      ${cam(tmpl, 'header', 'direccion') && negocio.ciudad           ? `<div>${negocio.ciudad}</div>` : ''}
      ${cam(tmpl, 'header', 'resolucionDian') && negocio.resolucionDian ? `<div>Res. DIAN: ${negocio.resolucionDian}</div>` : ''}
    </div>
    <hr class="divider" />
    <div class="center">
      <div>${numeroFactura ? `Factura: <span class="bold">${numeroFactura}</span>` : ''}</div>
      <div>Orden: <span class="bold">${orden.numero_orden}</span></div>
      <div class="badge">${tipo}</div>
    </div>
    ` : ''}

    ${sec(tmpl, 'cliente') ? `
    <div style="margin-top:4px;">
      <div>${fmtFecha(orden.fecha_apertura)}</div>
      ${cam(tmpl, 'cliente', 'nombre')    && orden.nombre_contacto  ? `<div>Cliente: ${orden.nombre_contacto}</div>` : ''}
      ${cam(tmpl, 'cliente', 'nombre')    && orden.telefono          ? `<div>Tel: ${orden.telefono}</div>` : ''}
      ${orden.direccion_entrega                                       ? `<div>Dir: ${orden.direccion_entrega}</div>` : ''}
    </div>
    ` : ''}

    <hr class="divider-solid" />

    ${sec(tmpl, 'items') ? `
    <table>
      <tr class="item-row">
        <td class="item-nombre bold">Producto</td>
        ${cam(tmpl, 'items', 'cantidad') ? `<td class="item-cant bold">Cant</td>` : ''}
        ${cam(tmpl, 'items', 'precio')   ? `<td class="item-precio bold">Total</td>` : ''}
      </tr>
      <tr><td colspan="3"><hr class="divider" /></td></tr>
      ${items}
    </table>
    ` : ''}

    <hr class="divider" />

    ${sec(tmpl, 'totals') ? `
    <table>
      ${cam(tmpl, 'totals', 'subtotal') ? `<tr class="totales"><td class="label">Subtotal</td><td class="valor">${fmtMoney(orden.subtotal)}</td></tr>` : ''}
      ${domicilioRow}
      ${cam(tmpl, 'totals', 'iva') && orden.impuestos > 0 ? `<tr class="totales"><td class="label">${IMPUESTO_LABEL[orden.impuesto_tipo ?? ''] ?? 'IVA'}</td><td class="valor">${fmtMoney(orden.impuestos)}</td></tr>` : ''}
      <tr><td colspan="2"><hr class="divider" /></td></tr>
      ${cam(tmpl, 'totals', 'total') ? `<tr class="totales total-final"><td class="label">TOTAL</td><td class="valor">${fmtMoney(orden.total)}</td></tr>` : ''}
    </table>
    ` : ''}

    ${cam(tmpl, 'totals', 'metodoPago') && pagos.length > 0 ? `
      <hr class="divider" />
      <table>
        <tr class="totales"><td class="label bold">PAGO</td><td></td></tr>
        ${pagosRows}
      </table>
    ` : ''}

    ${orden.observaciones ? `<hr class="divider" /><div class="notas">Obs: ${orden.observaciones}</div>` : ''}

    ${sec(tmpl, 'footer') ? `
    <hr class="divider" />
    <div class="center" style="margin-top:4px; font-size:10px;">
      ${cam(tmpl, 'footer', 'gracias') ? '¡Gracias por su compra!<br/>Vuelva pronto 😊' : ''}
      ${cam(tmpl, 'footer', 'fechaHora') ? `<div>${fmtFecha(orden.fecha_apertura)}</div>` : ''}
      ${cam(tmpl, 'footer', 'condicionesPago') ? '<div>Pago a 30 días.</div>' : ''}
    </div>
    ` : ''}
  `;
}

/**
 * Devuelve el documento HTML completo (con CSS) para cualquier tipo de plantilla.
 * Usado tanto por el preview (iframe) como por printWindow en print.ts.
 */
export function buildFullHTML(body: string, tmpl?: PrintTemplateConfig): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Impresión</title><style>${buildCSS(tmpl)}</style></head><body>${body}</body></html>`;
}
