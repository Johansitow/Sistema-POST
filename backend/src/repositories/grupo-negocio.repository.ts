/**
 * GrupoNegocioRepository — CRUD para el modelo raíz de tenant SaaS
 */

import prisma from '../config/database';
import { PlanSaaS } from '@prisma/client';
import { PaginationParams, getSkip } from '../lib/pagination';

const includeRestaurantes = {
  restaurantes: {
    where:   { activo: true },
    orderBy: { nombre: 'asc' as const },
    select:  { id: true, nombre: true, es_default: true, tipo_tenant: true, ciudad: true },
  },
  _count: { select: { restaurantes: true, usuarios: true } },
};

export const grupoNegocioRepository = {

  findAll: (
    pagination: PaginationParams,
    filters: { activo?: boolean; plan?: PlanSaaS }
  ) => {
    const where = {
      ...(filters.activo !== undefined ? { activo: filters.activo } : {}),
      ...(filters.plan               ? { plan:   filters.plan   } : {}),
    };
    return Promise.all([
      prisma.grupoNegocio.findMany({
        where,
        include: includeRestaurantes,
        orderBy: { nombre: 'asc' },
        skip:    getSkip(pagination),
        take:    pagination.limit,
      }),
      prisma.grupoNegocio.count({ where }),
    ]);
  },

  findById: (id: number) =>
    prisma.grupoNegocio.findUnique({
      where:   { id },
      include: includeRestaurantes,
    }),

  findByUuid: (uuid: string) =>
    prisma.grupoNegocio.findUnique({
      where:   { uuid },
      include: includeRestaurantes,
    }),

  create: (data: {
    nombre:                 string;
    nit?:                   string;
    logo_url?:              string;
    plan?:                  PlanSaaS;
    plan_max_restaurantes?: number;
    db_schema?:             string;
    db_connection_url?:     string;
  }) =>
    prisma.grupoNegocio.create({
      data:    { ...data },
      include: includeRestaurantes,
    }),

  update: (id: number, data: Partial<{
    nombre:                 string;
    nit:                    string;
    logo_url:               string;
    plan:                   PlanSaaS;
    plan_max_restaurantes:  number;
    activo:                 boolean;
    db_schema:              string;
    db_connection_url:      string;
  }>) =>
    prisma.grupoNegocio.update({
      where:   { id },
      data,
      include: includeRestaurantes,
    }),

  /** Membresía puntual de un usuario en un grupo (activa) */
  findMiembro: (id_usuario: number, id_grupo: number) =>
    prisma.usuarioGrupo.findFirst({
      where: { id_usuario, id_grupo, es_activo: true },
    }),

  /** Grupos donde el usuario es owner o admin (para el panel Mi Grupo) */
  findMembresiasAdmin: (id_usuario: number) =>
    prisma.usuarioGrupo.findMany({
      where: {
        id_usuario,
        es_activo:    true,
        rol_en_grupo: { in: ['owner', 'admin'] },
      },
      select:  { id_grupo: true, rol_en_grupo: true },
      orderBy: { fecha_asignacion: 'asc' },
    }),

  /** Lista los miembros del grupo con su rol */
  findMiembros: (id_grupo: number) =>
    prisma.usuarioGrupo.findMany({
      where:   { id_grupo, es_activo: true },
      include: {
        usuario: {
          select: { id: true, uuid: true, nombre_completo: true, email: true, usuario: true },
        },
      },
      orderBy: { fecha_asignacion: 'asc' },
    }),

  /** Asignar o actualizar el rol de un usuario en el grupo */
  upsertMiembro: (id_usuario: number, id_grupo: number, rol_en_grupo: string) =>
    prisma.usuarioGrupo.upsert({
      where:  { id_usuario_id_grupo: { id_usuario, id_grupo } },
      update: { rol_en_grupo: rol_en_grupo as any, es_activo: true },
      create: { id_usuario, id_grupo, rol_en_grupo: rol_en_grupo as any },
    }),

  removeMiembro: (id_usuario: number, id_grupo: number) =>
    prisma.usuarioGrupo.updateMany({
      where: { id_usuario, id_grupo },
      data:  { es_activo: false },
    }),

  /** Validar que el grupo no supera el límite de restaurantes activos */
  countRestaurantesActivos: (id_grupo: number) =>
    prisma.restaurante.count({ where: { id_grupo, activo: true } }),
};
