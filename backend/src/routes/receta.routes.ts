/**
 * Rutas de Recetas
 */

import { Router, Request, Response, NextFunction } from 'express';
import { recetaService }     from '../services/receta.service';
import { authenticate }      from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';
import { tenantContext }     from '../middlewares/tenantContext.middleware';
import { tenantIsolation }   from '../middlewares/tenantIsolation.middleware';
import { successResponse }   from '../lib/response';
import { buildTenantCtx }    from '../lib/tenantCtx';

const router = Router();

// Todas las rutas requieren auth + contexto de restaurante
router.use(authenticate, tenantContext, tenantIsolation);

router.post('/verificar-stock/:id_orden',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await recetaService.verificarStockParaOrden(Number(req.params.id_orden));
      res.json(successResponse(result));
    } catch (e: any) {
      if (e.message?.includes('Stock insuficiente')) {
        res.status(422).json({
          error:   e.message,
          detalle: (e as any).ingredientes_faltantes ?? [],
        });
        return;
      }
      next(e);
    }
  }
);

router.get('/producto/:id_producto',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await recetaService.obtenerPorProducto(Number(req.params.id_producto));
      res.json(successResponse(data));
    } catch (e) { next(e); }
  }
);

router.get('/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, id_producto, estado } = req.query as Record<string, string>;
      const result = await recetaService.listar({
        page, limit,
        id_producto: id_producto ? Number(id_producto) : undefined,
        estado,
      });
      res.json({ success: true, ...result });
    } catch (e) { next(e); }
  }
);

router.get('/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(successResponse(await recetaService.obtenerPorId(Number(req.params.id))));
    } catch (e) { next(e); }
  }
);

router.get('/:id/rentabilidad',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const receta = await recetaService.obtenerPorId(Number(req.params.id));
      res.json(successResponse(receta.rentabilidad));
    } catch (e) { next(e); }
  }
);

router.get('/:id/rentabilidad/desglose',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await recetaService.obtenerDesgloseRentabilidad(Number(req.params.id));
      res.json(successResponse(data));
    } catch (e) { next(e); }
  }
);

router.post('/', requirePermission('productos.crear'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id_producto_final, nombre_receta, ingredientes, id_restaurante: _ignored, ...rest } = req.body;
      if (!id_producto_final || !nombre_receta || !Array.isArray(ingredientes) || ingredientes.length === 0) {
        res.status(400).json({ error: 'id_producto_final, nombre_receta e ingredientes son requeridos' }); return;
      }
      // id_restaurante viene del contexto autenticado (req.restauranteId), nunca del body del cliente.
      const data = await recetaService.crear({ id_producto_final, nombre_receta, ingredientes, id_restaurante: req.restauranteId!, ...rest });
      res.status(201).json(successResponse(data, 'Receta creada'));
    } catch (e) { next(e); }
  }
);

router.put('/:id', requirePermission('productos.editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ingredientes: _ing, fases: _fases, ...resto } = req.body;
      const data = await recetaService.actualizar(Number(req.params.id), resto, buildTenantCtx(req));
      res.json(successResponse(data, 'Receta actualizada'));
    } catch (e) { next(e); }
  }
);

router.put('/:id/ingredientes', requirePermission('productos.editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ingredientes } = req.body;
      if (!Array.isArray(ingredientes) || ingredientes.length === 0) {
        res.status(400).json({ error: 'ingredientes debe ser un array no vacío' }); return;
      }
      const data = await recetaService.actualizarIngredientes(Number(req.params.id), ingredientes, buildTenantCtx(req));
      res.json(successResponse(data, 'Ingredientes actualizados'));
    } catch (e) { next(e); }
  }
);

// ─── Disponibilidad ──────────────────────────────────────────────────────────

router.get('/:id/disponibilidad',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await recetaService.calcularDisponibilidad(Number(req.params.id));
      res.json(successResponse(data));
    } catch (e) { next(e); }
  }
);

// ─── Fases ───────────────────────────────────────────────────────────────────

router.get('/:id/fases',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await recetaService.listarFases(Number(req.params.id), buildTenantCtx(req));
      res.json(successResponse(data));
    } catch (e) { next(e); }
  }
);

router.post('/:id/fases', requirePermission('productos.editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { numero_fase, nombre, descripcion, duracion_minutos } = req.body;
      if (!numero_fase || !nombre || !descripcion) {
        res.status(400).json({ error: 'numero_fase, nombre y descripcion son requeridos' }); return;
      }
      const data = await recetaService.crearFase(
        Number(req.params.id),
        { numero_fase: Number(numero_fase), nombre, descripcion, duracion_minutos },
        buildTenantCtx(req),
      );
      res.status(201).json(successResponse(data, 'Fase creada'));
    } catch (e) { next(e); }
  }
);

router.put('/:id/fases/:id_fase', requirePermission('productos.editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await recetaService.actualizarFase(Number(req.params.id_fase), req.body, buildTenantCtx(req));
      res.json(successResponse(data, 'Fase actualizada'));
    } catch (e) { next(e); }
  }
);

router.delete('/:id/fases/:id_fase', requirePermission('productos.editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await recetaService.eliminarFase(Number(req.params.id_fase), buildTenantCtx(req));
      res.json(successResponse(null, 'Fase eliminada'));
    } catch (e) { next(e); }
  }
);

export default router;
