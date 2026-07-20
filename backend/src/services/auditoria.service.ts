/**
 * AuditoriaService - Solo lectura del historial de auditoría
 * La escritura se hace directamente con registrarAuditoria() desde cada service.
 */

import { auditoriaRepository } from '../repositories/auditoria.repository';
import { getPaginationParams, buildPaginatedResult } from '../lib/pagination';

export const auditoriaService = {
  /**
   * @param grupoId — scope multi-tenant: presente cuando consulta un admin de
   *                  grupo (solo ve la auditoría de su grupo); undefined para SA.
   */
  async listar(params: {
    page?: unknown; limit?: unknown;
    id_usuario?:  number;
    modulo?:      string;
    accion?:      string;
    fecha_desde?: Date;
    fecha_hasta?: Date;
  }, grupoId?: number) {
    const pagination = getPaginationParams(params.page, params.limit);
    const [registros, total] = await auditoriaRepository.findAll(pagination, {
      id_usuario:  params.id_usuario,
      modulo:      params.modulo,
      accion:      params.accion,
      fecha_desde: params.fecha_desde,
      fecha_hasta: params.fecha_hasta,
      id_grupo:    grupoId,
    });
    return buildPaginatedResult(registros, total, pagination);
  },
};
