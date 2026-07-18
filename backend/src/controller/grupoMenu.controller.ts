/**
 * GrupoMenuController — subdivisiones editables del menú lateral
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { grupoMenuService } from '../services/grupoMenu.service';
import { asyncHandler } from '../middlewares/error.middleware';
import { registrarAuditoria } from '../repositories/auditoria.repository';

const itemSchema = z.object({
  path:    z.string().min(1).max(100),
  orden:   z.number().int(),
  visible: z.boolean(),
});

const grupoSchema = z.object({
  nombre: z.string().min(1).max(50),
  orden:  z.number().int(),
  items:  z.array(itemSchema),
});

const guardarSchema = z.object({
  grupos: z.array(grupoSchema),
});

/** GET /menu — estructura de grupos + módulos (cualquier usuario autenticado) */
export const listar = asyncHandler(async (_req: Request, res: Response) => {
  const data = await grupoMenuService.listar();
  // No cachear en el navegador/proxies — el sidebar debe reflejar el último guardado
  // de un admin sin depender de heurísticas de caché HTTP.
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data });
});

/** PUT /menu — reemplaza toda la estructura (superadmin) */
export const guardar = asyncHandler(async (req: Request, res: Response) => {
  const { grupos } = guardarSchema.parse(req.body);
  const data = await grupoMenuService.guardar(grupos);

  registrarAuditoria({
    id_usuario:     (req as any).user?.id,
    accion:         'GUARDAR_MENU',
    modulo:         'menu',
    tabla_afectada: 'grupos_menu',
    datos_nuevos:   { grupos },
    ip_address:     req.auditContext?.ip,
    user_agent:     req.auditContext?.userAgent,
  });

  res.json({ success: true, data, message: 'Menú guardado' });
});
