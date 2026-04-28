/**
 * recibo.service.ts — Generación de recibos para órdenes simples y multi-restaurante.
 *
 * Casos cubiertos:
 *   1. Recibo de orden simple (id_orden) — un restaurante.
 *   2. Recibo unificado de orden grupo (id_orden_grupo) — múltiples restaurantes,
 *      un único recibo con desglose por sede y totales consolidados.
 *
 * El resultado de cada método es un objeto serializable (ReciboSimple | ReciboUnificado)
 * que el controller puede devolver como JSON o pasar a un servicio de PDF/thermal.
 *
 * Diseño:
 *   - No muta ningún estado — solo lectura.
 *   - Lanza NotFoundError si no existe la orden/grupo.
 *   - El campo `restaurante` en cada sección permite al frontend/impresora identificar
 *     el origen de cada línea.
 */

import prisma from '../config/database';
import { NotFoundError } from '../exceptions/HttpErrors';

// ─── Tipos de retorno ─────────────────────────────────────────────────────────

export interface ReciboItem {
  nombre:         string;
  cantidad:       number;
  precio_unitario: number;
  descuento:      number;
  subtotal:       number;
  notas?:         string | null;
}

export interface ReciboSeccion {
  restaurante:    string;
  codigo_orden:   string;
  sufijo:         string | null;
  items:          ReciboItem[];
  subtotal:       number;
  descuento:      number;
  impuestos:      number;
  propina:        number;
  total:          number;
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

export interface ReciboUnificado {
  tipo:           'unificado';
  numero_grupo:   string;
  fecha:          Date;
  cliente:        string;
  cajero:         string;
  // Desglose independiente por restaurante
  secciones:      ReciboSeccion[];
  // Totales consolidados de todas las secciones
  consolidado: {
    subtotal:     number;
    descuento:    number;
    impuestos:    number;
    total:        number;
  };
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
   */
  async generarReciboSimple(idOrden: number): Promise<ReciboSimple> {
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
   * generarReciboUnificado — recibo consolidado para un grupo de órdenes
   * que abarca múltiples restaurantes (OrdenGrupo).
   *
   * Estructura del recibo:
   *   - Encabezado global (número de grupo, cliente, cajero)
   *   - Secciones independientes por restaurante (items + subtotales propios)
   *   - Bloque consolidado con totales globales
   *   - Pagos (PagoGrupo) que cubren el grupo completo
   *
   * Si el grupo tiene una sola orden, sigue funcionando correctamente
   * (un solo restaurante = una sola sección).
   */
  async generarReciboUnificado(idOrdenGrupo: number): Promise<ReciboUnificado> {
    const grupo = await prisma.ordenGrupo.findUnique({
      where:   { id: idOrdenGrupo },
      include: {
        usuario: { select: { nombre_completo: true } },
        ordenes: {
          include: {
            restaurante: { select: { nombre: true } },
            cliente:     { select: { nombre_completo: true } },
            detalles: {
              include: {
                producto: { select: { nombre: true } },
                variante: { select: { nombre: true } },
              },
            },
          },
          orderBy: { sufijo_orden: 'asc' },
        },
        pagos: {
          include: { metodo_pago: { select: { nombre: true } } },
          orderBy: { fecha_pago:  'asc' },
        },
      },
    }) as any; // Prisma include payload — campos include verificados en runtime

    if (!grupo) throw new NotFoundError('Orden grupo');

    // Determinar nombre del cliente desde la primera orden que lo tenga
    const clienteNombre = grupo.ordenes.find((o: any) => o.cliente?.nombre_completo)?.cliente?.nombre_completo
      ?? 'Consumidor final';

    // Construir una sección por cada orden del grupo
    const secciones: ReciboSeccion[] = grupo.ordenes.map((orden: any) => {
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

      return {
        restaurante:  orden.restaurante.nombre,
        codigo_orden: orden.numero_orden,
        sufijo:       orden.sufijo_orden,
        items,
        subtotal:     toNum(orden.subtotal),
        descuento:    toNum(orden.descuento),
        impuestos:    toNum(orden.impuestos),
        propina:      toNum(orden.propina),
        total:        toNum(orden.total),
      };
    });

    // Totales consolidados — suma de cada sección
    const consolidado = secciones.reduce(
      (acc, s) => ({
        subtotal:  acc.subtotal  + s.subtotal,
        descuento: acc.descuento + s.descuento,
        impuestos: acc.impuestos + s.impuestos,
        total:     acc.total     + s.total,
      }),
      { subtotal: 0, descuento: 0, impuestos: 0, total: 0 }
    );

    // Pagos del grupo
    const pagos: ResumenPago[] = grupo.pagos.map((p: any) => ({
      metodo:     p.metodo_pago.nombre,
      referencia: p.referencia ?? null,
      monto:      toNum(p.monto),
    }));

    return {
      tipo:         'unificado',
      numero_grupo: grupo.numero_grupo,
      fecha:        grupo.fecha_creacion,
      cliente:      clienteNombre,
      cajero:       grupo.usuario.nombre_completo ?? 'Sistema',
      secciones,
      consolidado,
      pagos,
      cambio:       calcularCambio(pagos, consolidado.total),
    };
  },

  /**
   * generarRecibo — punto de entrada unificado.
   * Detecta automáticamente si la orden pertenece a un grupo y
   * delega al método correspondiente.
   *
   * Uso recomendado desde el controller:
   *   const recibo = await reciboService.generarRecibo({ idOrden: 42 });
   *   // retorna ReciboSimple o ReciboUnificado según el caso
   */
  async generarRecibo(params: {
    idOrden?:       number;
    idOrdenGrupo?:  number;
  }): Promise<ReciboSimple | ReciboUnificado> {
    if (params.idOrdenGrupo) {
      return this.generarReciboUnificado(params.idOrdenGrupo);
    }

    if (params.idOrden) {
      // Verificar si la orden pertenece a un grupo
      const orden = await prisma.orden.findUnique({
        where:  { id: params.idOrden },
        select: { id_orden_grupo: true },
      });

      if (!orden) throw new NotFoundError('Orden');

      if (orden.id_orden_grupo) {
        // Redirigir al recibo unificado del grupo
        return this.generarReciboUnificado(orden.id_orden_grupo);
      }

      return this.generarReciboSimple(params.idOrden);
    }

    throw new Error('Se requiere idOrden o idOrdenGrupo');
  },
};
