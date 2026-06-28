/**
 * OrdenSedes Routes — operaciones de cocina por restaurante
 *
 * Estos endpoints son usados por:
 *  - La pantalla de cocina / KDS (listar, avanzar estado)
 *  - El cajero / mesero (agregar/eliminar items mientras la orden está activa)
 *
 * Todos requieren autenticación. El id_restaurante se toma del JWT (tenantContext).
 */

import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';
import { tenantContext } from '../middlewares/tenantContext.middleware';
import { buildTenantCtx } from '../lib/tenantCtx';
import { ordenSedeService } from '../services/orden-sede.service';
import {
  agregarItemSedeSchema,
  actualizarItemSedeSchema,
  cancelarSedeSchema,
} from '../dto/ordenes.dto';
import { EstadoOrdenSede } from '@prisma/client';

const router = Router();

router.use(authenticate);

// ── Vista de cocina ─────────────────────────────────────────────────────────

/**
 * GET /orden-sedes
 * Lista las sedes activas del restaurante activo del usuario (vista de cocina).
 * Filtros: ?estado=PENDIENTE&desde=&hasta=
 */
router.get(
  '/',
  tenantContext,
  requirePermission('ordenes.ver'),
  asyncHandler(async (req, res) => {
    const result = await ordenSedeService.listarPorRestaurante(
      req.restauranteId!,
      {
        page:   req.query.page,
        limit:  req.query.limit,
        estado: req.query.estado as EstadoOrdenSede | undefined,
        desde:  req.query.desde  ? new Date(req.query.desde  as string) : undefined,
        hasta:  req.query.hasta  ? new Date(req.query.hasta   as string) : undefined,
      }
    );
    res.json({ success: true, ...result });
  })
);

/**
 * GET /orden-sedes/:id
 * Detalle de una sede específica.
 */
router.get(
  '/:id',
  requirePermission('ordenes.ver'),
  asyncHandler(async (req, res) => {
    const sede = await ordenSedeService.obtenerPorId(Number(req.params.id));
    res.json({ success: true, data: sede });
  })
);

// ── Avance de estado (cocina) ────────────────────────────────────────────────

/**
 * PATCH /orden-sedes/:id/avanzar
 * Avanza el estado de la sede al siguiente en la cadena:
 *   PENDIENTE → EN_PREPARACION → LISTA
 *
 * No requiere body. El siguiente estado es determinado automáticamente.
 * Al llegar a LISTA y todas las sedes estar listas → Orden global pasa a LISTA.
 */
router.patch(
  '/:id/avanzar',
  tenantContext,
  requirePermission('ordenes.crear'),
  asyncHandler(async (req, res) => {
    const sede = await ordenSedeService.avanzarEstado(
      Number(req.params.id),
      buildTenantCtx(req),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).user?.id,
    );
    res.json({ success: true, data: sede, message: 'Estado de sede actualizado' });
  })
);

// ── Gestión de ítems ────────────────────────────────────────────────────────

/**
 * POST /orden-sedes/:id/items
 * Agrega un producto a la sede (mesero agrega después de abrir la orden).
 * Valida stock del restaurante de ESA sede.
 */
router.post(
  '/:id/items',
  tenantContext,
  requirePermission('ordenes.crear'),
  asyncHandler(async (req, res) => {
    const data = agregarItemSedeSchema.parse(req.body);
    const item = await ordenSedeService.agregarItem(Number(req.params.id), data, buildTenantCtx(req));
    res.status(201).json({ success: true, data: item, message: 'Producto agregado a la sede' });
  })
);

/**
 * PUT /orden-sedes/items/:itemId
 * Actualiza cantidad o notas de un ítem.
 */
router.put(
  '/items/:itemId',
  tenantContext,
  requirePermission('ordenes.crear'),
  asyncHandler(async (req, res) => {
    const data = actualizarItemSedeSchema.parse(req.body);
    const item = await ordenSedeService.actualizarItem(Number(req.params.itemId), data, buildTenantCtx(req));
    res.json({ success: true, data: item, message: 'Item actualizado' });
  })
);

/**
 * DELETE /orden-sedes/items/:itemId
 * Elimina un ítem y revierte el stock si corresponde.
 */
router.delete(
  '/items/:itemId',
  tenantContext,
  requirePermission('ordenes.cancelar'),
  asyncHandler(async (req, res) => {
    await ordenSedeService.eliminarItem(Number(req.params.itemId), buildTenantCtx(req));
    res.status(204).send();
  })
);

// ── Cancelar sede ────────────────────────────────────────────────────────────

/**
 * POST /orden-sedes/:id/cancelar
 * Cancela esta sede específica.
 * Si es la última sede activa de la Orden → cancela la Orden completa.
 */
router.post(
  '/:id/cancelar',
  tenantContext,
  requirePermission('ordenes.cancelar'),
  asyncHandler(async (req, res) => {
    const { motivo } = cancelarSedeSchema.parse(req.body);
    await ordenSedeService.cancelar(
      Number(req.params.id),
      motivo,
      buildTenantCtx(req),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).user?.id,
    );
    res.json({ success: true, message: 'Sede cancelada' });
  })
);

export default router;
