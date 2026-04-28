/**
 * VariantesController - Variantes de productos
 */

import { Request, Response } from 'express';
import { varianteService } from '../services/variante.service';
import { asyncHandler } from '../middlewares/error.middleware';
import { createVarianteSchema, updateVarianteSchema, reorderVariantesSchema } from '../dto/variantes.dto';
import { registrarAuditoria } from '../repositories/auditoria.repository';

export const getAll = asyncHandler(async (req: Request, res: Response) => {
  const id_producto = Number(req.params.productoId);
  const variantes = await varianteService.listarPorProducto(id_producto);
  res.json({ success: true, data: variantes });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const variante = await varianteService.obtenerPorId(Number(req.params.id));
  res.json({ success: true, data: variante });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const id_producto = Number(req.params.productoId);
  const data = createVarianteSchema.parse(req.body);
  const variante = await varianteService.crear(id_producto, data as any);

  registrarAuditoria({
    id_usuario:           (req as any).user?.id,
    accion:               'CREAR_VARIANTE',
    modulo:               'variantes',
    tabla_afectada:       'producto_variantes',
    id_registro_afectado: variante.id,
    datos_nuevos:         variante,
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  });

  res.status(201).json({ success: true, data: variante, message: 'Variante creada correctamente' });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const data = updateVarianteSchema.parse(req.body);
  const variante = await varianteService.actualizar(id, data as any);

  registrarAuditoria({
    id_usuario:           (req as any).user?.id,
    accion:               'ACTUALIZAR_VARIANTE',
    modulo:               'variantes',
    tabla_afectada:       'producto_variantes',
    id_registro_afectado: id,
    datos_nuevos:         data,
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  });

  res.json({ success: true, data: variante, message: 'Variante actualizada correctamente' });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await varianteService.eliminar(id);

  registrarAuditoria({
    id_usuario:           (req as any).user?.id,
    accion:               'ELIMINAR_VARIANTE',
    modulo:               'variantes',
    tabla_afectada:       'producto_variantes',
    id_registro_afectado: id,
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  });

  res.status(204).send();
});

export const reorder = asyncHandler(async (req: Request, res: Response) => {
  const id_producto = Number(req.params.productoId);
  const { items } = reorderVariantesSchema.parse(req.body);
  await varianteService.reordenar(id_producto, items);

  registrarAuditoria({
    id_usuario:           (req as any).user?.id,
    accion:               'REORDENAR_VARIANTES',
    modulo:               'variantes',
    tabla_afectada:       'producto_variantes',
    id_registro_afectado: id_producto,
    datos_nuevos:         { items },
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  });

  res.json({ success: true, message: 'Orden actualizado correctamente' });
});
