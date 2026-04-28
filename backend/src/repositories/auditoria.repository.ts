/**
 * AuditoriaRepository - Solo queries Prisma para auditoría
 */

import prisma from '../config/database';
import { PaginationParams, getSkip } from '../lib/pagination';

export const auditoriaRepository = {

  findAll: (
    pagination: PaginationParams,
    filters: {
      id_usuario?:     number;
      modulo?:         string;
      accion?:         string;
      fecha_desde?:    Date;
      fecha_hasta?:    Date;
      id_restaurante?: number;
      id_grupo?:       number;
    }
  ) => {
    const where: any = {};
    if (filters.id_usuario)    where.id_usuario    = filters.id_usuario;
    if (filters.modulo)        where.modulo        = { contains: filters.modulo, mode: 'insensitive' };
    if (filters.accion)        where.accion        = { contains: filters.accion, mode: 'insensitive' };
    if (filters.id_restaurante) where.id_restaurante = filters.id_restaurante;
    if (filters.id_grupo)      where.id_grupo      = filters.id_grupo;
    if (filters.fecha_desde || filters.fecha_hasta) {
      where.fecha_hora = {};
      if (filters.fecha_desde) where.fecha_hora.gte = filters.fecha_desde;
      if (filters.fecha_hasta) where.fecha_hora.lte = filters.fecha_hasta;
    }

    return Promise.all([
      prisma.auditoria.findMany({
        where,
        include: {
          usuario: { select: { id: true, nombre_completo: true, usuario: true } },
        },
        orderBy: { fecha_hora: 'desc' },
        skip: getSkip(pagination),
        take: pagination.limit,
      }),
      prisma.auditoria.count({ where }),
    ]);
  },

  create: (data: {
    id_usuario?:            number;
    accion:                 string;
    modulo:                 string;
    tabla_afectada?:        string;
    id_registro_afectado?:  number;
    datos_anteriores?:      any;
    datos_nuevos?:          any;
    ip_address?:            string;
    user_agent?:            string;
    // Contexto tenant — siempre poblar cuando esté disponible
    id_restaurante?:        number;
    id_grupo?:              number;
  }) => prisma.auditoria.create({ data }),
};

/**
 * registrarAuditoria — helper que llaman los services para registrar acciones.
 *
 * Es fire-and-forget: no lanza errores al caller si falla.
 * La auditoría nunca debe interrumpir el flujo de negocio.
 *
 * Uso en un controller/service:
 *   await registrarAuditoria({
 *     id_usuario:          req.user.id,
 *     accion:              'CREAR_PRODUCTO',
 *     modulo:              'inventario',
 *     tabla_afectada:      'productos',
 *     id_registro_afectado: producto.id,
 *     datos_nuevos:        producto,
 *     ...req.auditContext,   // ← inyecta ip, userAgent, id_restaurante, id_grupo
 *   });
 */
export const registrarAuditoria = async (data: {
  id_usuario?:           number;
  accion:                string;
  modulo:                string;
  tabla_afectada?:       string;
  id_registro_afectado?: number;
  datos_anteriores?:     any;
  datos_nuevos?:         any;
  ip_address?:           string;
  user_agent?:           string;
  id_restaurante?:       number;
  id_grupo?:             number;
}): Promise<void> => {
  try {
    await auditoriaRepository.create(data);
  } catch (error) {
    // Log silencioso: la auditoría nunca bloquea el flujo principal
    console.error('[Auditoría] Error al registrar:', error);
  }
};
