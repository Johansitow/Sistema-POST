/**
 * GrupoNegocioService — Lógica de negocio para grupos (tenants SaaS)
 */

import { PlanSaaS } from '@prisma/client';
import prisma from '../config/database';
import { grupoNegocioRepository } from '../repositories/grupo-negocio.repository';
import { NotFoundError, BadRequestError, ForbiddenError } from '../exceptions/HttpErrors';
import { getPaginationParams, buildPaginatedResult } from '../lib/pagination';
import { buildContexto } from '../lib/flagContexto';
import { barrerTenant } from '../lib/tenant/borrarTenant';
import { cacheDel } from '../config/redis';

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

  /**
   * eliminarGrupo — BORRA POR COMPLETO un negocio (tenant): todos sus datos, sus
   * sedes, el grupo y sus usuarios propios. Irreversible. Pensado para limpiar
   * cuentas de prueba desde el panel del superadmin.
   *
   * Guardas: rechaza el grupo que contenga al superadministrador (protege el
   * negocio principal). Reutiliza `barrerTenant` (el mismo barrido del sandbox).
   * Tras borrar el grupo (que cascadea las membresías), elimina los usuarios que
   * quedaron sin ningún grupo — es decir, los que solo pertenecían a este negocio.
   */
  async eliminarGrupo(idGrupo: number) {
    const grupo = await prisma.grupoNegocio.findUnique({
      where:  { id: idGrupo },
      select: {
        id: true,
        restaurantes: { select: { id: true } },
        usuarios:     { select: { id_usuario: true, usuario: { select: { es_super_admin: true } } } },
      },
    });
    if (!grupo) throw new NotFoundError('Grupo de negocio');
    if (grupo.usuarios.some(m => m.usuario.es_super_admin)) {
      throw new ForbiddenError('No se puede eliminar el negocio del superadministrador');
    }

    const sedeIds    = grupo.restaurantes.map(r => r.id);
    const contextos  = [buildContexto('grupo', idGrupo), ...sedeIds.map(id => buildContexto('restaurante', id))];
    const miembroIds = grupo.usuarios.map(m => m.id_usuario);

    await prisma.$transaction(async (tx) => {
      await barrerTenant(tx, idGrupo, sedeIds, contextos);

      // Borrar los usuarios que quedaron sin ninguna membresía (su único grupo era
      // este). Los que pertenezcan a otro grupo se conservan. Cascada segura:
      // UsuarioPermiso, tokens_auth, NominaEmpleado, HistorialSalario; Auditoria.id_usuario = SetNull.
      for (const uid of miembroIds) {
        const restantes = await tx.usuarioGrupo.count({ where: { id_usuario: uid } });
        if (restantes === 0) await tx.usuario.delete({ where: { id: uid } });
      }
    });

    await cacheDel('ff:all');
    await cacheDel('restaurantes:all');
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
