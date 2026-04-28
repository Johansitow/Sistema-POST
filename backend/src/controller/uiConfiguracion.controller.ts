/**
 * UiConfiguracionController — Configuraciones dinámicas de UI
 */

import { Request, Response } from 'express';
import { z }                  from 'zod';
import { uiConfiguracionService } from '../services/uiConfiguracion.service';
import { asyncHandler }           from '../middlewares/error.middleware';
import { registrarAuditoria }     from '../repositories/auditoria.repository';
import { BadRequestError }        from '../exceptions/HttpErrors';

const str = (v: string | string[]): string => Array.isArray(v) ? v[0] : v;

const upsertSchema = z.object({
  valor:    z.unknown(),
  contexto: z.string().max(100).optional(),
});

/** GET /ui-config  — todas las configs (superadmin) */
export const getAll = asyncHandler(async (_req: Request, res: Response) => {
  const data = await uiConfiguracionService.getAll();
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

/** PUT /ui-config/:scope/:clave  — crear/actualizar (superadmin) */
export const setConfig = asyncHandler(async (req: Request, res: Response) => {
  const scope = str(req.params.scope);
  const clave = str(req.params.clave);
  if (!scope || !clave) throw new BadRequestError('scope y clave son requeridos');
  const { valor, contexto } = upsertSchema.parse(req.body);
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
