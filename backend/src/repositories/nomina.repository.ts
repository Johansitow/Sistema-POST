/**
 * NominaRepository — persistencia del ciclo de nómina.
 */

import { EstadoGeneral, EstadoLaboral, Prisma } from '@prisma/client';
import prisma from '../config/database';

type PrismaTx = Prisma.TransactionClient | typeof prisma;

const includePeriodo = {
  liquidado_por: { select: { id: true, nombre_completo: true } },
  aprobado_por:  { select: { id: true, nombre_completo: true } },
  restaurante:   { select: { id: true, nombre: true } },
  _count:        { select: { detalles: true, novedades: true } },
};

export const nominaRepository = {

  // ── Parámetros legales ─────────────────────────────────────────────────────

  findParametros: (anio: number) =>
    prisma.parametroNomina.findUnique({ where: { anio } }),

  listarParametros: () =>
    prisma.parametroNomina.findMany({ orderBy: { anio: 'desc' } }),

  upsertParametros: (anio: number, data: Prisma.ParametroNominaUncheckedCreateInput) =>
    prisma.parametroNomina.upsert({
      where:  { anio },
      update: data,
      create: data,
    }),

  verificarParametros: (anio: number, id_usuario: number) =>
    prisma.parametroNomina.update({
      where: { anio },
      data:  { verificado: true, verificado_por: id_usuario, fecha_verificacion: new Date() },
    }),

  // ── Periodos ───────────────────────────────────────────────────────────────

  crearPeriodo: (data: Prisma.PeriodoNominaUncheckedCreateInput) =>
    prisma.periodoNomina.create({ data, include: includePeriodo }),

  findPeriodo: (id: number, id_grupo?: number) =>
    prisma.periodoNomina.findFirst({
      where:   { id, ...(id_grupo ? { id_grupo } : {}) },
      include: includePeriodo,
    }),

  listarPeriodos: (id_grupo?: number, anio?: number) =>
    prisma.periodoNomina.findMany({
      where: { ...(id_grupo ? { id_grupo } : {}), ...(anio ? { anio } : {}) },
      include: includePeriodo,
      orderBy: [{ fecha_inicio: 'desc' }],
    }),

  actualizarPeriodo: (id: number, data: Prisma.PeriodoNominaUncheckedUpdateInput, tx: PrismaTx = prisma) =>
    tx.periodoNomina.update({ where: { id }, data, include: includePeriodo }),

  /** ¿Ya existe un periodo que se solape con estas fechas en la misma sede? */
  findPeriodoSolapado: (
    id_grupo: number, id_restaurante: number | null, inicio: Date, fin: Date, excluirId?: number,
  ) => prisma.periodoNomina.findFirst({
    where: {
      id_grupo,
      id_restaurante,
      estado: { not: 'anulada' },
      fecha_inicio: { lte: fin },
      fecha_fin:    { gte: inicio },
      ...(excluirId ? { id: { not: excluirId } } : {}),
    },
    select: { id: true, nombre: true },
  }),

  // ── Empleados liquidables ──────────────────────────────────────────────────

  /**
   * Empleados que entran a la liquidación de un periodo.
   *
   * Multi-tenant: se acotan a la sede del periodo o, si el periodo es del
   * grupo completo, a las sedes de ese grupo. Se excluyen los retirados antes
   * del inicio del periodo — un ex-empleado no se vuelve a liquidar.
   */
  empleadosLiquidables: (id_grupo: number, id_restaurante: number | null, fechaInicio: Date) =>
    prisma.usuario.findMany({
      where: {
        estado: { not: EstadoGeneral.eliminado },
        NOT: { estado_laboral: EstadoLaboral.retirado, fecha_retiro: { lt: fechaInicio } },
        ...(id_restaurante
          ? { id_restaurante_base: id_restaurante }
          : { restaurante_base: { id_grupo } }),
      },
      select: {
        id: true, nombre_completo: true, codigo_empleado: true, cargo: true,
        documento_identidad: true, estado_laboral: true, fecha_retiro: true,
        fecha_ingreso: true, nivel_riesgo_arl: true,
        eps: true, afp: true, arl: true,
        id_restaurante_base: true,
        nomina: true,
      },
      orderBy: { nombre_completo: 'asc' },
    }),

  // ── Novedades ──────────────────────────────────────────────────────────────

  listarNovedades: (id_periodo: number) =>
    prisma.novedadNomina.findMany({
      where:   { id_periodo },
      include: { empleado: { select: { id: true, nombre_completo: true, codigo_empleado: true } } },
      orderBy: [{ id_empleado: 'asc' }, { tipo: 'asc' }],
    }),

  crearNovedad: (data: Prisma.NovedadNominaUncheckedCreateInput) =>
    prisma.novedadNomina.create({ data }),

  eliminarNovedad: (id: number) =>
    prisma.novedadNomina.delete({ where: { id } }),

  findNovedad: (id: number) =>
    prisma.novedadNomina.findUnique({ where: { id }, include: { periodo: true } }),

  // ── Detalles ───────────────────────────────────────────────────────────────

  borrarDetalles: (id_periodo: number, tx: PrismaTx = prisma) =>
    tx.nominaDetalle.deleteMany({ where: { id_periodo } }),

  crearDetalle: (
    data: Prisma.NominaDetalleUncheckedCreateInput,
    conceptos: Omit<Prisma.NominaDetalleConceptoUncheckedCreateInput, 'id_detalle'>[],
    tx: PrismaTx = prisma,
  ) => tx.nominaDetalle.create({
    data: { ...data, conceptos: { create: conceptos } },
  }),

  listarDetalles: (id_periodo: number) =>
    prisma.nominaDetalle.findMany({
      where: { id_periodo },
      include: {
        empleado:  { select: { id: true, nombre_completo: true, codigo_empleado: true,
                               cargo: true, documento_identidad: true } },
        conceptos: { orderBy: { orden: 'asc' } },
      },
      orderBy: { empleado: { nombre_completo: 'asc' } },
    }),

  findDetalle: (id_periodo: number, id_empleado: number) =>
    prisma.nominaDetalle.findUnique({
      where: { id_periodo_id_empleado: { id_periodo, id_empleado } },
      include: {
        empleado:  { select: { id: true, nombre_completo: true, codigo_empleado: true,
                               cargo: true, documento_identidad: true } },
        periodo:   true,
        conceptos: { orderBy: { orden: 'asc' } },
      },
    }),

  // ── Costo laboral sobre ventas ─────────────────────────────────────────────

  /**
   * Ventas del periodo para la métrica de costo laboral.
   * Usa el mismo criterio de "venta completada" que dashboard y reportes.
   */
  ventasDelPeriodo: (
    id_grupo: number, id_restaurante: number | null,
    inicio: Date, fin: Date, idEstadoFinal: number,
  ) => prisma.orden.aggregate({
    where: {
      id_estado: idEstadoFinal,
      fecha_apertura: { gte: inicio, lte: fin },
      ...(id_restaurante ? { id_restaurante } : { restaurante: { id_grupo } }),
    },
    _sum: { total: true },
  }),
};
