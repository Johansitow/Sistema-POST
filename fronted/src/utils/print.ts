/**
 * print.ts — Utilidades de impresión térmica 80mm
 *
 * Compatibilidad: Xprinter XP-58/XP-80 y similares conectados por USB.
 * Configurar en Windows: Dispositivos e impresoras → propiedades de la Xprinter
 *   → Preferencias de impresión → Tamaño de papel personalizado: 80mm × auto
 *
 * Uso:
 *   printComanda(orden)   → ticket de cocina (sin precios)
 *   printFactura(orden, factura, pagos) → recibo de cliente
 */

export interface PrintItem {
  nombre:         string;
  cantidad:       number;
  precio_unitario: number;
  notas?:         string;
}

export interface PrintOrden {
  numero_orden:      string;
  tipo_orden:        string;
  fecha_apertura:    string;
  nombre_contacto?:  string;
  telefono?:         string;
  direccion_entrega?: string;
  costo_domicilio?:  number;
  observaciones?:    string;
  detalles:          PrintItem[];
  subtotal:          number;
  impuestos:         number;
  total:             number;
}

export interface PrintPago {
  metodo: string;
  monto:  number;
}

export interface PrintNegocio {
  nombre:   string;
  nit?:     string;
  telefono?: string;
  ciudad?:  string;
}

// ─── CSS base 80mm ───────────────────────────────────────────────────────────

// ─── PrintTemplateConfig — subset aplicable desde PlantillaImpresion ─────────

export interface PrintTemplateConfig {
  paperWidth?: string;         // '80mm' | '58mm' | 'A4'
  fontSize?:   'small' | 'medium' | 'large';
  showLogo?:   boolean;
  /** Secciones visibles: si se omite, se muestran todas */
  sections?: { id: string; visible: boolean; campos?: Record<string, boolean> }[];
}

function buildCSS(cfg?: PrintTemplateConfig): string {
  const paper    = cfg?.paperWidth ?? '80mm';
  const isA4     = paper === 'A4';
  const bodyW    = isA4 ? '190mm' : paper === '58mm' ? '52mm' : '74mm';
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

// ─── Helper: abrir ventana e imprimir ────────────────────────────────────────

function printWindow(html: string, cfg?: PrintTemplateConfig): void {
  const win = window.open('', '_blank', 'width=400,height=600,scrollbars=yes');
  if (!win) {
    alert('El navegador bloqueó la ventana emergente. Permite popups para este sitio.');
    return;
  }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Impresión</title><style>${buildCSS(cfg)}</style></head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 300);
}

function fmtMoney(v: number): string {
  return '$ ' + Math.round(v).toLocaleString('es-CO');
}

function fmtFecha(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

// ─── COMANDA (cocina) ─────────────────────────────────────────────────────────

export function printComanda(orden: PrintOrden, tmpl?: PrintTemplateConfig): void {
  const sec = (id: string) => !tmpl?.sections || tmpl.sections.find(s => s.id === id)?.visible !== false;
  const cam = (secId: string, campo: string) => {
    if (!tmpl?.sections) return true;
    const s = tmpl.sections.find(x => x.id === secId);
    return !s?.campos || s.campos[campo] !== false;
  };
  const tipo = orden.tipo_orden === 'domicilio' ? 'DOMICILIO' : 'LOCAL';

  const items = orden.detalles.map(d => `
    <tr class="item-row">
      <td class="item-cant bold large">${d.cantidad}x</td>
      <td class="item-nombre bold">${d.nombre}</td>
    </tr>
    ${d.notas ? `<tr><td></td><td class="notas">↳ ${d.notas}</td></tr>` : ''}
  `).join('');

  const html = `
    ${sec('header') ? `
    <div class="center">
      <div class="bold xlarge">★ COCINA ★</div>
      <div class="bold large">${orden.numero_orden}</div>
      <div class="badge">${tipo}</div>
    </div>
    <hr class="divider" />
    ${cam('header','mesero') && orden.nombre_contacto ? `<div><span class="bold">Cliente:</span> ${orden.nombre_contacto}</div>` : ''}
    ${cam('header','fechaHora') ? `<div><span class="bold">Hora:</span> ${fmtFecha(orden.fecha_apertura)}</div>` : ''}
    ${orden.telefono && cam('header','mesa')        ? `<div><span class="bold">Tel:</span> ${orden.telefono}</div>` : ''}
    ${orden.direccion_entrega                       ? `<div><span class="bold">Dir:</span> ${orden.direccion_entrega}</div>` : ''}
    ` : ''}
    <hr class="divider" />

    <hr class="divider-solid" />

    ${sec('items') ? `<table>${items}</table>` : ''}

    <hr class="divider" />
    ${sec('footer') ? `
      ${orden.observaciones ? `<div class="notas bold">Obs: ${orden.observaciones}</div>` : ''}
      <div class="center" style="margin-top:6px; font-size:10px;">— Fin de comanda —</div>
    ` : ''}
  `;

  printWindow(html, tmpl);
}

// ─── FACTURA / RECIBO (cliente) ───────────────────────────────────────────────

export function printFactura(
  orden:   PrintOrden,
  pagos:   PrintPago[],
  negocio: PrintNegocio,
  numeroFactura?: string,
  tmpl?: PrintTemplateConfig,
): void {
  const sec = (id: string) => !tmpl?.sections || tmpl.sections.find(s => s.id === id)?.visible !== false;
  const cam = (secId: string, campo: string) => {
    if (!tmpl?.sections) return true;
    const s = tmpl.sections.find(x => x.id === secId);
    return !s?.campos || s.campos[campo] !== false;
  };
  const tipo = orden.tipo_orden === 'domicilio' ? 'DOMICILIO' : 'LOCAL';

  const items = orden.detalles.map(d => `
    <tr class="item-row">
      <td class="item-nombre">${d.nombre}</td>
      <td class="item-cant">${d.cantidad}</td>
      <td class="item-precio">${fmtMoney(d.precio_unitario * d.cantidad)}</td>
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

  const html = `
    ${sec('header') ? `
    <div class="center">
      <div class="bold xlarge">${negocio.nombre}</div>
      ${cam('header','nit') && negocio.nit         ? `<div>NIT: ${negocio.nit}</div>` : ''}
      ${cam('header','telefono') && negocio.telefono ? `<div>Tel: ${negocio.telefono}</div>` : ''}
      ${cam('header','direccion') && negocio.ciudad  ? `<div>${negocio.ciudad}</div>` : ''}
    </div>
    <hr class="divider" />
    <div class="center">
      <div>${numeroFactura ? `Factura: <span class="bold">${numeroFactura}</span>` : ''}</div>
      <div>Orden: <span class="bold">${orden.numero_orden}</span></div>
      <div class="badge">${tipo}</div>
    </div>
    ` : ''}

    ${sec('cliente') ? `
    <div style="margin-top:4px;">
      <div>${fmtFecha(orden.fecha_apertura)}</div>
      ${cam('cliente','nombre') && orden.nombre_contacto ? `<div>Cliente: ${orden.nombre_contacto}</div>` : ''}
      ${cam('cliente','nombre') && orden.telefono        ? `<div>Tel: ${orden.telefono}</div>` : ''}
      ${orden.direccion_entrega ? `<div>Dir: ${orden.direccion_entrega}</div>` : ''}
    </div>
    ` : ''}

    <hr class="divider-solid" />

    ${sec('items') ? `
    <table>
      <tr class="item-row">
        <td class="item-nombre bold">Producto</td>
        ${cam('items','cantidad') ? `<td class="item-cant bold">Cant</td>` : ''}
        ${cam('items','precio')   ? `<td class="item-precio bold">Total</td>` : ''}
      </tr>
      <tr><td colspan="3"><hr class="divider" /></td></tr>
      ${items}
    </table>
    ` : ''}

    <hr class="divider" />

    ${sec('totals') ? `
    <table>
      ${cam('totals','subtotal') ? `<tr class="totales"><td class="label">Subtotal</td><td class="valor">${fmtMoney(orden.subtotal)}</td></tr>` : ''}
      ${domicilioRow}
      ${cam('totals','iva') && orden.impuestos > 0 ? `<tr class="totales"><td class="label">IVA</td><td class="valor">${fmtMoney(orden.impuestos)}</td></tr>` : ''}
      <tr><td colspan="2"><hr class="divider" /></td></tr>
      ${cam('totals','total') ? `<tr class="totales total-final"><td class="label">TOTAL</td><td class="valor">${fmtMoney(orden.total)}</td></tr>` : ''}
    </table>
    ` : ''}

    ${cam('totals','metodoPago') && pagos.length > 0 ? `
      <hr class="divider" />
      <table>
        <tr class="totales"><td class="label bold">PAGO</td><td></td></tr>
        ${pagosRows}
      </table>
    ` : ''}

    ${orden.observaciones ? `<hr class="divider" /><div class="notas">Obs: ${orden.observaciones}</div>` : ''}

    ${sec('footer') ? `
    <hr class="divider" />
    <div class="center" style="margin-top:4px; font-size:10px;">
      ${cam('footer','gracias') ? '¡Gracias por su compra!<br/>Vuelva pronto 😊' : ''}
      ${cam('footer','fechaHora') ? `<div>${fmtFecha(orden.fecha_apertura)}</div>` : ''}
    </div>
    ` : ''}
  `;

  printWindow(html, tmpl);
}
