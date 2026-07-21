/**
 * ReporteService - Solo lógica de negocio para reportes
 *
 * Métodos de instancia individual (por restaurante) y consolidados por grupo.
 *
 * Todos los métodos individuales aceptan `id_restaurante` opcional para
 * asegurar el aislamiento de tenant. Los métodos consolidados reciben
 * `idGrupo` y agregan los datos de todos los restaurantes del grupo.
 */

import { TipoOrden } from '@prisma/client';
import prisma from '../config/database';
import { NotFoundError } from '../exceptions/HttpErrors';
import { getEstadoFinalId } from '../lib/estadoOrden';

const buildFechaWhere = (desde?: Date, hasta?: Date) => {
  if (!desde && !hasta) return undefined;
  const w: any = {};
  if (desde) w.gte = desde;
  if (hasta) w.lte = hasta;
  return w;
};

// ─── Helper privado ────────────────────────────────────────────────────────────

/** Devuelve id + nombre de todos los restaurantes activos de un grupo. */
async function getRestaurantesDeGrupo(idGrupo: number): Promise<{ id: number; nombre: string }[]> {
  return prisma.restaurante.findMany({
    where:  { id_grupo: idGrupo, activo: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  });
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const reporteService = {
  async getVentas(params: {
    fecha_desde?: Date; fecha_hasta?: Date;
    tipo_orden?: TipoOrden; agrupar_por?: string;
    id_restaurante?: number;
  }) {
    const idEstado = await getEstadoFinalId();
    const where: any = { id_estado: idEstado };
    const fechaWhere = buildFechaWhere(params.fecha_desde, params.fecha_hasta);
    if (fechaWhere) where.fecha_apertura = fechaWhere;
    if (params.tipo_orden) where.tipo_orden = params.tipo_orden;
    if (params.id_restaurante) where.id_restaurante = params.id_restaurante;

    const ordenes = await prisma.orden.findMany({
      where,
      include: { detalles: { include: { producto: { include: { categoria: true } } } } },
      orderBy: { fecha_apertura: 'asc' },
    });

    const agruparPor = params.agrupar_por ?? 'dia';
    const grupos = new Map<string, any>();
    ordenes.forEach(o => {
      const f = new Date(o.fecha_apertura);
      let key: string;
      switch (agruparPor) {
        case 'hora': key = `${f.toISOString().split('T')[0]} ${f.getHours()}:00`; break;
        case 'mes':  key = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`; break;
        default:     key = f.toISOString().split('T')[0];
      }
      if (!grupos.has(key)) grupos.set(key, { periodo: key, ordenes: 0, total: 0, subtotal: 0, impuestos: 0 });
      const g = grupos.get(key)!;
      g.ordenes++; g.total += Number(o.total); g.subtotal += Number(o.subtotal); g.impuestos += Number(o.impuestos);
    });

    const totalVentas = ordenes.reduce((s, o) => s + Number(o.total), 0);
    return {
      periodo: { desde: params.fecha_desde, hasta: params.fecha_hasta },
      totales: {
        total_ordenes:  ordenes.length,
        total_ventas:   totalVentas,
        total_subtotal: ordenes.reduce((s, o) => s + Number(o.subtotal), 0),
        total_impuestos: ordenes.reduce((s, o) => s + Number(o.impuestos), 0),
        ticket_promedio: ordenes.length > 0 ? totalVentas / ordenes.length : 0,
      },
      ventas: Array.from(grupos.values()).sort((a, b) => a.periodo.localeCompare(b.periodo)),
    };
  },

  async getProductosMasVendidos(params: { fecha_desde?: Date; fecha_hasta?: Date; limit?: number; id_restaurante?: number }) {
    const idEstado = await getEstadoFinalId();
    const where: any = { orden: { id_estado: idEstado } };
    const fechaWhere = buildFechaWhere(params.fecha_desde, params.fecha_hasta);
    if (fechaWhere) where.orden.fecha_apertura = fechaWhere;
    if (params.id_restaurante) where.orden.id_restaurante = params.id_restaurante;

    const items = await prisma.ordenDetalle.findMany({
      where, include: { producto: { include: { categoria: true } } },
    });

    const mapa = new Map<number, any>();
    items.forEach(item => {
      const id = item.id_producto;
      if (!mapa.has(id)) mapa.set(id, {
        producto_id: id, nombre: item.producto.nombre, sku: item.producto.sku,
        categoria: item.producto.categoria?.nombre,
        cantidad_vendida: 0, total_vendido: 0, numero_ordenes: 0,
      });
      const d = mapa.get(id)!;
      d.cantidad_vendida += Number(item.cantidad);
      d.total_vendido    += Number(item.subtotal);
      d.numero_ordenes++;
    });

    return Array.from(mapa.values())
      .sort((a, b) => b.cantidad_vendida - a.cantidad_vendida)
      .slice(0, params.limit ?? 20);
  },

  async getVentasPorCategoria(params: { fecha_desde?: Date; fecha_hasta?: Date; id_restaurante?: number }) {
    const idEstado = await getEstadoFinalId();
    const where: any = { orden: { id_estado: idEstado } };
    const fechaWhere = buildFechaWhere(params.fecha_desde, params.fecha_hasta);
    if (fechaWhere) where.orden.fecha_apertura = fechaWhere;
    if (params.id_restaurante) where.orden.id_restaurante = params.id_restaurante;

    const items = await prisma.ordenDetalle.findMany({
      where, include: { producto: { include: { categoria: true } } },
    });

    const mapa = new Map<string, any>();
    items.forEach(item => {
      const cat = item.producto.categoria?.nombre ?? 'Sin categoría';
      if (!mapa.has(cat)) mapa.set(cat, { categoria: cat, cantidad_vendida: 0, total_vendido: 0, productos: new Set() });
      const d = mapa.get(cat)!;
      d.cantidad_vendida += Number(item.cantidad);
      d.total_vendido    += Number(item.subtotal);
      d.productos.add(item.id_producto);
    });

    return Array.from(mapa.values())
      .map(c => ({ categoria: c.categoria, cantidad_vendida: c.cantidad_vendida, total_vendido: c.total_vendido, numero_productos: c.productos.size }))
      .sort((a, b) => b.total_vendido - a.total_vendido);
  },

  async getMetodosPago(params: { fecha_desde?: Date; fecha_hasta?: Date; id_restaurante?: number }) {
    const idEstado = await getEstadoFinalId();
    const where: any = { orden: { id_estado: idEstado } };
    const fechaWhere = buildFechaWhere(params.fecha_desde, params.fecha_hasta);
    if (fechaWhere) where.orden.fecha_apertura = fechaWhere;
    if (params.id_restaurante) where.orden.id_restaurante = params.id_restaurante;

    const pagos = await prisma.pago.findMany({ where, include: { metodo_pago: true } });
    const mapa = new Map<string, any>();
    pagos.forEach(p => {
      const m = p.metodo_pago.nombre;
      if (!mapa.has(m)) mapa.set(m, { metodo: m, transacciones: 0, total: 0 });
      mapa.get(m)!.transacciones++;
      mapa.get(m)!.total += Number(p.monto);
    });
    return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
  },

  async getVentasPorHora(params: { fecha_desde?: Date; fecha_hasta?: Date; id_restaurante?: number }) {
    const idEstado = await getEstadoFinalId();
    const where: any = { id_estado: idEstado };
    const fechaWhere = buildFechaWhere(params.fecha_desde, params.fecha_hasta);
    if (fechaWhere) where.fecha_apertura = fechaWhere;
    if (params.id_restaurante) where.id_restaurante = params.id_restaurante;

    const ordenes = await prisma.orden.findMany({ where, select: { fecha_apertura: true, total: true } });
    const mapa = new Map<number, any>();
    ordenes.forEach(o => {
      const hora = o.fecha_apertura.getHours();
      if (!mapa.has(hora)) mapa.set(hora, { hora: `${hora}:00`, ordenes: 0, total: 0 });
      mapa.get(hora)!.ordenes++;
      mapa.get(hora)!.total += Number(o.total);
    });
    return Array.from(mapa.values()).sort((a, b) => parseInt(a.hora) - parseInt(b.hora));
  },

  async getReporteCompleto(params: { fecha_desde?: Date; fecha_hasta?: Date; id_restaurante?: number }) {
    const [productosMasVendidos, ventasPorCategoria, metodosPago, ventasPorHora] = await Promise.all([
      reporteService.getProductosMasVendidos({ ...params, limit: 10 }),
      reporteService.getVentasPorCategoria(params),
      reporteService.getMetodosPago(params),
      reporteService.getVentasPorHora(params),
    ]);
    return {
      periodo: { desde: params.fecha_desde, hasta: params.fecha_hasta },
      productosMasVendidos, ventasPorCategoria, metodosPago, ventasPorHora,
    };
  },

  // ─── Nuevos reportes ─────────────────────────────────────────────────────────

  async getValorMerma(params: { fecha_desde?: Date; fecha_hasta?: Date; id_restaurante?: number }) {
    const where: any = { estado_lote: { not: 'en_produccion' } };
    if (params.id_restaurante) where.id_restaurante = params.id_restaurante;
    const fechaWhere = buildFechaWhere(params.fecha_desde, params.fecha_hasta);
    if (fechaWhere) where.fecha_produccion = fechaWhere;

    const lotes = await prisma.lote.findMany({
      where,
      include: { producto: { select: { nombre: true, sku: true, precio_unitario: true, categoria: { select: { nombre: true } } } } },
    });

    const items = lotes
      .filter(l => Number(l.merma_cantidad) > 0)
      .map(l => {
        const costoPorUnidad = l.costo_produccion && Number(l.cantidad_producida) > 0
          ? Number(l.costo_produccion) / Number(l.cantidad_producida)
          : Number(l.producto.precio_unitario);
        const valorMerma = Number(l.merma_cantidad) * costoPorUnidad;
        return {
          numero_lote:      l.numero_lote,
          producto:         l.producto.nombre,
          categoria:        l.producto.categoria?.nombre ?? 'Sin categoría',
          fecha_produccion: l.fecha_produccion,
          merma_cantidad:   Number(l.merma_cantidad),
          merma_porcentaje: Number(l.merma_porcentaje),
          costo_por_unidad: Math.round(costoPorUnidad),
          valor_merma:      Math.round(valorMerma),
        };
      });

    const totalValorMerma = items.reduce((s, i) => s + i.valor_merma, 0);
    const porProducto = items.reduce((acc: Record<string, any>, i) => {
      if (!acc[i.producto]) acc[i.producto] = { producto: i.producto, lotes: 0, valor_total: 0 };
      acc[i.producto].lotes++;
      acc[i.producto].valor_total += i.valor_merma;
      return acc;
    }, {});

    return {
      periodo:         { desde: params.fecha_desde, hasta: params.fecha_hasta },
      total_valor_merma: totalValorMerma,
      total_lotes:     items.length,
      detalle_lotes:   items,
      por_producto:    Object.values(porProducto).sort((a: any, b: any) => b.valor_total - a.valor_total),
    };
  },

  async getTendenciasConsumo(id_restaurante?: number) {
    const ahora     = new Date();
    const hace30    = new Date(ahora); hace30.setDate(hace30.getDate() - 30);
    const hace60    = new Date(ahora); hace60.setDate(hace60.getDate() - 60);

    const sedeWhere = id_restaurante ? { id_restaurante } : {};
    const [periodo1, periodo2] = await Promise.all([
      prisma.movimiento.groupBy({
        by: ['id_producto'],
        where: { ...sedeWhere, tipo_movimiento: { in: ['salida', 'venta', 'merma'] }, fecha_movimiento: { gte: hace30 } },
        _sum: { cantidad: true },
        _count: true,
      }),
      prisma.movimiento.groupBy({
        by: ['id_producto'],
        where: { ...sedeWhere, tipo_movimiento: { in: ['salida', 'venta', 'merma'] }, fecha_movimiento: { gte: hace60, lt: hace30 } },
        _sum: { cantidad: true },
        _count: true,
      }),
    ]);

    const mapa30 = new Map(periodo1.map(p => [p.id_producto, Number(p._sum.cantidad ?? 0)]));
    const mapa60 = new Map(periodo2.map(p => [p.id_producto, Number(p._sum.cantidad ?? 0)]));

    const ids = [...new Set([...mapa30.keys(), ...mapa60.keys()])];
    const productos = await prisma.producto.findMany({
      where: { id: { in: ids } },
      select: { id: true, nombre: true, sku: true, unidad_medida: true, stock_minimo: true, stock_maximo: true },
    });

    return productos.map(p => {
      const cons30 = mapa30.get(p.id) ?? 0;
      const cons60 = mapa60.get(p.id) ?? 0;
      const delta  = cons60 > 0 ? ((cons30 - cons60) / cons60) * 100 : 0;
      let tendencia: string;
      if (delta > 15) tendencia = 'creciente';
      else if (delta < -15) tendencia = 'decreciente';
      else tendencia = 'estable';

      const promDiario30 = cons30 / 30;
      const nuevoMin     = Math.ceil(promDiario30 * 3);
      const nuevoMax     = Math.ceil(promDiario30 * 3 * 2.5);

      return {
        id_producto:       p.id,
        nombre:            p.nombre,
        sku:               p.sku,
        consumo_30_dias:   cons30,
        consumo_60_dias:   cons60,
        variacion_porcentaje: Math.round(delta),
        tendencia,
        promedio_diario:   Math.round(promDiario30 * 100) / 100,
        stock_minimo_actual: Number(p.stock_minimo),
        stock_maximo_actual: p.stock_maximo ? Number(p.stock_maximo) : null,
        stock_minimo_sugerido: nuevoMin,
        stock_maximo_sugerido: nuevoMax,
      };
    }).sort((a, b) => Math.abs(b.variacion_porcentaje) - Math.abs(a.variacion_porcentaje));
  },

  async getTopClientes(limit = 20, id_grupo?: number) {
    return prisma.cliente.findMany({
      where:   { estado: 'activo', total_ordenes: { gt: 0 }, ...(id_grupo ? { id_grupo } : {}) },
      orderBy: { total_gastado: 'desc' },
      take:    limit,
      select: {
        id: true, nombre_completo: true, email: true, telefono: true,
        tipo_cliente: true, total_gastado: true, total_ordenes: true,
        puntos_acumulados: true, ultima_visita: true,
      },
    });
  },

  // ─── Métodos consolidados por grupo ───────────────────────────────────────────

  /**
   * getVentasConsolidadasGrupo — agrega las ventas de todos los restaurantes
   * activos de un GrupoNegocio, desglosadas por sede y con totales globales.
   */
  async getVentasConsolidadasGrupo(idGrupo: number, params: {
    fecha_desde?: Date; fecha_hasta?: Date; agrupar_por?: string;
  }) {
    const restaurantes = await getRestaurantesDeGrupo(idGrupo);
    if (!restaurantes.length) throw new NotFoundError('Grupo de negocio');

    const idEstado  = await getEstadoFinalId();
    const fechaW    = buildFechaWhere(params.fecha_desde, params.fecha_hasta);
    const agruparPor = params.agrupar_por ?? 'dia';

    const idsRest = restaurantes.map(r => r.id);
    const nombresPorId = new Map(restaurantes.map(r => [r.id, r.nombre]));

    const ordenes = await prisma.orden.findMany({
      where: {
        id_estado:       idEstado,
        id_restaurante:  { in: idsRest },
        ...(fechaW ? { fecha_apertura: fechaW } : {}),
      },
      select: {
        id_restaurante: true, fecha_apertura: true,
        total: true, subtotal: true, impuestos: true,
      },
      orderBy: { fecha_apertura: 'asc' },
    });

    // Desglose por restaurante
    const porRestaurante = new Map<number, {
      restaurante: string; ordenes: number; total: number; subtotal: number; impuestos: number;
    }>();
    idsRest.forEach(id => porRestaurante.set(id, {
      restaurante: nombresPorId.get(id)!,
      ordenes: 0, total: 0, subtotal: 0, impuestos: 0,
    }));

    // Desglose por periodo
    const porPeriodo = new Map<string, {
      periodo: string; ordenes: number; total: number; subtotal: number; impuestos: number;
    }>();

    ordenes.forEach(o => {
      // Acumular por restaurante
      const rest = porRestaurante.get(o.id_restaurante)!;
      rest.ordenes++;
      rest.total    += Number(o.total);
      rest.subtotal += Number(o.subtotal);
      rest.impuestos += Number(o.impuestos);

      // Acumular por periodo
      const f = new Date(o.fecha_apertura);
      let key: string;
      switch (agruparPor) {
        case 'hora': key = `${f.toISOString().split('T')[0]} ${f.getHours()}:00`; break;
        case 'mes':  key = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`; break;
        default:     key = f.toISOString().split('T')[0];
      }
      if (!porPeriodo.has(key)) porPeriodo.set(key, { periodo: key, ordenes: 0, total: 0, subtotal: 0, impuestos: 0 });
      const g = porPeriodo.get(key)!;
      g.ordenes++;
      g.total    += Number(o.total);
      g.subtotal += Number(o.subtotal);
      g.impuestos += Number(o.impuestos);
    });

    const totalOrdenes  = ordenes.length;
    const totalVentas   = ordenes.reduce((s, o) => s + Number(o.total),    0);
    const totalSubtotal = ordenes.reduce((s, o) => s + Number(o.subtotal), 0);
    const totalImpuestos = ordenes.reduce((s, o) => s + Number(o.impuestos), 0);

    return {
      id_grupo: idGrupo,
      periodo:           { desde: params.fecha_desde, hasta: params.fecha_hasta },
      totales_globales: {
        total_ordenes:   totalOrdenes,
        total_ventas:    totalVentas,
        total_subtotal:  totalSubtotal,
        total_impuestos: totalImpuestos,
        ticket_promedio: totalOrdenes > 0 ? totalVentas / totalOrdenes : 0,
      },
      por_restaurante: Array.from(porRestaurante.values()),
      ventas_por_periodo: Array.from(porPeriodo.values())
        .sort((a, b) => a.periodo.localeCompare(b.periodo)),
    };
  },

  /**
   * getProductosMasVendidosGrupo — top productos considerando todos los
   * restaurantes del grupo. Cada entrada incluye qué sede(s) vendió el producto.
   */
  async getProductosMasVendidosGrupo(idGrupo: number, params: {
    fecha_desde?: Date; fecha_hasta?: Date; limit?: number;
  }) {
    const restaurantes = await getRestaurantesDeGrupo(idGrupo);
    if (!restaurantes.length) throw new NotFoundError('Grupo de negocio');

    const idEstado = await getEstadoFinalId();
    const fechaW   = buildFechaWhere(params.fecha_desde, params.fecha_hasta);
    const idsRest  = restaurantes.map(r => r.id);

    const items = await prisma.ordenDetalle.findMany({
      where: {
        orden: {
          id_estado:      idEstado,
          id_restaurante: { in: idsRest },
          ...(fechaW ? { fecha_apertura: fechaW } : {}),
        },
      },
      include: {
        producto: { include: { categoria: true } },
        orden:    { select: { id_restaurante: true } },
      },
    }) as any[];

    const mapa = new Map<number, any>();
    items.forEach(item => {
      const id = item.id_producto;
      if (!mapa.has(id)) mapa.set(id, {
        producto_id:       id,
        nombre:            item.producto.nombre,
        sku:               item.producto.sku,
        categoria:         item.producto.categoria?.nombre,
        cantidad_vendida:  0,
        total_vendido:     0,
        numero_ordenes:    0,
        restaurantes_con_ventas: new Set<number>(),
      });
      const d = mapa.get(id)!;
      d.cantidad_vendida += Number(item.cantidad);
      d.total_vendido    += Number(item.subtotal);
      d.numero_ordenes++;
      d.restaurantes_con_ventas.add(item.orden.id_restaurante);
    });

    const nombresPorId = new Map(restaurantes.map(r => [r.id, r.nombre]));

    return Array.from(mapa.values())
      .map(d => ({
        producto_id:             d.producto_id,
        nombre:                  d.nombre,
        sku:                     d.sku,
        categoria:               d.categoria,
        cantidad_vendida:        d.cantidad_vendida,
        total_vendido:           d.total_vendido,
        numero_ordenes:          d.numero_ordenes,
        restaurantes_con_ventas: [...d.restaurantes_con_ventas]
          .map(rid => nombresPorId.get(rid) ?? String(rid)),
      }))
      .sort((a, b) => b.cantidad_vendida - a.cantidad_vendida)
      .slice(0, params.limit ?? 20);
  },

  /**
   * getMetodosPagoGrupo — agrega los métodos de pago de las órdenes del grupo
   * de negocio (todas sus sedes).
   */
  async getMetodosPagoGrupo(idGrupo: number, params: {
    fecha_desde?: Date; fecha_hasta?: Date;
  }) {
    const restaurantes = await getRestaurantesDeGrupo(idGrupo);
    if (!restaurantes.length) throw new NotFoundError('Grupo de negocio');

    const idsRest  = restaurantes.map(r => r.id);
    const fechaW   = buildFechaWhere(params.fecha_desde, params.fecha_hasta);
    const idEstado = await getEstadoFinalId();

    const pagos = await prisma.pago.findMany({
      where: {
        orden: {
          id_estado:      idEstado,
          id_restaurante: { in: idsRest },
          ...(fechaW ? { fecha_apertura: fechaW } : {}),
        },
      },
      include: { metodo_pago: { select: { nombre: true } } },
    }) as any[];

    const mapa = new Map<string, { metodo: string; transacciones: number; total: number }>();
    const acumular = (nombre: string, monto: number) => {
      if (!mapa.has(nombre)) mapa.set(nombre, { metodo: nombre, transacciones: 0, total: 0 });
      const e = mapa.get(nombre)!;
      e.transacciones++;
      e.total += monto;
    };

    pagos.forEach((p: any) => acumular(p.metodo_pago.nombre, Number(p.monto)));

    return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
  },

  /**
   * getTopClientesGrupo — top clientes por gasto total en ordenes
   * vinculadas a los restaurantes del grupo.
   */
  async getTopClientesGrupo(idGrupo: number, limit = 20) {
    const restaurantes = await getRestaurantesDeGrupo(idGrupo);
    if (!restaurantes.length) throw new NotFoundError('Grupo de negocio');

    const idEstado = await getEstadoFinalId();
    const idsRest  = restaurantes.map(r => r.id);

    const ordenes = await prisma.orden.findMany({
      where: {
        id_estado:      idEstado,
        id_restaurante: { in: idsRest },
        id_cliente:     { not: null },
      },
      select: { id_cliente: true, total: true, fecha_apertura: true },
    });

    const mapa = new Map<number, { total_gastado: number; total_ordenes: number; ultima_visita: Date }>();
    ordenes.forEach(o => {
      const cid = o.id_cliente!;
      if (!mapa.has(cid)) mapa.set(cid, { total_gastado: 0, total_ordenes: 0, ultima_visita: o.fecha_apertura });
      const e = mapa.get(cid)!;
      e.total_gastado  += Number(o.total);
      e.total_ordenes++;
      if (o.fecha_apertura > e.ultima_visita) e.ultima_visita = o.fecha_apertura;
    });

    if (!mapa.size) return [];

    const topIds = Array.from(mapa.entries())
      .sort((a, b) => b[1].total_gastado - a[1].total_gastado)
      .slice(0, limit)
      .map(([id]) => id);

    const clientes = await prisma.cliente.findMany({
      where:  { id: { in: topIds } },
      select: { id: true, nombre_completo: true, email: true, telefono: true, tipo_cliente: true },
    });

    return clientes.map(c => ({
      ...c,
      ...mapa.get(c.id)!,
    })).sort((a, b) => b.total_gastado - a.total_gastado);
  },

  /**
   * getReporteConsolidadoGrupo — reporte completo del grupo:
   * ventas, productos, métodos de pago, top clientes.
   *
   * Equivalente a `getReporteCompleto` pero para un GrupoNegocio completo.
   */
  async getReporteConsolidadoGrupo(idGrupo: number, params: {
    fecha_desde?: Date; fecha_hasta?: Date;
  }) {
    // Validar que el grupo existe
    const grupo = await prisma.grupoNegocio.findUnique({
      where:  { id: idGrupo },
      select: { id: true, nombre: true },
    });
    if (!grupo) throw new NotFoundError('Grupo de negocio');

    const [ventas, productos, metodosPago, topClientes] = await Promise.all([
      reporteService.getVentasConsolidadasGrupo(idGrupo, params),
      reporteService.getProductosMasVendidosGrupo(idGrupo, { ...params, limit: 10 }),
      reporteService.getMetodosPagoGrupo(idGrupo, params),
      reporteService.getTopClientesGrupo(idGrupo, 10),
    ]);

    return {
      grupo:        { id: grupo.id, nombre: grupo.nombre },
      periodo:      { desde: params.fecha_desde, hasta: params.fecha_hasta },
      ventas,
      productos,
      metodos_pago: metodosPago,
      top_clientes: topClientes,
    };
  },

  /**
   * getSuperConsolidado — reporte maestro para el super admin.
   * Agrega TODOS los grupos de negocio activos del sistema.
   * Solo accesible por el super admin (el middleware lo garantiza).
   */
  async getSuperConsolidado(params: { fecha_desde?: Date; fecha_hasta?: Date }) {
    const grupos = await prisma.grupoNegocio.findMany({
      where:   { activo: true },
      select:  { id: true, nombre: true, plan: true },
      orderBy: { nombre: 'asc' },
    });
    if (!grupos.length) return { grupos: [], totales_globales: { total_ordenes: 0, total_ventas: 0, ticket_promedio: 0 }, por_grupo: [] };

    const idEstado = await getEstadoFinalId();
    const fechaW   = buildFechaWhere(params.fecha_desde, params.fecha_hasta);

    // Un query por todos los grupos (sin filtrar por grupo — el SA ve todo)
    const ordenes = await prisma.orden.findMany({
      where: {
        id_estado: idEstado,
        restaurante: { activo: true },
        ...(fechaW ? { fecha_apertura: fechaW } : {}),
      },
      select: {
        id_restaurante: true,
        total: true,
        subtotal: true,
        impuestos: true,
        restaurante: { select: { id_grupo: true, nombre: true } },
      },
    });

    // Acumular por grupo
    const porGrupoMap = new Map<number, {
      id_grupo: number; nombre_grupo: string; plan: string;
      total_ordenes: number; total_ventas: number; total_subtotal: number; total_impuestos: number;
    }>();

    for (const g of grupos) {
      porGrupoMap.set(g.id, {
        id_grupo:     g.id,
        nombre_grupo: g.nombre,
        plan:         g.plan,
        total_ordenes: 0, total_ventas: 0, total_subtotal: 0, total_impuestos: 0,
      });
    }

    for (const o of ordenes) {
      const idGrupo = o.restaurante.id_grupo;
      if (!porGrupoMap.has(idGrupo)) continue;
      const entry = porGrupoMap.get(idGrupo)!;
      entry.total_ordenes++;
      entry.total_ventas   += Number(o.total);
      entry.total_subtotal += Number(o.subtotal);
      entry.total_impuestos += Number(o.impuestos);
    }

    const porGrupo = Array.from(porGrupoMap.values()).map(g => ({
      ...g,
      ticket_promedio: g.total_ordenes > 0 ? g.total_ventas / g.total_ordenes : 0,
    })).sort((a, b) => b.total_ventas - a.total_ventas);

    const totalOrdenes = ordenes.length;
    const totalVentas  = ordenes.reduce((s, o) => s + Number(o.total), 0);

    return {
      periodo:         { desde: params.fecha_desde, hasta: params.fecha_hasta },
      total_grupos:    grupos.length,
      totales_globales: {
        total_ordenes:   totalOrdenes,
        total_ventas:    totalVentas,
        total_subtotal:  ordenes.reduce((s, o) => s + Number(o.subtotal), 0),
        total_impuestos: ordenes.reduce((s, o) => s + Number(o.impuestos), 0),
        ticket_promedio: totalOrdenes > 0 ? totalVentas / totalOrdenes : 0,
      },
      por_grupo: porGrupo,
    };
  },

  async getLotesPorVencer(dias = 30, id_restaurante?: number) {
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() + dias);

    const lotes = await prisma.lote.findMany({
      where: {
        fecha_vencimiento: { lte: fechaLimite, gte: new Date() },
        estado_lote: { in: ['activo' as any, 'en_produccion' as any] },
        ...(id_restaurante ? { id_restaurante } : {}),
      },
      include: {
        producto: {
          select: { nombre: true, sku: true, precio_unitario: true,
                    categoria: { select: { nombre: true } } },
        },
        responsable: { select: { nombre_completo: true } },
      },
      orderBy: { fecha_vencimiento: 'asc' },
    });

    return lotes.map(l => {
      const diasRestantes = l.fecha_vencimiento
        ? Math.ceil((l.fecha_vencimiento.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;
      const valorEnRiesgo = Number(l.cantidad_producida) * Number(l.producto.precio_unitario);
      return {
        ...l,
        dias_restantes:  diasRestantes,
        valor_en_riesgo: Math.round(valorEnRiesgo),
        urgencia:        diasRestantes !== null
          ? diasRestantes <= 3 ? 'critica' : diasRestantes <= 7 ? 'alta' : 'media'
          : 'desconocida',
      };
    });
  },
};
