/**
 * MiGrupo Routes — /api/v1/mi-grupo
 *
 * Panel de administración del grupo para su owner/admin (NO requiere superadmin).
 * El grupo administrado lo resuelve requireGrupoAdmin (req.grupoAdminId):
 * superadmin usa la sede activa; owner/admin usa sus membresías UsuarioGrupo.
 *
 *   GET    /mi-grupo                                → resumen (grupo + sedes)
 *   GET    /mi-grupo/miembros                       → miembros del grupo
 *   GET    /mi-grupo/restaurantes/:id/usuarios      → usuarios de una sede
 *   POST   /mi-grupo/restaurantes/:id/usuarios      → vincular miembro a la sede
 *   DELETE /mi-grupo/restaurantes/:id/usuarios/:idUsuario → desvincular
 *   PUT    /mi-grupo/restaurantes/:id               → editar datos básicos de la sede
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware';
import { tenantContextOptional } from '../middlewares/tenantContext.middleware';
import { requireGrupoAdmin } from '../middlewares/grupoAdmin.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { registrarAuditoria } from '../repositories/auditoria.repository';
import { miGrupoService } from '../services/mi-grupo.service';

const router = Router();

router.use(authenticate, tenantContextOptional, requireGrupoAdmin);

// Whitelist estricta: sin id_grupo, es_default, tipo_tenant ni config
const sedeUpdateSchema = z.object({
  nombre:       z.string().min(1).max(200).optional(),
  descripcion:  z.string().optional(),
  logo_url:     z.string().url().max(500).optional().or(z.literal('')),
  direccion:    z.string().max(300).optional(),
  ciudad:       z.string().max(100).optional(),
  telefono:     z.string().max(20).optional(),
  email:        z.string().email().max(150).optional().or(z.literal('')),
  zona_horaria: z.string().max(50).optional(),
  moneda:       z.string().max(10).optional(),
  activo:       z.boolean().optional(),
});

const asignarUsuarioSchema = z.object({
  id_usuario: z.number().int().positive(),
});

router.get('/', asyncHandler(async (req, res) => {
  const data = await miGrupoService.resumen(req.grupoAdminId!);
  res.json({ success: true, data: { ...data, rol_en_grupo: req.rolEnGrupo ?? 'superadmin' } });
}));

router.get('/miembros', asyncHandler(async (req, res) => {
  const data = await miGrupoService.miembros(req.grupoAdminId!);
  res.json({ success: true, data });
}));

router.get('/restaurantes/:id/usuarios', asyncHandler(async (req, res) => {
  const data = await miGrupoService.usuariosDeSede(req.grupoAdminId!, Number(req.params.id));
  res.json({ success: true, data });
}));

router.post('/restaurantes/:id/usuarios', asyncHandler(async (req, res) => {
  const { id_usuario } = asignarUsuarioSchema.parse(req.body);
  const idRestaurante  = Number(req.params.id);
  const data = await miGrupoService.asignarUsuario(req.grupoAdminId!, idRestaurante, id_usuario);

  registrarAuditoria({
    id_usuario:           req.user?.id,
    accion:               'ASIGNAR_USUARIO_SEDE',
    modulo:               'mi-grupo',
    tabla_afectada:       'usuario_restaurante',
    id_registro_afectado: idRestaurante,
    datos_nuevos:         { id_usuario, id_restaurante: idRestaurante },
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  });

  res.status(201).json({ success: true, data, message: 'Usuario vinculado a la sede' });
}));

router.delete('/restaurantes/:id/usuarios/:idUsuario', asyncHandler(async (req, res) => {
  const idRestaurante = Number(req.params.id);
  const idUsuario     = Number(req.params.idUsuario);
  await miGrupoService.removerUsuario(req.grupoAdminId!, idRestaurante, idUsuario);

  registrarAuditoria({
    id_usuario:           req.user?.id,
    accion:               'REMOVER_USUARIO_SEDE',
    modulo:               'mi-grupo',
    tabla_afectada:       'usuario_restaurante',
    id_registro_afectado: idRestaurante,
    datos_nuevos:         { id_usuario: idUsuario, id_restaurante: idRestaurante },
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  });

  res.json({ success: true, message: 'Usuario desvinculado de la sede' });
}));

router.put('/restaurantes/:id', asyncHandler(async (req, res) => {
  const dto = sedeUpdateSchema.parse(req.body);
  const data = {
    ...dto,
    logo_url: dto.logo_url || undefined,
    email:    dto.email    || undefined,
  };
  const sede = await miGrupoService.actualizarSede(req.grupoAdminId!, Number(req.params.id), data);

  registrarAuditoria({
    id_usuario:           req.user?.id,
    accion:               'ACTUALIZAR_SEDE_GRUPO',
    modulo:               'mi-grupo',
    tabla_afectada:       'restaurante',
    id_registro_afectado: sede.id,
    datos_nuevos:         data,
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  });

  res.json({ success: true, data: sede, message: 'Sede actualizada' });
}));

export default router;
