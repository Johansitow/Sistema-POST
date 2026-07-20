/**
 * FeatureFlagsController - Gestión de feature flags
 */

import { Request, Response } from 'express';
import { featureFlagService } from '../services/feature-flag.service';
import { asyncHandler } from '../middlewares/error.middleware';
import { registrarAuditoria } from '../repositories/auditoria.repository';
import { buildContexto } from '../lib/flagContexto';
import { z } from 'zod';

const createFlagSchema = z.object({
  nombre:      z.string().min(1).max(100).regex(/^[a-z_]+$/, 'Solo letras minúsculas y guiones bajos'),
  descripcion: z.string().optional(),
  habilitado:  z.boolean().default(false),
  scope:       z.enum(['global', 'contexto']).default('global'),
  metadata:    z.record(z.unknown()).optional(),
});

const updateFlagSchema = createFlagSchema.partial();

const asignacionSchema = z.object({
  contexto:   z.string().min(1),
  habilitado: z.boolean(),
});

/**
 * Scope multi-tenant: undefined para superadmin; el grupo administrado
 * (req.grupoAdminId de requireAdminAccess) para admins de grupo.
 */
const grupoScope = (req: Request): number | undefined =>
  req.esSuperAdmin ? undefined : req.grupoAdminId;

/** GET /feature-flags — Lista todos los flags (admin; asignaciones scoped por grupo) */
export const getAll = asyncHandler(async (req: Request, res: Response) => {
  const flags = await featureFlagService.listar(grupoScope(req));
  res.json({ success: true, data: flags });
});

/** GET /feature-flags/client — Flags para el frontend (todos los usuarios).
 *  El grupo se deriva del token/sesión via tenantContextOptional; el cliente
 *  nunca elige su propio grupo (previene lectura de flags de otro tenant). */
export const getClientFlags = asyncHandler(async (req: Request, res: Response) => {
  const restauranteCtx = req.restauranteId ? buildContexto('restaurante', req.restauranteId) : undefined;
  const grupoCtx       = req.grupoId       ? buildContexto('grupo',       req.grupoId)       : undefined;
  const flags = await featureFlagService.getClientFlags(restauranteCtx, grupoCtx);
  res.json({ success: true, data: flags });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const flag = await featureFlagService.obtenerPorId(Number(req.params.id), grupoScope(req));
  res.json({ success: true, data: flag });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = createFlagSchema.parse(req.body);
  const flag = await featureFlagService.crear(data);

  registrarAuditoria({
    id_usuario:           (req as any).user?.id,
    accion:               'CREAR_FEATURE_FLAG',
    modulo:               'feature_flags',
    tabla_afectada:       'feature_flags',
    id_registro_afectado: flag.id,
    datos_nuevos:         { nombre: flag.nombre, habilitado: flag.habilitado, scope: flag.scope },
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  });

  res.status(201).json({ success: true, data: flag, message: 'Feature flag creado correctamente' });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const data = updateFlagSchema.parse(req.body);
  const flag = await featureFlagService.actualizar(id, data);

  registrarAuditoria({
    id_usuario:           (req as any).user?.id,
    accion:               'ACTUALIZAR_FEATURE_FLAG',
    modulo:               'feature_flags',
    tabla_afectada:       'feature_flags',
    id_registro_afectado: id,
    datos_nuevos:         data,
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  });

  res.json({ success: true, data: flag, message: 'Feature flag actualizado correctamente' });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await featureFlagService.eliminar(id);

  registrarAuditoria({
    id_usuario:           (req as any).user?.id,
    accion:               'ELIMINAR_FEATURE_FLAG',
    modulo:               'feature_flags',
    tabla_afectada:       'feature_flags',
    id_registro_afectado: id,
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  });

  res.status(204).send();
});

export const setAsignacion = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { contexto, habilitado } = asignacionSchema.parse(req.body);
  const asignacion = await featureFlagService.setAsignacion(id, contexto, habilitado, grupoScope(req));

  registrarAuditoria({
    id_usuario:           (req as any).user?.id,
    accion:               'ASIGNAR_FEATURE_FLAG',
    modulo:               'feature_flags',
    tabla_afectada:       'feature_flag_asignaciones',
    id_registro_afectado: id,
    datos_nuevos:         { contexto, habilitado },
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  });

  res.json({ success: true, data: asignacion, message: 'Asignación actualizada' });
});

export const deleteAsignacion = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const contexto = String(req.params.contexto);
  await featureFlagService.eliminarAsignacion(id, contexto, grupoScope(req));

  registrarAuditoria({
    id_usuario:           (req as any).user?.id,
    accion:               'ELIMINAR_ASIGNACION_FLAG',
    modulo:               'feature_flags',
    tabla_afectada:       'feature_flag_asignaciones',
    id_registro_afectado: id,
    datos_nuevos:         { contexto },
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  });

  res.status(204).send();
});
