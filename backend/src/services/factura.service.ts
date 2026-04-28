/**
 * FacturaService - Lógica de negocio para facturas
 *
 * generarDesdeOrden() es llamado internamente por orden.service
 * cuando una orden pasa al estado EN_PREPARACION.
 * Acepta una transacción Prisma (tx) para ejecutarse dentro
 * del mismo atomic block que el cambio de estado.
 */

import { EstadoFactura } from '@prisma/client';
import prisma from '../config/database';
import { facturaRepository } from '../repositories/factura.repository';
import { NotFoundError } from '../exceptions/HttpErrors';
import { getPaginationParams, buildPaginatedResult } from '../lib/pagination';
import { generarNumeroFactura } from '../lib/numero-generator';

export const facturaService = {

  async listar(params: {
    page?: unknown; limit?: unknown;
    estado_factura?: EstadoFactura;
    fecha_desde?: Date;
    fecha_hasta?: Date;
    id_restaurante?: number;
  }) {
    const pagination = getPaginationParams(params.page, params.limit);
    const [facturas, total] = await facturaRepository.findAll(pagination, {
      estado_factura: params.estado_factura,
      fecha_desde:    params.fecha_desde,
      fecha_hasta:    params.fecha_hasta,
      id_restaurante: params.id_restaurante,
    });
    return buildPaginatedResult(facturas, total, pagination);
  },

  async obtenerPorId(id: number) {
    const factura = await facturaRepository.findById(id);
    if (!factura) throw new NotFoundError('Factura');
    return factura;
  },

  async obtenerPorOrden(id_orden: number) {
    const factura = await facturaRepository.findByOrden(id_orden);
    if (!factura) throw new NotFoundError('Factura');
    return factura;
  },

  /**
   * generarDesdeOrden — crea la factura automáticamente
   *
   * Recibe `tx` (transacción de Prisma) para ejecutarse en el mismo
   * bloque atómico que el cambio de estado EN_PREPARACION.
   * Si `tx` no se pasa, crea su propia transacción (para llamadas directas).
   *
   * Número generado secuencialmente: FAC-000001, FAC-000002...
   */
  async generarDesdeOrden(id_orden: number, tx?: any): Promise<any> {
    const client = tx ?? prisma;

    const orden = await client.orden.findUnique({
      where: { id: id_orden },
      include: { detalles: true },
    });
    if (!orden) throw new NotFoundError('Orden');

    // Buscar el último número de factura para generar el siguiente
    const ultima = await facturaRepository.findUltima();
    const numeroFactura = generarNumeroFactura(ultima?.numero_factura ?? null);

    return client.factura.create({
      data: {
        id_orden:       id_orden,
        numero_factura: numeroFactura,
        estado_factura: 'pendiente',
        subtotal:       orden.subtotal,
        impuestos:      orden.impuestos,
        total:          orden.total,
      },
    });
  },
};
