/**
 * UiConfiguracionController — Configuraciones dinámicas de UI
 */

import { Request, Response } from 'express';
import { z }                  from 'zod';
import { uiConfiguracionService } from '../services/uiConfiguracion.service';
import { contextosDelGrupo, assertContextoDelGrupo } from '../services/grupoContexto.helper';
import { asyncHandler }           from '../middlewares/error.middleware';
import { registrarAuditoria }     from '../repositories/auditoria.repository';
import { BadRequestError }        from '../exceptions/HttpErrors';

const str = (v: string | string[]): string => Array.isArray(v) ? v[0] : v;

const upsertSchema = z.object({
  valor:    z.unknown(),
  contexto: z.string().max(100).optional(),
});

/**
 * Scope multi-tenant: undefined para superadmin; el grupo administrado
 * (req.grupoAdminId de requireAdminAccess) para admins de grupo.
 */
const grupoScope = (req: Request): number | undefined =>
  req.esSuperAdmin ? undefined : req.grupoAdminId;

/** GET /ui-config — todas las configs (SA) o globales + las del grupo (admin de grupo) */
export const getAll = asyncHandler(async (req: Request, res: Response) => {
  const data    = await uiConfiguracionService.getAll();
  const grupoId = grupoScope(req);
  if (!grupoId) { res.json({ success: true, data }); return; }
  const visibles = await contextosDelGrupo(grupoId);
  const filtradas = (data as Array<{ contexto?: string | null }>).filter(
    c => !c.contexto || visibles.has(c.contexto)
  );
  res.json({ success: true, data: filtradas });
});

/**
 * GET /ui-config/public/branding — nombre/color/logo del scope `apariencia` (SIN autenticación).
 * Necesario porque el login y el sidebar deben poder mostrar la marca antes de que
 * exista una sesión. Solo expone estas 3 claves (no todo el scope), ya que están
 * pensadas para ser visibles públicamente en la pantalla de login.
 */
export const getPublicBranding = asyncHandler(async (_req: Request, res: Response) => {
  const configs = await uiConfiguracionService.getByScope('apariencia');
  const data: Record<string, unknown> = {};
  for (const c of configs) data[c.clave] = c.valor;
  res.json({ success: true, data });
});

/** GET /ui-config/:scope  — todas del scope (autenticado) */
export const getByScope = asyncHandler(async (req: Request, res: Response) => {
  const data = await uiConfiguracionService.getByScope(str(req.params.scope));
  res.json({ success: true, data });
});

/** GET /ui-config/:scope/:clave?contexto=  — una config (autenticado) */
export const getConfig = asyncHandler(async (req: Request, res: Response) => {
  const scope    = str(req.params.scope);
  const clave    = str(req.params.clave);
  const contexto = req.query.contexto as string | undefined;
  const data = await uiConfiguracionService.getConfig(scope, clave, contexto);
  res.json({ success: true, data: data ?? null });
});

/** PUT /ui-config/:scope/:clave — crear/actualizar.
 *  Superadmin: cualquier config (global o con contexto).
 *  Admin de grupo (apariencia.gestionar): SOLO con contexto de su grupo/sedes —
 *  nunca puede tocar la configuración global del sistema. */
export const setConfig = asyncHandler(async (req: Request, res: Response) => {
  const scope = str(req.params.scope);
  const clave = str(req.params.clave);
  if (!scope || !clave) throw new BadRequestError('scope y clave son requeridos');
  const { valor, contexto } = upsertSchema.parse(req.body);
  await assertContextoDelGrupo(contexto, grupoScope(req));
  const data = await uiConfiguracionService.setConfig(scope, clave, valor, contexto);

  registrarAuditoria({
    id_usuario:           (req as any).user?.id,
    accion:               'SET_UI_CONFIG',
    modulo:               'ui_config',
    tabla_afectada:       'ui_configuraciones',
    id_registro_afectado: data.id,
    datos_nuevos:         { scope, clave, valor, contexto },
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  });

  res.json({ success: true, data, message: 'Configuración guardada' });
});

/** DELETE /ui-config/:id  — eliminar una config por ID (superadmin) */
export const deleteConfig = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) throw new BadRequestError('id debe ser un número');
  await uiConfiguracionService.deleteConfig(id);

  registrarAuditoria({
    id_usuario:           (req as any).user?.id,
    accion:               'ELIMINAR_UI_CONFIG',
    modulo:               'ui_config',
    tabla_afectada:       'ui_configuraciones',
    id_registro_afectado: id,
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  });

  res.status(204).send();
});
