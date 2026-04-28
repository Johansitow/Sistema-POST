/**
 * ListaComprasService
 * Generación automática y gestión de listas de compras
 */

import prisma from '../config/database';
import { listaComprasRepository } from '../repositories/lista-compras.repository';
import { proveedorRepository }    from '../repositories/proveedor.repository';
import { NotFoundError, BadRequestError } from '../exceptions/HttpErrors';
import { getPaginationParams, buildPaginatedResult } from '../lib/pagination';
import { assertRestauranteId } from '../lib/tenantQuery';
import { EstadoListaCompras } from '@prisma/client';

const PREFIJO_LISTA = 'LC-';

export const listaComprasService = {

  async listar(params: {
    page?: unknown; limit?: unknown;
    estado?: EstadoListaCompras;
    id_proveedor?: number;
    desde?: Date;
    hasta?: Date;
    id_restaurante?: number;
  }) {
    const pagination = getPaginationParams(params.page, params.limit);
    const [listas, total] = await listaComprasRepository.findAll(pagination, {
      estado:         params.estado,
      id_proveedor:   params.id_proveedor,
      desde:          params.desde,
      hasta:          params.hasta,
      id_restaurante: params.id_restaurante,
    });
    return buildPaginatedResult(listas, total, pagination);
  },

  async obtenerPorId(id: number) {
    const lista = await listaComprasRepository.findById(id);
    if (!lista) throw new NotFoundError('Lista de compras');
    return lista;
  },

  /**
   * Genera una lista de compras automáticamente para todos los productos
   * cuyo stock_actual <= stock_minimo en el restaurante indicado.
   * Lee desde ProductoStock (per-restaurante) para evitar contaminación de datos
   * entre restaurantes del mismo grupo.
   */
  async generarAutomatico(id_usuario: number, opciones: {
    notas?: string;
    id_proveedor_asignado?: number;
    id_restaurante: number;   // OBLIGATORIO — no puede generarse sin contexto de restaurante
  }): Promise<any> {
    assertRestauranteId(opciones.id_restaurante);
    const idRestaurante = opciones.id_restaurante;

    // 1. Obtener productos bajo stock mínimo PARA ESTE RESTAURANTE.
    //    Lee desde producto_stock (fuente autoritativa per-restaurante), NO desde
    //    productos.stock_actual (campo global que no distingue entre restaurantes).
    const productosRaw = await prisma.$queryRaw<{
      id: number; nombre: string; sku: string; unidad_medida: string;
      stock_actual: number; stock_minimo: number; stock_maximo: number | null;
    }[]>`
      SELECT p.id, p.nombre, p.sku, p.unidad_medida::text AS unidad_medida,
             ps.stock_actual::float, ps.stock_minimo::float, ps.stock_maximo::float
      FROM   producto_stock ps
      JOIN   productos p ON p.id = ps.id_producto
      WHERE  p.estado   = 'activo'
        AND  ps.id_restaurante = ${idRestaurante}
        AND  ps.activo         = true
        AND  ps.stock_minimo   > 0
        AND  ps.stock_actual  <= ps.stock_minimo
    `;

    if (!productosRaw.length) {
      return { mensaje: 'No hay productos con stock bajo el mínimo', lista: null };
    }

    // 2. Para cada producto, buscar el mejor proveedor y calcular cantidad a pedir
    const items: {
      id_producto:            number;
      id_proveedor_sugerido?: number;
      cantidad_sugerida:      number;
      precio_estimado?:       number;
      observaciones?:         string;
    }[] = [];

    let totalEstimado = 0;
    let mejorProveedorGeneral: number | undefined = opciones?.id_proveedor_asignado;

    for (const prod of productosRaw) {
      const stockMax  = prod.stock_maximo ?? prod.stock_minimo * 2.5;
      const cantPedir = Math.max(0, stockMax - prod.stock_actual);
      if (cantPedir <= 0) continue;

      const mejorRelacion = await proveedorRepository.findMejorProveedorParaProducto(prod.id);
      const precioUnit    = mejorRelacion ? Number(mejorRelacion.precio_unitario) : undefined;

      if (precioUnit) totalEstimado += cantPedir * precioUnit;

      if (!mejorProveedorGeneral && mejorRelacion) {
        mejorProveedorGeneral = mejorRelacion.id_proveedor;
      }

      items.push({
        id_producto:            prod.id,
        id_proveedor_sugerido:  mejorRelacion?.id_proveedor,
        cantidad_sugerida:      cantPedir,
        precio_estimado:        precioUnit ? cantPedir * precioUnit : undefined,
        observaciones:          `Stock actual: ${prod.stock_actual} ${prod.unidad_medida}, mínimo: ${prod.stock_minimo}`,
      });
    }

    if (!items.length) {
      return { mensaje: 'No hay cantidades a pedir', lista: null };
    }

    // 3. Crear la lista dentro de una transaction para evitar race condition en numero_lista @unique
    const lista = await prisma.$transaction(async (tx) => {
      // Leer el último numero dentro del mismo tx para serializar acceso concurrente
      const ultima = await tx.listaCompras.findFirst({ orderBy: { numero_lista: 'desc' }, select: { numero_lista: true } });
      const num = ultima ? parseInt(ultima.numero_lista.replace(PREFIJO_LISTA, ''), 10) : 0;
      const numeroLista = `${PREFIJO_LISTA}${String(num + 1).padStart(6, '0')}`;

      return tx.listaCompras.create({
        data: {
          numero_lista:           numeroLista,
          id_usuario_generado:    id_usuario,
          id_proveedor_asignado:  mejorProveedorGeneral,
          id_restaurante:         idRestaurante,
          notas:                  opciones?.notas ?? 'Generada automáticamente por stock bajo',
          total_estimado:         totalEstimado > 0 ? totalEstimado : undefined,
          items: {
            create: items.map(item => ({
              id_producto:           item.id_producto,
              id_proveedor_sugerido: item.id_proveedor_sugerido,
              cantidad_sugerida:     item.cantidad_sugerida,
              precio_estimado:       item.precio_estimado,
              observaciones:         item.observaciones,
            })),
          },
        },
        include: {
          usuario_generado:   { select: { id: true, nombre_completo: true } },
          proveedor_asignado: true,
          items: { include: { producto: { select: { id: true, nombre: true, sku: true, unidad_medida: true, stock_actual: true, stock_minimo: true, stock_maximo: true } } } },
        },
      });
    });

    // 4. Crear alerta con contexto de restaurante
    try {
      await prisma.alerta.create({
        data: {
          id_tipo_alerta:  await obtenerTipoAlertaId('LISTA_COMPRA'),
          id_restaurante:  idRestaurante,
          mensaje:         `Lista de compras ${lista.numero_lista} generada automáticamente con ${items.length} producto(s).`,
          nivel_prioridad: 'alta',
        },
      });
    } catch { /* no bloquear */ }

    return { lista, total_items: items.length };
  },

  async cambiarEstado(id: number, data: {
    estado:           EstadoListaCompras;
    notas?:           string;
    fecha_envio?:     Date;
    fecha_recepcion?: Date;
  }) {
    const lista = await this.obtenerPorId(id);

    const transicionesValidas: Record<string, EstadoListaCompras[]> = {
      generada:  ['enviada', 'cancelada'],
      enviada:   ['recibida', 'parcial', 'cancelada'],
      parcial:   ['recibida', 'cancelada'],
      recibida:  [],
      cancelada: [],
    };

    const permitidas = transicionesValidas[lista.estado] ?? [];
    if (!permitidas.includes(data.estado)) {
      throw new BadRequestError(
        `No se puede cambiar de estado '${lista.estado}' a '${data.estado}'`
      );
    }

    return listaComprasRepository.update(id, {
      estado:          data.estado,
      notas:           data.notas,
      fecha_envio:     data.fecha_envio,
      fecha_recepcion: data.fecha_recepcion,
    });
  },

  async actualizarItem(id_lista: number, id_item: number, data: {
    cantidad_recibida: number;
    observaciones?:    string;
  }) {
    await this.obtenerPorId(id_lista);
    return listaComprasRepository.updateItem(id_item, data);
  },
};

async function obtenerTipoAlertaId(codigo: string): Promise<number> {
  const tipo = await prisma.tipoAlerta.findFirst({ where: { codigo } });
  return tipo?.id ?? 1;
}
