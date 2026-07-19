/**
 * OrdenesController - Recibe request, valida con Zod, despacha via CQRS o service
 *
 * Nueva arquitectura:
 *   create   → Orden + N sedes (createOrdenV2Schema) o CQRS legado (createOrdenSchema)
 *   pagar    → pago global multi-método
 *   cancelar → cancela Orden + todas las sedes
 *
 * Legado (órdenes sin sedes — backwards compatible):
 *   updateEstado → transición por id_estado (tabla estados_orden)
 *   addDetalle / updateDetalle / removeDetalle → OrdenDetalle
 */

import { Request, Response } from 'express';
import { TipoOrden, EstadoOrdenGlobal } from '@prisma/client';
import { ordenService } from '../services/orden.service';
import { ordenRepository } from '../repositories/orden.repository';
import { buildTenantCtx } from '../lib/tenantCtx';
import {
  createOrdenSchema,
  createOrdenV2Schema,
  updateOrdenSchema,
  updateEstadoSchema,
  addDetalleSchema,
  updateDetalleSchema,
  pagarOrdenGlobalSchema,
  cancelarOrdenSchema,
} from '../dto/ordenes.dto';
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
    estado_global:  qs(req.query.estado_global) as EstadoOrdenGlobal | undefined,
    fecha_desde:    qs(req.query.fecha_desde),
    fecha_hasta:    qs(req.query.fecha_hasta),
    id_restaurante: req.restauranteId ?? (req.query.id_restaurante ? Number(req.query.id_restaurante) : undefined),
    id_grupo:       req.query.id_grupo ? Number(req.query.id_grupo) : undefined,
  })) as any;
  res.json({ success: true, ...result });
});

export const getEstadisticas = asyncHandler(async (req: Request, res: Response) => {
  const stats = await ordenService.estadisticas({
    fecha_desde: req.query.fecha_desde ? new Date(qs(req.query.fecha_desde)!) : undefined,
    fecha_hasta: req.query.fecha_hasta ? new Date(qs(req.query.fecha_hasta)!) : undefined,
    id_grupo:    req.query.id_grupo ? Number(req.query.id_grupo) : undefined,
  });
  res.json({ success: true, data: stats });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const orden = await ordenService.obtenerPorId(Number(req.params.id));
  res.json({ success: true, data: orden });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as any;
  let orden: any;

  if (body.sedes && Array.isArray(body.sedes)) {
    // Nueva arquitectura
    const data = createOrdenV2Schema.parse({
      ...body,
      id_grupo: body.id_grupo ?? (req as any).user?.id_grupo,
    });
    orden = await ordenService.crear({
      ...data,
      id_usuario: (req as any).user?.id,
    });
  } else {
    // Legado — usar CQRS existente
    const data = createOrdenSchema.parse({
      ...body,
      id_restaurante: req.restauranteId ?? body.id_restaurante,
    });
    orden = await commandBus.dispatch(new CreateOrdenCommand(data as any, (req as any).user?.id));
  }

  registrarAuditoria({
    id_usuario:           (req as any).user?.id,
    accion:               'CREAR_ORDEN',
    modulo:               'ordenes',
    tabla_afectada:       'ordenes',
    id_registro_afectado: (orden as any)?.id,
    datos_nuevos:         { tipo_orden: (orden as any)?.tipo_orden, total: (orden as any)?.total },
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  });

  socketGateway.emitNuevaOrden({
    id:           (orden as any).id,
    numero_orden: (orden as any).numero_orden,
    tipo_orden:   (orden as any).tipo_orden,
    total:        (orden as any).total,
  });

  res.status(201).json({ success: true, data: orden, message: 'Orden creada correctamente' });
});

export const pagar = asyncHandler(async (req: Request, res: Response) => {
  const { pagos } = pagarOrdenGlobalSchema.parse(req.body);
  const orden = await ordenService.pagar(Number(req.params.id), pagos, buildTenantCtx(req), (req as any).user?.id);

  registrarAuditoria({
    id_usuario:           (req as any).user?.id,
    accion:               'PAGAR_ORDEN',
    modulo:               'ordenes',
    tabla_afectada:       'ordenes',
    id_registro_afectado: Number(req.params.id),
    datos_nuevos:         { pagos_count: pagos.length },
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  });

  socketGateway.emitEstadoOrden({ id: Number(req.params.id), id_estado: 0 });
  res.json({ success: true, data: orden, message: 'Orden pagada y entregada' });
});

export const cancelar = asyncHandler(async (req: Request, res: Response) => {
  const { motivo } = cancelarOrdenSchema.parse(req.body);
  await ordenService.cancelar(Number(req.params.id), buildTenantCtx(req), motivo, (req as any).user?.id);

  registrarAuditoria({
    id_usuario:           (req as any).user?.id,
    accion:               'CANCELAR_ORDEN',
    modulo:               'ordenes',
    tabla_afectada:       'ordenes',
    id_registro_afectado: Number(req.params.id),
    datos_nuevos:         { motivo },
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  });

  socketGateway.emitOrdenCancelada(Number(req.params.id));
  res.json({ success: true, message: 'Orden cancelada' });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const data = updateOrdenSchema.parse(req.body);
  const orden = await ordenService.actualizar(Number(req.params.id), data, buildTenantCtx(req));
  res.json({ success: true, data: orden, message: 'Orden actualizada' });
});

export const updateEstado = asyncHandler(async (req: Request, res: Response) => {
  const { id_estado, pagos } = updateEstadoSchema.parse(req.body);
  const orden = await ordenService.actualizarEstado(Number(req.params.id), id_estado, buildTenantCtx(req), pagos);

  registrarAuditoria({
    id_usuario:           (req as any).user?.id,
    accion:               'CAMBIAR_ESTADO_ORDEN',
    modulo:               'ordenes',
    tabla_afectada:       'ordenes',
    id_registro_afectado: Number(req.params.id),
    datos_nuevos:         { id_estado },
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  });

  socketGateway.emitEstadoOrden({ id: Number(req.params.id), id_estado });
  res.json({ success: true, data: orden, message: 'Estado de orden actualizado' });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  // Pre-dispatch guard: validate tenant before CQRS — command handler has no ctx
  await ordenRepository.findByIdScoped(id, buildTenantCtx(req));
  await commandBus.dispatch(new CancelOrdenCommand(id, (req as any).user?.id));

  registrarAuditoria({
    id_usuario:           (req as any).user?.id,
    accion:               'CANCELAR_ORDEN',
    modulo:               'ordenes',
    tabla_afectada:       'ordenes',
    id_registro_afectado: id,
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  });

  socketGateway.emitOrdenCancelada(id);
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
