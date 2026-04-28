/**
 * OrdenGrupo Routes — /api/v1/ordenes-grupo
 */

import { Router, Request, Response } from 'express';
import { z }                         from 'zod';
import { authenticate }              from '../middlewares/auth.middleware';
import { tenantContext }             from '../middlewares/tenantContext.middleware';
import { tenantIsolation }           from '../middlewares/tenantIsolation.middleware';
import { ordenGrupoService }         from '../services/orden-grupo.service';
import { successResponse }           from '../lib/response';
import { asyncHandler }              from '../middlewares/error.middleware';

const router = Router();
router.use(authenticate, tenantContext, tenantIsolation);

const crearSchema = z.object({
  id_grupo:   z.number().int().positive(),
  notas:      z.string().optional(),
});

const crearConOrdenesSchema = z.object({
  id_grupo:    z.number().int().positive(),
  id_estado:   z.number().int().positive(),
  tipo_orden:  z.enum(['local', 'domicilio']),
  notas:       z.string().optional(),
  id_cliente:  z.number().int().positive().optional(),
  restaurantes: z.array(z.object({
    id_restaurante: z.number().int().positive(),
    items: z.array(z.object({
      id_producto:     z.number().int().positive(),
      id_variante:     z.number().int().positive().optional(),
      cantidad:        z.number().positive(),
      precio_unitario: z.number().nonnegative(),
      notas:           z.string().optional(),
    })).min(1),
  })).min(1),
});

const pagoSchema = z.object({
  id_metodo_pago: z.number().int().positive(),
  monto:          z.number().positive(),
  referencia:     z.string().optional(),
});

// ── Listar ────────────────────────────────────────────────────────────────────

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const result = await ordenGrupoService.listar({
    page:       req.query.page,
    limit:      req.query.limit,
    id_grupo:   req.query.id_grupo   ? Number(req.query.id_grupo)   : undefined,
    id_usuario: req.query.id_usuario ? Number(req.query.id_usuario) : undefined,
    estado:     req.query.estado as string | undefined,
    desde:      req.query.desde ? new Date(req.query.desde as string) : undefined,
    hasta:      req.query.hasta ? new Date(req.query.hasta as string) : undefined,
  });
  res.json(successResponse(result));
}));

// ── Obtener por ID ────────────────────────────────────────────────────────────

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const og = await ordenGrupoService.obtenerPorId(Number(req.params.id));
  res.json(successResponse(og));
}));

// ── Crear grupo ───────────────────────────────────────────────────────────────

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { id_grupo, notas } = crearSchema.parse(req.body);
  const og = await ordenGrupoService.crear({
    id_grupo,
    id_usuario: req.user!.id,
    notas,
  });
  res.status(201).json(successResponse(og, 'Grupo de órdenes creado'));
}));

// ── Agregar una orden al grupo ────────────────────────────────────────────────

router.post('/:id/ordenes/:id_orden', asyncHandler(async (req: Request, res: Response) => {
  const og = await ordenGrupoService.agregarOrden(
    Number(req.params.id),
    Number(req.params.id_orden)
  );
  res.json(successResponse(og, 'Orden agregada al grupo'));
}));

// ── Registrar pago ────────────────────────────────────────────────────────────

router.post('/:id/pagos', asyncHandler(async (req: Request, res: Response) => {
  const data  = pagoSchema.parse(req.body);
  const pago  = await ordenGrupoService.registrarPago(Number(req.params.id), data);
  res.status(201).json(successResponse(pago, 'Pago registrado en el grupo'));
}));

// ── Crear grupo + órdenes atómico (flujo multi-restaurante) ──────────────────

router.post('/con-ordenes', asyncHandler(async (req: Request, res: Response) => {
  const data = crearConOrdenesSchema.parse(req.body);
  const og   = await ordenGrupoService.crearConOrdenes(req.user!, data);
  res.status(201).json(successResponse(og, 'Grupo de órdenes creado con órdenes'));
}));

// ── Recibo consolidado ────────────────────────────────────────────────────────

router.get('/:id/recibo', asyncHandler(async (req: Request, res: Response) => {
  const recibo = await ordenGrupoService.generarRecibo(Number(req.params.id));
  res.json(successResponse(recibo));
}));

// ── Cancelar grupo ────────────────────────────────────────────────────────────

router.post('/:id/cancelar', asyncHandler(async (req: Request, res: Response) => {
  const og = await ordenGrupoService.cancelar(Number(req.params.id));
  res.json(successResponse(og, 'Grupo cancelado'));
}));

export default router;
