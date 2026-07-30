/**
 * print.ts — Impresión térmica: abre window.print() con el HTML generado por ticketRenderer.
 *
 * La generación del HTML vive en lib/plantillas/ticketRenderer.ts para que tanto
 * print.ts como PlantillaPreview usen la misma función (preview ≡ impresión).
 *
 * Compatibilidad: Xprinter XP-58/XP-80 y similares conectados por USB.
 * Configurar en Windows: Dispositivos e impresoras → propiedades de la Xprinter
 *   → Preferencias de impresión → Tamaño de papel personalizado: 80mm × auto
 *
 * Uso:
 *   printComanda(orden)                        → ticket de cocina (sin precios)
 *   printFactura(orden, pagos, negocio, ...)   → recibo de cliente
 */

export type {
  PrintItem,
  PrintOrden,
  PrintPago,
  PrintNegocio,
  PrintTemplateConfig,
} from '../lib/plantillas/ticketRenderer';

import {
  buildComandaHTML,
  buildFacturaHTML,
  buildFullHTML,
} from '../lib/plantillas/ticketRenderer';

import type {
  PrintOrden,
  PrintPago,
  PrintNegocio,
  PrintTemplateConfig,
} from '../lib/plantillas/ticketRenderer';

// ─── Abrir ventana e imprimir ────────────────────────────────────────────────

function printWindow(html: string): void {
  const win = window.open('', '_blank', 'width=400,height=600,scrollbars=yes');
  if (!win) {
    alert('El navegador bloqueó la ventana emergente. Permite popups para este sitio.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 300);
}

// ─── API pública ─────────────────────────────────────────────────────────────

export function printComanda(orden: PrintOrden, tmpl?: PrintTemplateConfig, copias = 1): void {
  const html = buildFullHTML(buildComandaHTML(orden, tmpl), tmpl);
  const n = Math.max(1, Math.min(5, Math.round(copias)));
  // Cada copia es una impresión física independiente (cocina suele querer 2:
  // una para la parrilla y otra para el pase). Se abren de forma escalonada para
  // no disparar el bloqueo de popups del navegador.
  for (let i = 0; i < n; i++) {
    setTimeout(() => printWindow(html), i * 500);
  }
}

export function printFactura(
  orden:          PrintOrden,
  pagos:          PrintPago[],
  negocio:        PrintNegocio,
  numeroFactura?: string,
  tmpl?:          PrintTemplateConfig,
): void {
  printWindow(buildFullHTML(buildFacturaHTML(orden, pagos, negocio, numeroFactura, tmpl), tmpl));
}
