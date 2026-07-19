/**
 * OrdenesController - Recibe request, valida con Zod, despacha via CQRS
 *
 * getAll  → QueryBus  (GetOrdenesQuery)
 * create  → CommandBus (CreateOrdenCommand)
 * remove  → CommandBus (CancelOrdenCommand)
 * El resto sigue llamando al service directamente (migración gradual).
 */

import { Request, Response } from 'express';
import { TipoOrden } from '@prisma/client';
import { ordenService } from '../services/orden.service';
import { buildTenantCtx } from '../lib/tenantCtx';
import { createOrdenSchema, updateOrdenSchema, updateEstadoSchema, addDetalleSchema, updateDetalleSchema } from '../dto/ordenes.dto';
import { asyncHandler } from '../middlewares/error.middleware';
import { registrarAuditoria } from '../repositories/auditoria.repository';
import { socketGateway } from '../config/socket.gateway';
import { commandBus } from '../application/commands/CommandBus';
import { queryBus }   from '../application/queries/QueryBus';
import { GetOrdenesQuery }    from '../application/queries/orden/GetOrdenesQuery';
import { CreateOrdenCommand } from '../application/commands/orden/CreateOrdenCommand';
import { CancelOrdenCommand } from '../application/commands/orden/CancelOrdenCommand';

const qs = (val: unknown): string | undefined => Array.isArray(val) ? val[0] : val as string | undefined;

export const getAll = asyncHandler(async (req: Request, res: Response) => {
  const result = await queryBus.execute(new GetOrdenesQuery({
    page:           req.query.page      ? Number(req.query.page)      : undefined,
    limit:          req.query.limit     ? Number(req.query.limit)     : undefined,
    tipo_orden:     qs(req.query.tipo_orden) as TipoOrden | undefined,
    id_estado:      req.query.id_estado ? Number(req.query.id_estado) : undefined,
    fecha_desde:    qs(req.query.fecha_desde),
    fecha_hasta:    qs(req.query.fecha_hasta),
    id_restaurante: req.restauranteId ?? (req.query.id_restaurante ? Number(req.query.id_restaurante) : undefined),
  })) as any;
  res.json({ success: true, ...result });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const orden = await ordenService.obtenerPorId(Number(req.params.id));
  res.json({ success: true, data: orden });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = createOrdenSchema.parse({
    ...(req.body as object),
    id_restaurante: req.restauranteId ?? (req.body as any).id_restaurante,
  });
  const orden = await commandBus.dispatch(new CreateOrdenCommand(data as any, (req as any).user?.id)) as any;

  registrarAuditoria({
    id_usuario:            (req as any).user?.id,
    accion:                'CREAR_ORDEN',
    modulo:                'ordenes',
    tabla_afectada:        'ordenes',
    id_registro_afectado:  orden.id,
    datos_nuevos:          { tipo_orden: orden.tipo_orden, total: orden.total },
    ip_address:            req.auditContext?.ip,
    user_agent:            req.auditContext?.userAgent,
  });

  socketGateway.emitNuevaOrden({
    id:           orden.id,
    numero_orden: orden.numero_orden,
    tipo_orden:   orden.tipo_orden,
    total:        orden.total,
  }, req.restauranteId !== undefined ? [req.restauranteId] : []);

  res.status(201).json({ success: true, data: orden, message: 'Orden creada correctamente' });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const data = updateOrdenSchema.parse(req.body);
  const orden = await ordenService.actualizar(Number(req.params.id), data, buildTenantCtx(req));
  res.json({ success: true, data: orden, message: 'Orden actualizada correctamente' });
});

export const updateEstado = asyncHandler(async (req: Request, res: Response) => {
  const { id_estado, pagos } = updateEstadoSchema.parse(req.body);
  const orden = await ordenService.actualizarEstado(Number(req.params.id), id_estado, buildTenantCtx(req), pagos) as any;

  registrarAuditoria({
    id_usuario:            (req as any).user?.id,
    accion:                'CAMBIAR_ESTADO_ORDEN',
    modulo:                'ordenes',
    tabla_afectada:        'ordenes',
    id_registro_afectado:  (orden as any)?.id,
    datos_nuevos:          { id_estado },
    ip_address:            req.auditContext?.ip,
    user_agent:            req.auditContext?.userAgent,
  });

  socketGateway.emitEstadoOrden({ id: (orden as any)?.id, id_estado }, req.restauranteId !== undefined ? [req.restauranteId] : []);

  res.json({ success: true, data: orden, message: 'Estado de orden actualizado' });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await commandBus.dispatch(new CancelOrdenCommand(id, (req as any).user?.id));

  registrarAuditoria({
    id_usuario:            (req as any).user?.id,
    accion:                'CANCELAR_ORDEN',
    modulo:                'ordenes',
    tabla_afectada:        'ordenes',
    id_registro_afectado:  id,
    ip_address:            req.auditContext?.ip,
    user_agent:            req.auditContext?.userAgent,
  });

  socketGateway.emitOrdenCancelada(id, req.restauranteId !== undefined ? [req.restauranteId] : []);

  res.status(204).send();
});

export const addDetalle = asyncHandler(async (req: Request, res: Response) => {
  const data = addDetalleSchema.parse(req.body);
  const detalle = await ordenService.agregarDetalle(Number(req.params.id), data, buildTenantCtx(req));
  res.status(201).json({ success: true, data: detalle, message: 'Producto agregado a la orden' });
});

export const updateDetalle = asyncHandler(async (req: Request, res: Response) => {
  const data = updateDetalleSchema.parse(req.body);
  const detalle = await ordenService.actualizarDetalle(Number(req.params.detalleId), data, buildTenantCtx(req));
  res.json({ success: true, data: detalle, message: 'Detalle actualizado' });
});

export const removeDetalle = asyncHandler(async (req: Request, res: Response) => {
  await ordenService.eliminarDetalle(Number(req.params.detalleId), buildTenantCtx(req));
  res.status(204).send();
});

export const getEstadisticas = asyncHandler(async (req: Request, res: Response) => {
  const stats = await ordenService.estadisticas({
    fecha_desde: req.query.fecha_desde ? new Date(qs(req.query.fecha_desde)!) : undefined,
    fecha_hasta: req.query.fecha_hasta ? new Date(qs(req.query.fecha_hasta)!) : undefined,
  });
  res.json({ success: true, data: stats });
});
