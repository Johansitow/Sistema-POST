/**
 * PlantillasController - Plantillas de impresión
 */

import { Request, Response } from 'express';
import { plantillaService } from '../services/plantilla.service';
import { buildTenantCtx } from '../lib/tenantCtx';
import { asyncHandler } from '../middlewares/error.middleware';
import { registrarAuditoria } from '../repositories/auditoria.repository';
import { z } from 'zod';

const plantillaSchema = z.object({
  nombre:     z.string().min(1).max(100),
  tipo:       z.enum(['comanda', 'factura', 'ticket', 'cocina']),
  es_default: z.boolean().default(false),
  plantilla:  z.record(z.unknown()),
});

const updatePlantillaSchema = plantillaSchema.partial();

export const getAll = asyncHandler(async (req: Request, res: Response) => {
  const tipo = req.query.tipo as string | undefined;
  const plantillas = await plantillaService.listar(tipo, {
    id_restaurante: req.restauranteId,
    id_grupo:       req.grupoId,
  });
  res.json({ success: true, data: plantillas });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const plantilla = await plantillaService.obtenerPorId(Number(req.params.id));
  res.json({ success: true, data: plantilla });
});

export const getDefault = asyncHandler(async (req: Request, res: Response) => {
  const tipo = String(req.params.tipo);
  const plantilla = await plantillaService.obtenerDefault(tipo);
  res.json({ success: true, data: plantilla });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = plantillaSchema.parse(req.body);
  const plantilla = await plantillaService.crear(data, buildTenantCtx(req));

  registrarAuditoria({
    id_usuario:           (req as any).user?.id,
    accion:               'CREAR_PLANTILLA',
    modulo:               'plantillas',
    tabla_afectada:       'plantillas_impresion',
    id_registro_afectado: plantilla.id,
    datos_nuevos:         { nombre: plantilla.nombre, tipo: plantilla.tipo, es_default: plantilla.es_default },
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  });

  res.status(201).json({ success: true, data: plantilla, message: 'Plantilla creada correctamente' });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const data = updatePlantillaSchema.parse(req.body);
  const plantilla = await plantillaService.actualizar(id, data, buildTenantCtx(req));

  registrarAuditoria({
    id_usuario:           (req as any).user?.id,
    accion:               'ACTUALIZAR_PLANTILLA',
    modulo:               'plantillas',
    tabla_afectada:       'plantillas_impresion',
    id_registro_afectado: id,
    datos_nuevos:         data,
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  });

  res.json({ success: true, data: plantilla, message: 'Plantilla actualizada correctamente' });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await plantillaService.eliminar(id, buildTenantCtx(req));

  registrarAuditoria({
    id_usuario:           (req as any).user?.id,
    accion:               'ELIMINAR_PLANTILLA',
    modulo:               'plantillas',
    tabla_afectada:       'plantillas_impresion',
    id_registro_afectado: id,
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  });

  res.status(204).send();
});
