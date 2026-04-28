/**
 * OrdenGrupoService — Órdenes multi-restaurante
 *
 * Flujo:
 * 1. crear()           → crea el OrdenGrupo vacío
 * 2. agregarOrden()    → asocia una Orden existente al grupo (actualiza sufijo)
 * 3. recalcularTotales() → suma totales de todas las órdenes del grupo
 * 4. registrarPago()   → agrega un PagoGrupo y cierra si está saldado
 */

import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../config/database';
import { ordenGrupoRepository }   from '../repositories/orden-grupo.repository';
import { grupoNegocioRepository } from '../repositories/grupo-negocio.repository';
import { NotFoundError, BadRequestError, ForbiddenError } from '../exceptions/HttpErrors';
import { getPaginationParams, buildPaginatedResult } from '../lib/pagination';
import { TokenPayload } from '../middlewares/auth.middleware';
import { eventBus } from '../events/eventBus';
import { EVENTS } from '../events/events';

// Prefijo global para números de grupo
const PREFIJO = 'GRP-';

const SUFIJOS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const ordenGrupoService = {

  async listar(params: {
    page?:       unknown;
    limit?:      unknown;
    id_grupo?:   number;
    id_usuario?: number;
    estado?:     string;
    desde?:      Date;
    hasta?:      Date;
  }) {
    const pagination = getPaginationParams(params.page, params.limit);
    const [grupos, total] = await ordenGrupoRepository.findAll(pagination, {
      id_grupo:   params.id_grupo,
      id_usuario: params.id_usuario,
      estado:     params.estado,
      desde:      params.desde,
      hasta:      params.hasta,
    });
    return buildPaginatedResult(grupos, total, pagination);
  },

  async obtenerPorId(id: number) {
    const og = await ordenGrupoRepository.findById(id);
    if (!og) throw new NotFoundError('OrdenGrupo');
    return og;
  },

  async crear(data: {
    id_grupo:   number;
    id_usuario: number;
    notas?:     string;
  }) {
    // Validar grupo
    const grupo = await grupoNegocioRepository.findById(data.id_grupo);
    if (!grupo || !grupo.activo) throw new NotFoundError('Grupo de negocio');

    // Número secuencial
    const ultimo       = await ordenGrupoRepository.findUltimo();
    const ultimoNum    = ultimo ? parseInt(ultimo.numero_grupo.replace(PREFIJO, ''), 10) : 0;
    const numero_grupo = `${PREFIJO}${String(ultimoNum + 1).padStart(6, '0')}`;

    return ordenGrupoRepository.create({ numero_grupo, ...data });
  },

  /**
   * Asocia una Orden existente al grupo, asignándole sufijo automático.
   * La orden no puede pertenecer ya a otro grupo.
   */
  async agregarOrden(id_orden_grupo: number, id_orden: number) {
    const og = await this.obtenerPorId(id_orden_grupo);
    if (og.estado !== 'abierto') {
      throw new BadRequestError('Solo se pueden agregar órdenes a un grupo abierto');
    }

    const orden = await prisma.orden.findUnique({ where: { id: id_orden } });
    if (!orden) throw new NotFoundError('Orden');
    if (orden.id_orden_grupo && orden.id_orden_grupo !== id_orden_grupo) {
      throw new BadRequestError('La orden ya pertenece a otro grupo');
    }

    // Calcular sufijo: A, B, C... según cuántas órdenes ya hay en el grupo
    const conteoPrevio = await prisma.orden.count({ where: { id_orden_grupo } });
    const sufijo_orden = `-${SUFIJOS[conteoPrevio] ?? conteoPrevio}`;

    await prisma.orden.update({
      where: { id: id_orden },
      data:  { id_orden_grupo, sufijo_orden },
    });

    // Recalcular totales del grupo
    await ordenGrupoRepository.recalcularTotales(id_orden_grupo);
    return this.obtenerPorId(id_orden_grupo);
  },

  async registrarPago(id_orden_grupo: number, data: {
    id_metodo_pago: number;
    monto:          number;
    referencia?:    string;
  }) {
    const og = await this.obtenerPorId(id_orden_grupo);
    if (og.estado === 'cancelado') {
      throw new BadRequestError('No se puede pagar un grupo cancelado');
    }

    const pago = await ordenGrupoRepository.agregarPago({
      id_orden_grupo,
      id_metodo_pago: data.id_metodo_pago,
      monto:          new Decimal(data.monto),
      referencia:     data.referencia,
    });

    // Verificar si el grupo queda saldado
    const { _sum } = await ordenGrupoRepository.sumPagos(id_orden_grupo);
    const totalPagado = _sum.monto ?? new Decimal(0);
    if (totalPagado.gte(og.total)) {
      await ordenGrupoRepository.updateEstado(id_orden_grupo, 'pagado', new Date());
    }

    return pago;
  },

  async cancelar(id_orden_grupo: number) {
    const og = await this.obtenerPorId(id_orden_grupo);
    if (og.estado === 'pagado') {
      throw new BadRequestError('No se puede cancelar un grupo ya pagado');
    }
    await ordenGrupoRepository.updateEstado(id_orden_grupo, 'cancelado', new Date());
    return this.obtenerPorId(id_orden_grupo);
  },

  // ===========================================================================
  // crearConOrdenes — flujo atómico multi-restaurante
  // ===========================================================================
  /**
   * Crea el OrdenGrupo + una Orden por restaurante en UNA transacción.
   *
   * Escenario: cliente quiere productos de Rest. A y Rest. B en un solo checkout.
   * Resultado:
   *   OrdenGrupo GRP-000001
   *     ├── Orden GRP-000001-A (Restaurante A, items del restaurante A)
   *     └── Orden GRP-000001-B (Restaurante B, items del restaurante B)
   *
   * @param usuario — TokenPayload del usuario que crea las órdenes
   * @param data    — grupo + id_estado inicial + items agrupados por restaurante
   */
  async crearConOrdenes(
    usuario: TokenPayload,
    data: {
      id_grupo:    number;
      id_estado:   number;
      tipo_orden:  string;
      notas?:      string;
      id_cliente?: number;
      restaurantes: Array<{
        id_restaurante: number;
        items: Array<{
          id_producto:     number;
          id_variante?:    number;
          cantidad:        number;
          precio_unitario: number;
          notas?:          string;
        }>;
      }>;
    }
  ) {
    // Validar grupo
    const grupo = await grupoNegocioRepository.findById(data.id_grupo);
    if (!grupo || !grupo.activo) throw new NotFoundError('Grupo de negocio');

    // Validar acceso del usuario a cada restaurante (no-superadmin)
    if (!usuario.es_super_admin) {
      const accesibles = new Set(usuario.restaurantes.map(r => r.id));
      const sinAcceso  = data.restaurantes
        .map(r => r.id_restaurante)
        .filter(id => !accesibles.has(id));
      if (sinAcceso.length > 0) {
        throw new ForbiddenError(`Sin acceso a restaurantes: ${sinAcceso.join(', ')}`);
      }
    }

    // Generar número de grupo secuencial
    const ultimo       = await ordenGrupoRepository.findUltimo();
    const ultimoNum    = ultimo ? parseInt(ultimo.numero_grupo.replace(PREFIJO, ''), 10) : 0;
    const numero_grupo = `${PREFIJO}${String(ultimoNum + 1).padStart(6, '0')}`;

    return prisma.$transaction(async (tx) => {
      // 1. Crear OrdenGrupo vacío
      const ordenGrupo = await tx.ordenGrupo.create({
        data: {
          numero_grupo,
          id_grupo:   data.id_grupo,
          id_usuario: usuario.id,
          notas:      data.notas,
        },
      });

      // 2. Crear una Orden por restaurante con su sufijo
      const ordenes = await Promise.all(
        data.restaurantes.map(async ({ id_restaurante, items }, idx) => {
          const sufijo       = `-${SUFIJOS[idx] ?? idx}`;
          const numero_orden = `${numero_grupo}${sufijo}`;

          const subtotal = items.reduce(
            (sum, i) => sum + i.cantidad * i.precio_unitario, 0
          );

          return tx.orden.create({
            data: {
              numero_orden,
              sufijo_orden:   sufijo,
              id_restaurante,
              id_usuario:     usuario.id,
              id_estado:      data.id_estado,
              id_cliente:     data.id_cliente,
              id_orden_grupo: ordenGrupo.id,
              tipo_orden:     data.tipo_orden as any,
              subtotal:       new Decimal(subtotal),
              total:          new Decimal(subtotal),
              detalles: {
                create: items.map(i => ({
                  id_producto:     i.id_producto,
                  id_variante:     i.id_variante,
                  cantidad:        new Decimal(i.cantidad),
                  precio_unitario: new Decimal(i.precio_unitario),
                  subtotal:        new Decimal(i.cantidad * i.precio_unitario),
                  total:           new Decimal(i.cantidad * i.precio_unitario),
                  notas:           i.notas,
                })),
              },
            },
            include: { detalles: { include: { producto: { select: { nombre: true } } } } },
          });
        })
      );

      // 3. Calcular totales consolidados
      const totales = ordenes.reduce(
        (acc, o) => ({
          subtotal:  acc.subtotal.plus(o.subtotal),
          impuestos: acc.impuestos.plus(o.impuestos),
          total:     acc.total.plus(o.total),
        }),
        { subtotal: new Decimal(0), impuestos: new Decimal(0), total: new Decimal(0) }
      );

      // 4. Actualizar totales del grupo
      const grupoFinal = await tx.ordenGrupo.update({
        where: { id: ordenGrupo.id },
        data:  totales,
        include: {
          ordenes: {
            include: {
              restaurante: { select: { id: true, nombre: true } },
              detalles:    { include: { producto: { select: { nombre: true } } } },
            },
          },
        },
      });

      // 5. Emitir eventos por cada orden creada (fire-and-forget)
      ordenes.forEach(o => {
        eventBus.emit(EVENTS.ORDEN_CREADA, {
          idOrden:       o.id,
          numeroOrden:   o.numero_orden,
          idRestaurante: o.id_restaurante,
          idGrupo:       data.id_grupo,
          idCliente:     data.id_cliente,
          tipoOrden:     data.tipo_orden,
          total:         Number(o.total),
          idOrdenGrupo:  ordenGrupo.id,
        });
      });

      return grupoFinal;
    });
  },

  // ===========================================================================
  // generarRecibo — recibo consolidado de una OrdenGrupo
  // ===========================================================================
  /**
   * Retorna la estructura completa para imprimir un recibo consolidado:
   *   - Total global de la compra
   *   - Detalle por restaurante con sus ítems
   *   - Métodos de pago utilizados
   */
  async generarRecibo(id_orden_grupo: number) {
    const og = await prisma.ordenGrupo.findUnique({
      where: { id: id_orden_grupo },
      include: {
        grupo:   { select: { nombre: true, logo_url: true } },
        usuario: { select: { nombre_completo: true } },
        ordenes: {
          include: {
            restaurante: { select: { nombre: true, logo_url: true, direccion: true, telefono: true } },
            estado:      { select: { nombre: true, codigo: true } },
            detalles: {
              include: {
                producto: { select: { nombre: true, sku: true } },
                variante: { select: { nombre: true } },
              },
            },
          },
        },
        pagos: {
          include: { metodo_pago: { select: { nombre: true, codigo: true } } },
        },
      },
    });

    if (!og) throw new NotFoundError('OrdenGrupo');

    return {
      numero_grupo:    og.numero_grupo,
      fecha:           og.fecha_creacion,
      estado:          og.estado,
      negocio:         og.grupo.nombre,
      cajero:          og.usuario.nombre_completo,

      // Totales globales
      subtotal_global: og.subtotal,
      descuento_global: og.descuento,
      impuestos_global: og.impuestos,
      total_global:    og.total,

      // Detalle por restaurante
      restaurantes: og.ordenes.map(o => ({
        restaurante:   o.restaurante!.nombre,
        direccion:     o.restaurante!.direccion,
        numero_orden:  o.numero_orden,
        estado:        o.estado.nombre,
        subtotal:      o.subtotal,
        impuestos:     o.impuestos,
        total:         o.total,
        items: o.detalles.map(d => ({
          producto:        d.producto.nombre,
          variante:        d.variante?.nombre ?? null,
          cantidad:        d.cantidad,
          precio_unitario: d.precio_unitario,
          subtotal:        d.subtotal,
          total:           d.total,
          notas:           d.notas,
        })),
      })),

      // Pagos
      pagos: og.pagos.map(p => ({
        metodo:     p.metodo_pago.nombre,
        monto:      p.monto,
        referencia: p.referencia,
        fecha:      p.fecha_pago,
      })),
    };
  },
};
