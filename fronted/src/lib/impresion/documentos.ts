/**
 * documentos.ts — Construye los bytes ESC/POS de cada documento del POS,
 * reutilizando los DTO ya normalizados de ticketRenderer (PrintOrden, etc.).
 */

import { formatCurrency } from '../../utils';
import { TicketEncoder } from './encoder';
import type { PrintOrden, PrintPago, PrintNegocio } from '../plantillas/ticketRenderer';

const IMPUESTO_LABEL: Record<string, string> = { iva: 'IVA', impoconsumo: 'Impoconsumo' };

export interface ConfigTicket {
  ancho_papel?: string;   // '58' | '80'
  footerText?:  string;   // pie del ticket
}

/** Datos de la factura electrónica para imprimir CUFE + QR (opcional). */
export interface FEParaTicket {
  cufe?:   string | null;
  numero?: string | null;
  qr_url?: string | null;
}

function cabeceraNegocio(e: TicketEncoder, negocio: PrintNegocio) {
  e.centro(negocio.nombre, { bold: true });
  if (negocio.nit)            e.centro(`NIT ${negocio.nit}`);
  if (negocio.telefono)       e.centro(`Tel ${negocio.telefono}`);
  if (negocio.ciudad)         e.centro(negocio.ciudad);
  if (negocio.resolucionDian) e.centro(negocio.resolucionDian);
}

/** Recibo/ticket de venta (con CUFE + QR si hay factura electrónica). */
export function recibo(
  orden: PrintOrden,
  pagos: PrintPago[],
  negocio: PrintNegocio,
  cfg: ConfigTicket = {},
  fe?: FEParaTicket,
): Uint8Array {
  const e = new TicketEncoder(cfg.ancho_papel);
  cabeceraNegocio(e, negocio);
  e.divisor();
  e.linea(`Orden: ${orden.numero_orden}`);
  e.linea(new Date(orden.fecha_apertura).toLocaleString('es-CO'));
  if (orden.mesa)   e.linea(`Mesa: ${orden.mesa}`);
  e.divisor();

  for (const it of orden.detalles) {
    const nombre = it.variante ? `${it.nombre} (${it.variante})` : it.nombre;
    e.dosColumnas(`${it.cantidad} x ${nombre}`.slice(0, e.cols - 10), formatCurrency(it.cantidad * it.precio_unitario));
    if (it.notas) e.linea(`   ${it.notas}`);
  }

  e.divisor();
  e.dosColumnas('Subtotal', formatCurrency(orden.subtotal));
  if (orden.costo_domicilio) e.dosColumnas('Domicilio', formatCurrency(orden.costo_domicilio));
  if (orden.impuestos) e.dosColumnas(IMPUESTO_LABEL[orden.impuesto_tipo ?? 'iva'] ?? 'Impuesto', formatCurrency(orden.impuestos));
  e.grande(`TOTAL ${formatCurrency(orden.total)}`);

  if (pagos.length) {
    e.divisor();
    for (const p of pagos) e.dosColumnas(p.metodo, formatCurrency(p.monto));
  }

  if (fe?.cufe) {
    e.divisor();
    e.centro('FACTURA ELECTRÓNICA DIAN');
    if (fe.numero) e.centro(fe.numero);
    e.linea(`CUFE: ${fe.cufe}`);
    e.qr(fe.qr_url || fe.cufe);
  }

  e.divisor();
  e.centro(cfg.footerText || '¡Gracias por su compra!');
  e.avanzar(3).cortar();
  return e.bytes();
}

/** Comanda de cocina — ítems grandes, sin precios. Una copia por tiquete. */
export function comanda(orden: PrintOrden, cfg: ConfigTicket = {}, copias = 1): Uint8Array {
  const e = new TicketEncoder(cfg.ancho_papel);
  const n = Math.min(Math.max(copias, 1), 5);
  for (let c = 0; c < n; c++) {
    e.centro('COMANDA', { bold: true });
    e.linea(`Orden: ${orden.numero_orden}`);
    if (orden.mesa)   e.linea(`Mesa: ${orden.mesa}`);
    if (orden.mesero) e.linea(`Mesero: ${orden.mesero}`);
    e.linea(new Date(orden.fecha_apertura).toLocaleTimeString('es-CO'));
    e.divisor();
    for (const it of orden.detalles) {
      e.grande(`${it.cantidad} x ${it.nombre}`);
      if (it.variante) e.linea(`   ${it.variante}`);
      if (it.notas)    e.linea(`   * ${it.notas}`);
    }
    e.avanzar(3).cortar();
  }
  return e.bytes();
}

export interface CierreData {
  numero:      string;
  fecha:       string;
  ventas:      Array<{ metodo: string; monto: number }>;
  totalVentas: number;
  base?:       number;
  contado?:    number;
  diferencia?: number;
}

/** Corte / cierre de caja. */
export function cierre(datos: CierreData, negocio: PrintNegocio, cfg: ConfigTicket = {}): Uint8Array {
  const e = new TicketEncoder(cfg.ancho_papel);
  e.centro(negocio.nombre, { bold: true });
  e.centro('CIERRE DE CAJA', { bold: true });
  e.linea(`Cierre: ${datos.numero}`);
  e.linea(new Date(datos.fecha).toLocaleString('es-CO'));
  e.divisor();
  for (const v of datos.ventas) e.dosColumnas(v.metodo, formatCurrency(v.monto));
  e.divisor();
  e.dosColumnas('Total ventas', formatCurrency(datos.totalVentas));
  if (datos.base != null)       e.dosColumnas('Base', formatCurrency(datos.base));
  if (datos.contado != null)    e.dosColumnas('Contado', formatCurrency(datos.contado));
  if (datos.diferencia != null) e.dosColumnas('Diferencia', formatCurrency(datos.diferencia));
  e.avanzar(3).cortar();
  return e.bytes();
}

/** Solo abrir el cajón monedero. */
export function kickCajon(): Uint8Array {
  return new TicketEncoder().abrirCajon().bytes();
}
