/**
 * SandboxOnboardingController — thin. Tenants desechables de "Probar configuración".
 *
 * Todas las rutas van protegidas por authenticate + requireSuperAdmin (ver
 * onboarding.routes.ts). Al crear/entrar se devuelve además una `session` fresca
 * (user + tokens) que ya incluye la sede de prueba, para que el frontend haga
 * setAuth + initFromToken y pueda navegar el POS como ese tenant.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middlewares/error.middleware';
import { sandboxOnboardingService } from '../services/sandboxOnboarding.service';
import { authService } from '../services/auth.service';
import { successResponse } from '../lib/response';
import { registrarAuditoria } from '../repositories/auditoria.repository';

const CrearBodySchema = z.object({
  arquetipo: z.string().optional(),
  ejes:      z.record(z.string()).optional(),
});

/** POST /onboarding/sandbox — crea la prueba, la configura y devuelve sesión para entrar. */
export const crearSandbox = asyncHandler(async (req: Request, res: Response) => {
  const body    = CrearBodySchema.parse(req.body);
  const sandbox = await sandboxOnboardingService.crearSandbox(req.user!.id, body);
  const session = await authService.emitirSesion(req.user!.usuario);

  registrarAuditoria({
    accion:               'CREAR_SANDBOX_ONBOARDING',
    modulo:               'onboarding',
    tabla_afectada:       'grupo_negocio',
    id_registro_afectado: sandbox.id_grupo,
    datos_nuevos:         { nombre: sandbox.nombre, arquetipo: sandbox.arquetipo, sedes: sandbox.sedes.length },
    id_usuario:           req.user!.id,
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  }).catch(() => {});

  res.status(201).json(successResponse({ sandbox, session }, 'Prueba creada'));
});

/** GET /onboarding/sandbox — lista las pruebas activas. */
export const listarSandboxes = asyncHandler(async (_req: Request, res: Response) => {
  const data = await sandboxOnboardingService.listarSandboxes();
  res.json(successResponse(data));
});

/** POST /onboarding/sandbox/:idGrupo/entrar — sesión fresca para entrar a una prueba existente. */
export const entrarSandbox = asyncHandler(async (req: Request, res: Response) => {
  const idGrupo = Number(req.params.idGrupo);
  const sandbox = await sandboxOnboardingService.obtenerSandbox(idGrupo);
  const session = await authService.emitirSesion(req.user!.usuario);
  res.json(successResponse({ sandbox, session }));
});

/** DELETE /onboarding/sandbox/:idGrupo — borrado total de la prueba. */
export const eliminarSandbox = asyncHandler(async (req: Request, res: Response) => {
  const idGrupo = Number(req.params.idGrupo);
  await sandboxOnboardingService.eliminarSandbox(idGrupo);

  registrarAuditoria({
    accion:               'ELIMINAR_SANDBOX_ONBOARDING',
    modulo:               'onboarding',
    tabla_afectada:       'grupo_negocio',
    id_registro_afectado: idGrupo,
    datos_nuevos:         { id_grupo: idGrupo },
    id_usuario:           req.user!.id,
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  }).catch(() => {});

  res.json(successResponse(null, 'Prueba eliminada'));
});
