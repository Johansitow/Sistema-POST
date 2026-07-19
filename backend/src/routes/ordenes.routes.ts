/**
 * Ordenes Routes — nueva arquitectura + compatibilidad legado
 *
 * Nueva arquitectura:
 *   POST /ordenes          → crea Orden + N sedes (createOrdenV2Schema)
 *   POST /ordenes/:id/pagar → pago global multi-método
 *   POST /ordenes/:id/cancelar → cancela Orden + todas las sedes
 *
 * Legado (órdenes sin sedes — backwards compatible):
 *   PATCH /ordenes/:id/estado → transición por id_estado (tabla estados_orden)
 *   POST  /ordenes/:id/detalles → agregar detalle (OrdenDetalle)
 *   PUT   /ordenes/:id/detalles/:detalleId
 *   DELETE /ordenes/detalles/:detalleId
 *
 * Permisos:
 *   ordenes.ver      → Cajero, Cocina, Admin
 *   ordenes.crear    → Cajero, Admin
 *   ordenes.cancelar → Cajero, Admin
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';
import { tenantContext, tenantContextOptional } from '../middlewares/tenantContext.middleware';
import { tenantIsolation } from '../middlewares/tenantIsolation.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { buildTenantCtx } from '../lib/tenantCtx';
import { registrarAuditoria } from '../repositories/auditoria.repository';
import { socketGateway } from '../config/socket.gateway';
import { commandBus } from '../application/commands/CommandBus';
import { queryBus }   from '../application/queries/QueryBus';
import { GetOrdenesQuery }    from '../application/queries/orden/GetOrdenesQuery';
import { CreateOrdenCommand } from '../application/commands/orden/CreateOrdenCommand';
import { CancelOrdenCommand } from '../application/commands/orden/CancelOrdenCommand';
import { ordenService }       from '../services/orden.service';
import { ordenRepository }    from '../repositories/orden.repository';
import { TipoOrden, EstadoOrdenGlobal } from '@prisma/client';
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

const qs = (val: unknown): string | undefined => Array.isArray(val) ? val[0] : val as string | undefined;

/**
 * Sedes (restaurantes) involucradas en una orden, para dirigir los eventos socket.
 * Órdenes nueva arquitectura: ids de orden.sedes[]. Legado / sin sedes: fallback
 * al id_restaurante de la orden o al de la request.
 */
const sedesDeOrden = (orden: unknown, fallback?: number): number[] => {
  const o = orden as { sedes?: Array<{ id_restaurante?: number }>; id_restaurante?: number } | null;
  const ids = (o?.sedes ?? [])
    .map(s => s.id_restaurante)
    .filter((id): id is number => typeof id === 'number');
  if (ids.length) return [...new Set(ids)];
  const unico = o?.id_restaurante ?? fallback;
  return unico !== undefined ? [unico] : [];
};

const router = Router();
router.use(authenticate);

// ── Lectura ─────────────────────────────────────────────────────────────────

router.get('/',
  tenantContextOptional,
  requirePermission('ordenes.ver'),
  asyncHandler(async (req, res) => {
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
  })
);

router.get('/estadisticas',
  tenantContextOptional,
  requirePermission('ordenes.ver'),
  asyncHandler(async (req, res) => {
    const stats = await ordenService.estadisticas({
      fecha_desde: req.query.fecha_desde ? new Date(qs(req.query.fecha_desde)!) : undefined,
      fecha_hasta: req.query.fecha_hasta ? new Date(qs(req.query.fecha_hasta)!) : undefined,
      id_grupo:    req.query.id_grupo ? Number(req.query.id_grupo) : undefined,
      // Consolidado por grupo cuando se pide id_grupo; si no, estadísticas de la sede activa
      id_restaurante: req.query.id_grupo ? undefined : req.restauranteId,
    });
    res.json({ success: true, data: stats });
  })
);

router.get('/:id',
  tenantContext,
  tenantIsolation,
  requirePermission('ordenes.ver'),
  asyncHandler(async (req, res) => {
    const orden = await ordenService.obtenerPorIdScoped(Number(req.params.id), buildTenantCtx(req));
    res.json({ success: true, data: orden });
  })
);

// ── Nueva arquitectura: crear ────────────────────────────────────────────────

/**
 * POST /ordenes
 * Crea Orden + N OrdenSede en una sola transacción.
 * Body: createOrdenV2Schema (con sedes[]) o createOrdenSchema (legado con detalles[])
 */
router.post('/',
  tenantContext,
  tenantIsolation,
  requirePermission('ordenes.crear'),
  asyncHandler(async (req, res) => {
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
    }, sedesDeOrden(orden, req.restauranteId));

    res.status(201).json({ success: true, data: orden, message: 'Orden creada correctamente' });
  })
);

// ── Nueva arquitectura: pagar ────────────────────────────────────────────────

/**
 * POST /ordenes/:id/pagar
 * Registra el pago global de la Orden.
 * Requiere estado_global === LISTA (todas las sedes terminaron).
 * Permite múltiples métodos de pago.
 */
router.post('/:id/pagar',
  tenantContext,
  requirePermission('ordenes.crear'),
  asyncHandler(async (req, res) => {
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

    socketGateway.emitEstadoOrden({ id: Number(req.params.id), id_estado: 0 }, sedesDeOrden(orden, req.restauranteId));
    res.json({ success: true, data: orden, message: 'Orden pagada y entregada' });
  })
);

// ── Nueva arquitectura: cancelar ─────────────────────────────────────────────

/**
 * POST /ordenes/:id/cancelar
 * Cancela la Orden completa + todas las sedes activas + revierte stock.
 */
router.post('/:id/cancelar',
  tenantContext,
  tenantIsolation,
  requirePermission('ordenes.cancelar'),
  asyncHandler(async (req, res) => {
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

    socketGateway.emitOrdenCancelada(Number(req.params.id), req.restauranteId !== undefined ? [req.restauranteId] : []);
    res.json({ success: true, message: 'Orden cancelada' });
  })
);

// ── Legado: actualizar datos ─────────────────────────────────────────────────

router.put('/:id',
  tenantContext,
  tenantIsolation,
  requirePermission('ordenes.crear'),
  asyncHandler(async (req, res) => {
    const data = updateOrdenSchema.parse(req.body);
    const orden = await ordenService.actualizar(Number(req.params.id), data, buildTenantCtx(req));
    res.json({ success: true, data: orden, message: 'Orden actualizada' });
  })
);

// ── Legado: cambiar estado por id_estado ─────────────────────────────────────

router.patch('/:id/estado',
  tenantContext,
  requirePermission('ordenes.crear'),
  asyncHandler(async (req, res) => {
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

    socketGateway.emitEstadoOrden({ id: Number(req.params.id), id_estado }, sedesDeOrden(orden, req.restauranteId));
    res.json({ success: true, data: orden, message: 'Estado de orden actualizado' });
  })
);

// ── Legado: DELETE (cancela con CQRS) ────────────────────────────────────────

router.delete('/:id',
  tenantContext,
  tenantIsolation,
  requirePermission('ordenes.cancelar'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    // Pre-dispatch guard: validate tenant before CQRS — command handler has no ctx
    const ordenCancelada = await ordenRepository.findByIdScoped(id, buildTenantCtx(req));
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

    socketGateway.emitOrdenCancelada(id, sedesDeOrden(ordenCancelada, req.restauranteId));
    res.status(204).send();
  })
);

// ── Legado: detalles ─────────────────────────────────────────────────────────

router.post('/:id/detalles',
  tenantContext,
  tenantIsolation,
  requirePermission('ordenes.crear'),
  asyncHandler(async (req, res) => {
    const data = addDetalleSchema.parse(req.body);
    const detalle = await ordenService.agregarDetalle(Number(req.params.id), data, buildTenantCtx(req));
    res.status(201).json({ success: true, data: detalle, message: 'Producto agregado a la orden' });
  })
);

router.put('/:id/detalles/:detalleId',
  tenantContext,
  requirePermission('ordenes.crear'),
  asyncHandler(async (req, res) => {
    const data = updateDetalleSchema.parse(req.body);
    const detalle = await ordenService.actualizarDetalle(Number(req.params.detalleId), data, buildTenantCtx(req));
    res.json({ success: true, data: detalle, message: 'Detalle actualizado' });
  })
);

router.delete('/detalles/:detalleId',
  tenantContext,
  requirePermission('ordenes.cancelar'),
  asyncHandler(async (req, res) => {
    await ordenService.eliminarDetalle(Number(req.params.detalleId), buildTenantCtx(req));
    res.status(204).send();
  })
);

export default router;
