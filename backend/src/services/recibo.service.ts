/**
 * recibo.service.ts — Generación de recibos para órdenes.
 *
 * El resultado de cada método es un objeto serializable (ReciboSimple)
 * que el controller puede devolver como JSON o pasar a un servicio de PDF/thermal.
 *
 * Diseño:
 *   - No muta ningún estado — solo lectura.
 *   - Lanza NotFoundError si no existe la orden.
 */

import prisma from '../config/database';
import { NotFoundError, ForbiddenError } from '../exceptions/HttpErrors';
import type { TenantCtx } from '../lib/tenantCtx';

// ─── Tipos de retorno ─────────────────────────────────────────────────────────

export interface ReciboItem {
  nombre:         string;
  cantidad:       number;
  precio_unitario: number;
  descuento:      number;
  subtotal:       number;
  notas?:         string | null;
}

export interface ResumenPago {
  metodo:     string;
  referencia: string | null;
  monto:      number;
}

export interface ReciboSimple {
  tipo:           'simple';
  numero:         string;
  fecha:          Date;
  cliente:        string;
  cajero:         string;
  restaurante:    string;
  items:          ReciboItem[];
  subtotal:       number;
  descuento:      number;
  impuestos:      number;
  propina:        number;
  costo_domicilio: number;
  total:          number;
  pagos:          ResumenPago[];
  cambio:         number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(v: unknown): number {
  return v != null ? Number(v) : 0;
}

function calcularCambio(pagos: ResumenPago[], total: number): number {
  const totalPagado = pagos.reduce((s, p) => s + p.monto, 0);
  return Math.max(0, totalPagado - total);
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const reciboService = {

  /**
   * generarReciboSimple — recibo para una orden única (un restaurante).
   *
   * Incluye todos los pagos asociados a la orden individual.
   *
   * Aislamiento multi-tenant: el recibo (con datos de cliente y pagos) solo es
   * visible para el restaurante dueño de la orden. Aplica el mismo criterio que
   * TenantRepository._scopedLookup — responde NotFound ante una orden de otro
   * tenant para no revelar su existencia.
   */
  async generarReciboSimple(idOrden: number, ctx: TenantCtx): Promise<ReciboSimple> {
    const orden = await prisma.orden.findUnique({
      where:   { id: idOrden },
      include: {
        restaurante: { select: { nombre: true } },
        usuario:     { select: { nombre_completo: true } },
        cliente:     { select: { nombre_completo: true } },
        estado:      { select: { nombre: true } },
        detalles: {
          include: {
            producto:  { select: { nombre: true } },
            variante:  { select: { nombre: true } },
          },
        },
        pagos: {
          include: { metodo_pago: { select: { nombre: true } } },
        },
      },
    }) as any; // Prisma include payload — campos include verificados en runtime

    if (!orden) throw new NotFoundError('Orden');

    if (!ctx.esSuperAdmin) {
      if (ctx.restauranteId === undefined || ctx.restauranteId === null) {
        throw new ForbiddenError('Se requiere contexto de restaurante para esta operación');
      }
      if (orden.id_restaurante !== ctx.restauranteId) {
        console.warn(
          `[TenantGuard] IDOR attempt: restaurante ${ctx.restauranteId} intentó acceder al ` +
          `recibo de la orden ${idOrden} (id_restaurante=${orden.id_restaurante})`,
        );
        throw new NotFoundError('Orden');
      }
    }

    const items: ReciboItem[] = orden.detalles.map((d: any) => ({
      nombre:          d.variante
                         ? `${d.producto.nombre} — ${d.variante.nombre}`
                         : d.producto.nombre,
      cantidad:        toNum(d.cantidad),
      precio_unitario: toNum(d.precio_unitario),
      descuento:       toNum(d.descuento),
      subtotal:        toNum(d.subtotal),
      notas:           d.notas,
    }));

    const pagos: ResumenPago[] = orden.pagos.map((p: any) => ({
      metodo:     p.metodo_pago.nombre,
      referencia: p.referencia ?? null,
      monto:      toNum(p.monto),
    }));

    const total = toNum(orden.total);

    return {
      tipo:            'simple',
      numero:          orden.numero_orden,
      fecha:           orden.fecha_apertura,
      cliente:         orden.cliente?.nombre_completo ?? 'Consumidor final',
      cajero:          orden.usuario.nombre_completo ?? 'Sistema',
      restaurante:     orden.restaurante.nombre,
      items,
      subtotal:        toNum(orden.subtotal),
      descuento:       toNum(orden.descuento),
      impuestos:       toNum(orden.impuestos),
      propina:         toNum(orden.propina),
      costo_domicilio: toNum(orden.costo_domicilio),
      total,
      pagos,
      cambio:          calcularCambio(pagos, total),
    };
  },

  /**
   * generarRecibo — punto de entrada.
   *
   * Uso recomendado desde el controller:
   *   const recibo = await reciboService.generarRecibo({ idOrden: 42 }, ctx);
   */
  async generarRecibo(params: { idOrden?: number }, ctx: TenantCtx): Promise<ReciboSimple> {
    if (!params.idOrden) throw new Error('Se requiere idOrden');
    return this.generarReciboSimple(params.idOrden, ctx);
  },
};
