/**
 * RestauranteController - Endpoints CRUD de Restaurante
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { restauranteService } from '../services/restaurante.service';
import { asyncHandler } from '../middlewares/error.middleware';
import { registrarAuditoria } from '../repositories/auditoria.repository';

/**
 * Scope multi-tenant: undefined para superadmin (acceso global),
 * el grupo administrado (req.grupoAdminId de requireAdminAccess) para admins de grupo.
 */
const grupoScope = (req: Request): number | undefined =>
  req.esSuperAdmin ? undefined : req.grupoAdminId;

const createRestauranteSchema = z.object({
  nombre:       z.string().min(1).max(200),
  // Opcional para admins de grupo (el service fuerza su propio grupo);
  // el service exige/usa id_grupo válido cuando crea el superadmin
  id_grupo:     z.number().int().positive().optional(),
  nit:          z.string().max(50).optional(),
  descripcion:  z.string().optional(),
  logo_url:     z.string().url().max(500).optional().or(z.literal('')),
  direccion:    z.string().max(300).optional(),
  ciudad:       z.string().max(100).optional(),
  telefono:     z.string().max(20).optional(),
  email:        z.string().email().max(150).optional().or(z.literal('')),
  activo:       z.boolean().optional(),
  es_default:   z.boolean().optional(),
  config:       z.record(z.unknown()).optional(),
  tipo_tenant:  z.enum(['compartido', 'aislado']).optional(),
  zona_horaria: z.string().max(50).optional(),
  moneda:       z.string().max(10).optional(),
});

const updateRestauranteSchema = createRestauranteSchema.partial();

/**
 * GET /restaurantes
 * - Sin parámetros: solo activos (para el selector del AppBar)
 * - ?todos=true: incluye inactivos (solo superadmin — para la página de gestión)
 */
export const listar = asyncHandler(async (req: Request, res: Response) => {
  const todos = req.query.todos === 'true';
  // ?todos=true: superadmin ve todas; un no-superadmin solo las de su grupo
  // (claim grupos_admin del JWT, o el grupo de su primera sede)
  const grupoDelUsuario = req.esSuperAdmin
    ? undefined
    : req.user?.grupos_admin?.[0]?.id_grupo ?? req.user?.restaurantes?.[0]?.id_grupo;
  const data = todos
    ? await restauranteService.listarTodos(grupoDelUsuario)
    : await restauranteService.listar();
  res.json({ success: true, data });
});

/** GET /restaurantes/default — Restaurante por defecto */
export const obtenerDefault = asyncHandler(async (_req: Request, res: Response) => {
  const data = await restauranteService.obtenerDefault();
  res.json({ success: true, data });
});

/** GET /restaurantes/:id — Obtiene un restaurante por id (autenticado) */
export const obtener = asyncHandler(async (req: Request, res: Response) => {
  const data = await restauranteService.obtenerPorId(Number(req.params.id));
  res.json({ success: true, data });
});

/** POST /restaurantes — Crea un restaurante (superadmin) */
export const crear = asyncHandler(async (req: Request, res: Response) => {
  const dto        = createRestauranteSchema.parse(req.body);
  // Limpiar strings vacíos → undefined para campos opcionales con validación
  const data = {
    ...dto,
    logo_url: dto.logo_url || undefined,
    email:    dto.email    || undefined,
  };
  const restaurante = await restauranteService.crear(data as any, grupoScope(req));

  registrarAuditoria({
    accion:                'CREAR_RESTAURANTE',
    modulo:                'restaurantes',
    tabla_afectada:        'restaurante',
    id_registro_afectado:  restaurante.id,
    datos_nuevos:          restaurante,
    id_usuario:            (req as any).user?.id,
    ip_address:            req.auditContext?.ip,
    user_agent:            req.auditContext?.userAgent,
  }).catch(() => {});

  res.status(201).json({ success: true, data: restaurante, message: 'Restaurante creado correctamente' });
});

/** PUT /restaurantes/:id — Actualiza un restaurante (superadmin) */
export const actualizar = asyncHandler(async (req: Request, res: Response) => {
  const id  = Number(req.params.id);
  const dto = updateRestauranteSchema.parse(req.body);
  const data = {
    ...dto,
    logo_url: dto.logo_url || undefined,
    email:    dto.email    || undefined,
  };
  const restaurante = await restauranteService.actualizar(id, data, grupoScope(req));

  registrarAuditoria({
    accion:                'ACTUALIZAR_RESTAURANTE',
    modulo:                'restaurantes',
    tabla_afectada:        'restaurante',
    id_registro_afectado:  restaurante.id,
    datos_nuevos:          restaurante,
    id_usuario:            (req as any).user?.id,
    ip_address:            req.auditContext?.ip,
    user_agent:            req.auditContext?.userAgent,
  }).catch(() => {});

  res.json({ success: true, data: restaurante, message: 'Restaurante actualizado correctamente' });
});

/** GET /restaurantes/:id/usuarios — Lista los usuarios asignados a un restaurante */
export const listarUsuarios = asyncHandler(async (req: Request, res: Response) => {
  const data = await restauranteService.listarUsuarios(Number(req.params.id), grupoScope(req));
  res.json({ success: true, data });
});

/** POST /restaurantes/:id/usuarios — Asigna un usuario al restaurante */
export const asignarUsuario = asyncHandler(async (req: Request, res: Response) => {
  const { id_usuario } = z.object({ id_usuario: z.number().int().positive() }).parse(req.body);
  const data = await restauranteService.asignarUsuario(Number(req.params.id), id_usuario, grupoScope(req));

  registrarAuditoria({
    accion:               'ASIGNAR_USUARIO_RESTAURANTE',
    modulo:               'restaurantes',
    tabla_afectada:       'usuario_restaurantes',
    id_registro_afectado: Number(req.params.id),
    datos_nuevos:         { id_usuario },
    id_usuario:           (req as any).user?.id,
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  }).catch(() => {});

  res.status(201).json({ success: true, data, message: 'Usuario asignado al restaurante' });
});

/** DELETE /restaurantes/:id/usuarios/:userId — Remueve un usuario del restaurante */
export const removerUsuario = asyncHandler(async (req: Request, res: Response) => {
  await restauranteService.removerUsuario(Number(req.params.id), Number(req.params.userId), grupoScope(req));

  registrarAuditoria({
    accion:               'REMOVER_USUARIO_RESTAURANTE',
    modulo:               'restaurantes',
    tabla_afectada:       'usuario_restaurantes',
    id_registro_afectado: Number(req.params.id),
    datos_nuevos:         { id_usuario: Number(req.params.userId) },
    id_usuario:           (req as any).user?.id,
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  }).catch(() => {});

  res.json({ success: true, message: 'Usuario removido del restaurante' });
});

/** PATCH /restaurantes/:id/toggle — Activa/desactiva un restaurante (superadmin) */
export const toggleActivo = asyncHandler(async (req: Request, res: Response) => {
  const id          = Number(req.params.id);
  const restaurante = await restauranteService.toggleActivo(id, grupoScope(req));

  registrarAuditoria({
    accion:                restaurante.activo ? 'ACTIVAR_RESTAURANTE' : 'DESACTIVAR_RESTAURANTE',
    modulo:                'restaurantes',
    tabla_afectada:        'restaurante',
    id_registro_afectado:  restaurante.id,
    datos_nuevos:          { activo: restaurante.activo },
    id_usuario:            (req as any).user?.id,
    ip_address:            req.auditContext?.ip,
    user_agent:            req.auditContext?.userAgent,
  }).catch(() => {});

  res.json({ success: true, data: restaurante, message: 'Estado del restaurante actualizado' });
});
