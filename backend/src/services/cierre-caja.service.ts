/**
 * CierreCajaService
 */

import prisma from '../config/database';
import { EstadoCierre } from '@prisma/client';
import { turnoCajaRepository, cierreCajaRepository } from '../repositories/turno-cierre.repository';
import { configuracionService } from './configuracion.service';
import { NotFoundError, BadRequestError, ConflictError } from '../exceptions/HttpErrors';
import { getPaginationParams, getSkip, buildPaginatedResult } from '../lib/pagination';
import { assertRestauranteId } from '../lib/tenantQuery';
import { eventBus } from '../events/eventBus';
import { EVENTS, CierreCompletadoPayload } from '../events/events';

function generarNumeroCierre(ultimo: string | null): string {
  if (!ultimo) return 'CIE-000001';
  const num = parseInt(ultimo.replace('CIE-', '')) + 1;
  return `CIE-${String(num).padStart(6, '0')}`;
}

export const cierreCajaService = {

  // ── TURNOS ──────────────────────────────────────────────────────────────────

  async listarTurnos(id_restaurante: number, soloActivos = false) {
    return turnoCajaRepository.findAll(id_restaurante, soloActivos);
  },

  async obtenerTurno(id: number) {
    const t = await turnoCajaRepository.findById(id);
    if (!t) throw new NotFoundError('Turno de caja');
    return t;
  },

  async crearTurno(data: {
    id_restaurante: number;
    nombre:         string;
    hora_apertura:  string;
    hora_cierre:    string;
    dias_semana?:   number[];
  }) {
    const horaRe = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!horaRe.test(data.hora_apertura)) throw new BadRequestError('hora_apertura inválida (HH:MM)');
    if (!horaRe.test(data.hora_cierre))   throw new BadRequestError('hora_cierre inválida (HH:MM)');
    if (data.hora_apertura >= data.hora_cierre)
      throw new BadRequestError('hora_cierre debe ser posterior a hora_apertura');

    return turnoCajaRepository.create(data);
  },

  async actualizarTurno(id: number, data: any) {
    await this.obtenerTurno(id);
    return turnoCajaRepository.update(id, data);
  },

  async eliminarTurno(id: number) {
    // Se obtiene el turno para verificar que existe (lanza NotFoundError si no)
    await this.obtenerTurno(id);
    const tieneCierres = await prisma.cierreCaja.count({ where: { id_turno: id } });
    if (tieneCierres > 0)
      throw new ConflictError('No se puede eliminar un turno con cierres registrados. Desactívalo en su lugar.');
    return turnoCajaRepository.delete(id);
  },

  // ── CIERRES ─────────────────────────────────────────────────────────────────

  async listar(params: {
    page?: unknown; limit?: unknown;
    fecha_desde?: Date; fecha_hasta?: Date;
    id_usuario?: number; estado?: EstadoCierre;
    id_restaurante?: number;
  }) {
    const p = getPaginationParams(params.page, params.limit);
    const [data, total] = await cierreCajaRepository.findAll({
      skip:           getSkip(p),
      take:           p.limit,
      fecha_desde:    params.fecha_desde,
      fecha_hasta:    params.fecha_hasta,
      id_usuario:     params.id_usuario,
      estado:         params.estado,
      id_restaurante: params.id_restaurante,
    });
    return buildPaginatedResult(data, total, p);
  },

  async obtenerPorId(id: number) {
    const c = await cierreCajaRepository.findById(id);
    if (!c) throw new NotFoundError('Cierre de caja');
    return c;
  },

  async iniciarCierre(data: {
    id_usuario:      number;
    id_turno?:       number;
    fecha_apertura:  Date;
    monto_inicial:   number;
    id_restaurante:  number;
  }) {
    assertRestauranteId(data.id_restaurante);

    const estadosFinales = await prisma.estadoOrden.findMany({
      where: { es_final: true }, select: { id: true },
    });
    const idsFinales = estadosFinales.map(e => e.id);

    // Filtrar únicamente las órdenes abiertas de ESTE restaurante.
    // Sin este filtro, un cierre de caja en Restaurante A fallaría si
    // Restaurante B tiene órdenes abiertas — contaminación de tenant.
    const ordenesAbiertas = await prisma.orden.findMany({
      where: {
        id_restaurante: data.id_restaurante,
        fecha_apertura: { gte: data.fecha_apertura },
        id_estado:      { notIn: idsFinales },
      },
      select: { id: true, numero_orden: true, total: true,
                estado: { select: { nombre: true } } },
    });

    if (ordenesAbiertas.length > 0) {
      throw new BadRequestError(
        `Hay ${ordenesAbiertas.length} orden(es) abiertas que impiden el cierre`,
        // @ts-ignore
        { ordenes_abiertas: ordenesAbiertas }
      );
    }

    const { totalVentas, totalEfectivo, totalesPorMetodo } =
      await this._calcularTotalesPeriodo(data.fecha_apertura, new Date(), data.id_restaurante);

    const ultimo = await cierreCajaRepository.findUltimo();
    const numeroCierre = generarNumeroCierre(ultimo?.numero_cierre ?? null);

    return cierreCajaRepository.create({
      id_usuario:         data.id_usuario,
      id_turno:           data.id_turno,
      id_restaurante:     data.id_restaurante,
      numero_cierre:      numeroCierre,
      fecha_apertura:     data.fecha_apertura,
      monto_inicial:      data.monto_inicial,
      monto_final:        0,
      totales_por_metodo: totalesPorMetodo,
      total_ventas:       totalVentas,
      total_efectivo:     totalEfectivo,
      diferencia:         0,
      estado:             EstadoCierre.en_proceso,
    });
  },

  async confirmarCierre(id: number, data: {
    monto_final:    number;
    justificacion?: string;
    observaciones?: string;
  }) {
    const cierre = await this.obtenerPorId(id);

    if (cierre.estado !== EstadoCierre.en_proceso)
      throw new BadRequestError('Este cierre no está en estado en_proceso');

    const diferencia = data.monto_final - Number(cierre.total_ventas);

    let umbralDiferencia = 5000;
    try {
      umbralDiferencia = await configuracionService.getValor<number>('umbral_diferencia_caja');
    } catch { /* usa el default */ }

    if (Math.abs(diferencia) > umbralDiferencia && !data.justificacion)
      throw new BadRequestError(
        `La diferencia de ${Math.abs(diferencia).toLocaleString()} supera el umbral permitido. Se requiere justificación.`
      );

    const estadoFinal = Math.abs(diferencia) > umbralDiferencia
      ? EstadoCierre.con_diferencia
      : EstadoCierre.completado;

    const actualizado = await cierreCajaRepository.update(id, {
      monto_final:   data.monto_final,
      diferencia,
      justificacion: data.justificacion,
      observaciones: data.observaciones,
      estado:        estadoFinal,
    });

    const payload: CierreCompletadoPayload = {
      idCierre:      actualizado.id,
      idRestaurante: actualizado.id_restaurante,
      numeroCierre:  actualizado.numero_cierre,
      estado:        estadoFinal,
      totalVentas:   Number(actualizado.total_ventas),
      diferencia,
    };
    await eventBus.emit(EVENTS.CIERRE_COMPLETADO, payload);

    return actualizado;
  },

  // ── PRIVADOS ─────────────────────────────────────────────────────────────────

  async _calcularTotalesPeriodo(desde: Date, hasta: Date, id_restaurante: number) {
    // Filtrar pagos únicamente de este restaurante a través de la relación con Orden.
    // Pago no tiene id_restaurante directo — el aislamiento se logra via orden.id_restaurante.
    const pagos = await prisma.pago.findMany({
      where: {
        fecha_pago: { gte: desde, lte: hasta },
        orden:      { id_restaurante },
      },
      include: { metodo_pago: { select: { codigo: true, nombre: true } } },
    });

    const totalVentas   = pagos.reduce((s, p) => s + Number(p.monto), 0);
    const totalEfectivo = pagos
      .filter(p => p.metodo_pago.codigo === 'EFECTIVO')
      .reduce((s, p) => s + Number(p.monto), 0);

    const totalesPorMetodo: Record<string, number> = {};
    for (const pago of pagos) {
      const codigo = pago.metodo_pago.codigo;
      totalesPorMetodo[codigo] = (totalesPorMetodo[codigo] ?? 0) + Number(pago.monto);
    }

    return { totalVentas, totalEfectivo, totalesPorMetodo };
  },
};