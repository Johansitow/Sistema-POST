/**
 * EstadoRepository - Queries Prisma para estados de orden y transiciones
 *
 * Separado del orden.repository porque estados y transiciones
 * son configuración del sistema, no datos de negocio.
 * El admin los gestiona desde el frontend; las órdenes solo los consultan.
 */

import prisma from '../config/database';

export const estadoRepository = {

  // ─── Estados ────────────────────────────────────────────────────────────────

  /**
   * findAll — lista todos los estados con sus transiciones de salida
   * Incluye transiciones para que el frontend pueda construir el flujo visual.
   */
  findAll: () =>
    prisma.estadoOrden.findMany({
      where: { activo: true },
      include: {
        transiciones_desde: {
          include: { estado_hacia: true },
          orderBy: { orden: 'asc' },
        },
      },
      orderBy: { orden: 'asc' },
    }),

  findById: (id: number) =>
    prisma.estadoOrden.findUnique({
      where: { id },
      include: {
        transiciones_desde: { include: { estado_hacia: true } },
        transiciones_hacia: { include: { estado_desde: true } },
      },
    }),

  findByCodigo: (codigo: string) =>
    prisma.estadoOrden.findFirst({ where: { codigo } }),

  /**
   * update — solo permite cambiar campos visuales (nombre, color, icono)
   * Los campos de sistema (es_inicial, es_final, codigo) no se tocan desde aquí.
   */
  update: (id: number, data: Partial<{
    nombre:         string;
    descripcion:    string;
    color:          string;
    icono:          string;
    orden:          number;
    activo:         boolean;
    imprime_comanda: boolean;
    permite_edicion: boolean;
  }>) => prisma.estadoOrden.update({ where: { id }, data }),

  // ─── Transiciones ────────────────────────────────────────────────────────────

  /**
   * findTransicion — verifica si una transición específica existe
   * Usado por orden.service para validar antes de cambiar estado.
   * Retorna null si la transición no está permitida.
   */
  findTransicion: (id_estado_desde: number, id_estado_hacia: number) =>
    prisma.estadoTransicion.findFirst({
      where: { id_estado_desde, id_estado_hacia },
    }),

  findTransicionesByEstado: (id_estado_desde: number) =>
    prisma.estadoTransicion.findMany({
      where: { id_estado_desde },
      include: { estado_hacia: true },
      orderBy: { orden: 'asc' },
    }),

  createTransicion: (data: {
    id_estado_desde:      number;
    id_estado_hacia:      number;
    requiere_permiso?:    string;
    puede_ser_automatico?: boolean;
    orden?:               number;
  }) => prisma.estadoTransicion.create({ data }),

  deleteTransicion: (id: number) =>
    prisma.estadoTransicion.delete({ where: { id } }),

  findTransicionById: (id: number) =>
    prisma.estadoTransicion.findUnique({
      where: { id },
      include: { estado_desde: true, estado_hacia: true },
    }),
};
