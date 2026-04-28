/**
 * Rutas de Turnos y Cierres de Caja
 */

import { Router, Request, Response, NextFunction } from 'express';
import { cierreCajaService } from '../services/cierre-caja.service';
import { authenticate }      from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';
import { tenantContext, tenantContextOptional } from '../middlewares/tenantContext.middleware';
import { tenantIsolation } from '../middlewares/tenantIsolation.middleware';
import { successResponse }   from '../lib/response';
import { EstadoCierre }      from '@prisma/client';

const router = Router();

// ── Turnos ────────────────────────────────────────────────────────────────────

router.get('/turnos', authenticate, tenantContext, tenantIsolation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const soloActivos = req.query.activo === 'true';
      res.json(successResponse(await cierreCajaService.listarTurnos(req.restauranteId!, soloActivos)));
    } catch (e) { next(e); }
  }
);

router.get('/turnos/:id', authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(successResponse(await cierreCajaService.obtenerTurno(Number(req.params.id))));
    } catch (e) { next(e); }
  }
);

router.post('/turnos', authenticate, tenantContext, tenantIsolation, requirePermission('config.sistema'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { nombre, hora_apertura, hora_cierre, dias_semana } = req.body;
      if (!nombre || !hora_apertura || !hora_cierre) {
        res.status(400).json({ error: 'nombre, hora_apertura y hora_cierre son requeridos' }); return;
      }
      const data = await cierreCajaService.crearTurno({ id_restaurante: req.restauranteId!, nombre, hora_apertura, hora_cierre, dias_semana });
      res.status(201).json(successResponse(data, 'Turno creado'));
    } catch (e) { next(e); }
  }
);

router.put('/turnos/:id', authenticate, tenantContext, tenantIsolation, requirePermission('config.sistema'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await cierreCajaService.actualizarTurno(Number(req.params.id), req.body);
      res.json(successResponse(data, 'Turno actualizado'));
    } catch (e) { next(e); }
  }
);

router.delete('/turnos/:id', authenticate, tenantContext, tenantIsolation, requirePermission('config.sistema'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await cierreCajaService.eliminarTurno(Number(req.params.id));
      res.json(successResponse(null, 'Turno eliminado'));
    } catch (e) { next(e); }
  }
);

// ── Cierres ───────────────────────────────────────────────────────────────────

router.get('/cierres', authenticate, tenantContextOptional,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, id_usuario, estado, fecha_desde, fecha_hasta, id_restaurante } = req.query as Record<string, string>;

      // Parsear y validar fechas antes de llegar a Prisma
      let parsedDesde: Date | undefined;
      let parsedHasta: Date | undefined;
      if (fecha_desde) {
        parsedDesde = new Date(fecha_desde);
        if (isNaN(parsedDesde.getTime())) {
          res.status(400).json({ success: false, error: 'fecha_desde debe ser una fecha ISO válida' }); return;
        }
      }
      if (fecha_hasta) {
        parsedHasta = new Date(fecha_hasta);
        if (isNaN(parsedHasta.getTime())) {
          res.status(400).json({ success: false, error: 'fecha_hasta debe ser una fecha ISO válida' }); return;
        }
      }

      const result = await cierreCajaService.listar({
        page, limit,
        id_usuario:     id_usuario     ? Number(id_usuario)    : undefined,
        estado:         estado         ? estado as EstadoCierre : undefined,
        fecha_desde:    parsedDesde,
        fecha_hasta:    parsedHasta,
        id_restaurante: req.restauranteId ?? (id_restaurante ? Number(id_restaurante) : undefined),
      });
      res.json({ success: true, ...result });
    } catch (e) { next(e); }
  }
);

router.get('/cierres/:id', authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(successResponse(await cierreCajaService.obtenerPorId(Number(req.params.id))));
    } catch (e) { next(e); }
  }
);

router.post('/cierres/iniciar', authenticate, tenantContext, tenantIsolation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id_turno, fecha_apertura, monto_inicial } = req.body;
      if (!fecha_apertura || monto_inicial === undefined) {
        res.status(400).json({ error: 'fecha_apertura y monto_inicial son requeridos' }); return;
      }
      const parsedApertura = new Date(fecha_apertura);
      if (isNaN(parsedApertura.getTime())) {
        res.status(400).json({ error: 'fecha_apertura debe ser una fecha ISO válida' }); return;
      }
      const data = await cierreCajaService.iniciarCierre({
        id_usuario:     (req as any).user.id,
        id_turno:       id_turno ? Number(id_turno) : undefined,
        fecha_apertura: parsedApertura,
        monto_inicial:  Number(monto_inicial),
        id_restaurante: req.restauranteId!,
      });
      res.status(201).json(successResponse(data, 'Cierre iniciado'));
    } catch (e) {
      if ((e as any).message?.includes('orden(es) abiertas')) {
        res.status(409).json({
          error:   (e as any).message,
          detalle: (e as any).ordenes_abiertas ?? [],
        });
        return;
      }
      next(e);
    }
  }
);

router.post('/cierres/:id/confirmar', authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { monto_final, justificacion, observaciones } = req.body;
      if (monto_final === undefined) {
        res.status(400).json({ error: 'monto_final es requerido' }); return;
      }
      const data = await cierreCajaService.confirmarCierre(Number(req.params.id), {
        monto_final: Number(monto_final),
        justificacion, observaciones,
      });
      res.json(successResponse(data, 'Cierre confirmado'));
    } catch (e) { next(e); }
  }
);

export default router;