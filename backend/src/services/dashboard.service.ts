/**
 * DashboardService - Lógica de negocio para el dashboard
 *
 * Nomenclatura de campos en la respuesta:
 * - productos:        total de productos en BD (antes 'totalProductos' — renombrado para coincidir con frontend)
 * - ordenesHoy:       cantidad de órdenes creadas hoy
 * - productosActivos: productos con estado 'activo'
 * - alertas:          cantidad de productos con stock <= stock_minimo
 * - ventasHoy:        suma de totales de órdenes entregadas hoy
 * - stockBajo:        lista de productos con stock crítico (máx 10)
 * - ventasSemana:     ventas agrupadas por día de los últimos 7 días
 * - topProductos:     5 productos más vendidos (por cantidad)
 */

import { EstadoGeneral } from '@prisma/client';
import prisma from '../config/database';
import { ordenRepository } from '../repositories/orden.repository';
import { productoRepository } from '../repositories/producto.repository';
import { productoService } from './producto.service';

/**
 * Busca el id del estado 'ENTREGADA' en BD.
 * Se usa para filtrar solo órdenes completadas en ventas y top productos.
 * Retorna 0 si no existe el estado (evita crash, simplemente no habrá resultados).
 */
const getEstadoFinalId = async (): Promise<number> => {
  const estado = await prisma.estadoOrden.findFirst({
    where: { codigo: 'ENTREGADA' },
  });
  return estado?.id ?? 0;
};

export const dashboardService = {

  /**
   * getStats — estadísticas generales para las tarjetas del dashboard
   *
   * Todas las queries corren en paralelo con Promise.all para minimizar
   * el tiempo de respuesta total (no dependen entre sí excepto idEstado).
   */
  async getStats(id_restaurante?: number, id_grupo?: number) {
    // Rango de hoy: desde 00:00:00 hasta 00:00:00 del día siguiente
    const hoy    = new Date(); hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy); manana.setDate(manana.getDate() + 1);

    // Necesitamos el id del estado final para filtrar órdenes completadas
    const idEstado = await getEstadoFinalId();

    const [
      total,          // total de productos del catálogo del grupo
      ordenesHoy,     // cantidad de órdenes creadas hoy
      activos,        // productos activos del grupo
      ventasHoy,      // suma de ventas de órdenes entregadas hoy
      ventasSemana,   // ventas agrupadas por día últimos 7 días
      stockBajoLista, // productos con stock crítico en la sede activa
    ] = await Promise.all([
      productoRepository.count(id_grupo, id_restaurante),
      ordenRepository.countHoy(hoy, manana, id_restaurante),
      productoRepository.countByEstado(EstadoGeneral.activo, id_grupo, id_restaurante),
      ordenRepository.aggregateVentasHoy(idEstado, hoy, manana, id_restaurante),
      ordenRepository.groupByFechaSemana(
        idEstado,
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // hace 7 días
        id_restaurante,
      ),
      productoService.stockBajo(id_restaurante),
    ]);

    // Stock bajo = stock_actual <= stock_minimo (incluye agotados)
    const stockBajo = stockBajoLista.slice(0, 10); // máx 10 para no sobrecargar el dashboard

    // Top 5 productos más vendidos — requiere dos queries:
    // 1. Agregar por id_producto para obtener cantidades
    // 2. Buscar nombres de los productos resultantes
    const top   = await ordenRepository.topProductos(idEstado, 5, id_restaurante);
    const ids   = top.map(p => p.id_producto);
    const prods = await prisma.producto.findMany({ where: { id: { in: ids } } });

    const topProductos = top.map(item => ({
      producto_id:      item.id_producto,
      nombre:           prods.find(p => p.id === item.id_producto)?.nombre,
      cantidad_vendida: Number(item._sum.cantidad ?? 0),
      total_vendido:    Number(item._sum.subtotal ?? 0),
    }));

    return {
      // 'productos' en lugar de 'totalProductos' — coincide con DashboardStats del frontend
      productos:        total,
      ordenesHoy,
      productosActivos: activos,
      alertas:          stockBajo.length,
      ventasHoy:        Number(ventasHoy._sum.total ?? 0),
      stockBajo,
      ventasSemana: ventasSemana.map(v => ({
        fecha: v.fecha_apertura,
        total: Number(v._sum.total ?? 0),
      })),
      topProductos,
    };
  },

  /**
   * getResumenVentas — ventas agrupadas por fecha y tipo de orden
   * Usado para gráficas de tendencia en la página de reportes.
   * 'dias' controla el rango hacia atrás desde hoy (default 30).
   */
  async getResumenVentas(dias = 30, id_restaurante?: number) {
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - dias);
    const idEstado = await getEstadoFinalId();

    const ventas = await ordenRepository.groupByFecha({
      id_estado:      idEstado,
      fecha_apertura: { gte: fechaInicio },
      ...(id_restaurante ? { id_restaurante } : {}),
    });

    return ventas.map(v => ({
      fecha:            v.fecha_apertura,
      tipo_orden:       v.tipo_orden,
      total:            Number(v._sum.total ?? 0),
      cantidad_ordenes: v._count,
    }));
  },

  /**
   * getAlertasInventario — productos con stock crítico, aislado por restaurante.
   *
   * Cuando se provee id_restaurante, usa ProductoStock (stock real por sede).
   * Sin id_restaurante (super admin global): fallback al catálogo global.
   *
   * Separa en dos categorías:
   * - stockBajo:    stock > 0 pero <= stock_minimo (alerta amarilla)
   * - stockAgotado: stock = 0 (alerta roja)
   */
  async getAlertasInventario(id_restaurante?: number) {
    if (id_restaurante !== undefined) {
      const stocks = await prisma.productoStock.findMany({
        where: { id_restaurante, activo: true },
        include: {
          producto: {
            select: { id: true, nombre: true, sku: true, estado: true, categoria: { select: { nombre: true } } },
          },
        },
      });
      const activos      = stocks.filter(s => (s.producto as any)?.estado === EstadoGeneral.activo);
      const stockBajo    = activos.filter(s => Number(s.stock_actual) > 0 && Number(s.stock_actual) <= Number(s.stock_minimo));
      const stockAgotado = activos.filter(s => Number(s.stock_actual) === 0);
      const toDto = (s: typeof activos[0]) => ({
        ...(s.producto as any),
        stock_actual: Number(s.stock_actual),
        stock_minimo: Number(s.stock_minimo),
      });
      return {
        stockBajo:    stockBajo.map(toDto),
        stockAgotado: stockAgotado.map(toDto),
        totalAlertas: stockBajo.length + stockAgotado.length,
      };
    }
    // Fallback: super admin sin restaurante activo — usa catálogo global
    const productos    = await productoRepository.findActivos() as any[];
    const stockBajo    = productos.filter(p =>
      Number(p.stock_actual) > 0 && Number(p.stock_actual) <= Number(p.stock_minimo)
    );
    const stockAgotado = productos.filter(p => Number(p.stock_actual) === 0);
    return {
      stockBajo,
      stockAgotado,
      totalAlertas: stockBajo.length + stockAgotado.length,
    };
  },
};