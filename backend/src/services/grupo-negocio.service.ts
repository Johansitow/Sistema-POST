/**
 * GrupoNegocioService — Lógica de negocio para grupos (tenants SaaS)
 */

import { PlanSaaS } from '@prisma/client';
import { grupoNegocioRepository } from '../repositories/grupo-negocio.repository';
import { NotFoundError, BadRequestError } from '../exceptions/HttpErrors';
import { getPaginationParams, buildPaginatedResult } from '../lib/pagination';

export const grupoNegocioService = {

  async listar(params: {
    page?:   unknown;
    limit?:  unknown;
    activo?: boolean;
    plan?:   PlanSaaS;
  }) {
    const pagination = getPaginationParams(params.page, params.limit);
    const [grupos, total] = await grupoNegocioRepository.findAll(pagination, {
      activo: params.activo,
      plan:   params.plan,
    });
    return buildPaginatedResult(grupos, total, pagination);
  },

  async obtenerPorId(id: number) {
    const grupo = await grupoNegocioRepository.findById(id);
    if (!grupo) throw new NotFoundError('Grupo de negocio');
    return grupo;
  },

  async crear(data: {
    nombre:                 string;
    nit?:                   string;
    logo_url?:              string;
    plan?:                  PlanSaaS;
    plan_max_restaurantes?: number;
  }) {
    return grupoNegocioRepository.create(data);
  },

  async actualizar(id: number, data: Partial<{
    nombre:                string;
    nit:                   string;
    logo_url:              string;
    plan:                  PlanSaaS;
    plan_max_restaurantes: number;
    activo:                boolean;
  }>) {
    await this.obtenerPorId(id);
    return grupoNegocioRepository.update(id, data);
  },

  async listarMiembros(id_grupo: number) {
    await this.obtenerPorId(id_grupo);
    return grupoNegocioRepository.findMiembros(id_grupo);
  },

  async asignarMiembro(id_grupo: number, id_usuario: number, rol_en_grupo: string) {
    const ROLES_VALIDOS = ['owner', 'admin', 'operador'];
    if (!ROLES_VALIDOS.includes(rol_en_grupo)) {
      throw new BadRequestError(`rol_en_grupo debe ser uno de: ${ROLES_VALIDOS.join(', ')}`);
    }
    await this.obtenerPorId(id_grupo);
    return grupoNegocioRepository.upsertMiembro(id_usuario, id_grupo, rol_en_grupo);
  },

  async removerMiembro(id_grupo: number, id_usuario: number) {
    await this.obtenerPorId(id_grupo);
    return grupoNegocioRepository.removeMiembro(id_usuario, id_grupo);
  },

  /** Validar que el grupo no supera su límite de restaurantes activos */
  async validarLimiteRestaurantes(id_grupo: number) {
    const grupo = await this.obtenerPorId(id_grupo);
    const count = await grupoNegocioRepository.countRestaurantesActivos(id_grupo);
    if (count >= grupo.plan_max_restaurantes) {
      throw new BadRequestError(
        `El grupo ha alcanzado el límite de ${grupo.plan_max_restaurantes} restaurantes activos para el plan ${grupo.plan}`
      );
    }
  },
};
