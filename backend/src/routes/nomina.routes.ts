/**
 * Nomina Routes
 *
 * Todo el módulo exige el permiso de gestión de personal: quien administra
 * empleados es quien liquida su nómina. Los parámetros legales van un escalón
 * más arriba (solo superadmin), porque un error ahí afecta a todos los grupos.
 */

import { Router } from 'express';
import {
  listarParametros, obtenerParametros, guardarParametros, verificarParametros,
  listarPeriodos, obtenerPeriodo, crearPeriodo, prenomina,
  liquidar, aprobar, marcarPagado, reabrir,
  listarNovedades, crearNovedad, eliminarNovedad,
  listarDetalles, obtenerDetalle, costoLaboral, simularCosto,
  soloSuperAdmin,
} from '../controller/nomina.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdminAccess } from '../middlewares/adminAccess.middleware';
import { tenantContextOptional } from '../middlewares/tenantContext.middleware';

const router = Router();

router.use(authenticate, tenantContextOptional, requireAdminAccess('usuarios.gestionar'));

// ── Parámetros legales ────────────────────────────────────────────────────────
router.get('/parametros',            listarParametros);
router.get('/parametros/:anio',      obtenerParametros);
router.put('/parametros/:anio',      soloSuperAdmin, guardarParametros);
router.patch('/parametros/:anio/verificar', soloSuperAdmin, verificarParametros);

// ── Simulador de costo ────────────────────────────────────────────────────────
router.post('/simular-costo', simularCosto);

// ── Periodos ──────────────────────────────────────────────────────────────────
router.get('/periodos',      listarPeriodos);
router.post('/periodos',     crearPeriodo);
router.get('/periodos/:id',  obtenerPeriodo);

// Ciclo de vida
router.get('/periodos/:id/prenomina',     prenomina);
router.post('/periodos/:id/liquidar',     liquidar);
router.post('/periodos/:id/aprobar',      aprobar);
router.post('/periodos/:id/pagar',        marcarPagado);
router.post('/periodos/:id/reabrir',      reabrir);

// Novedades
router.get('/periodos/:id/novedades',                 listarNovedades);
router.post('/periodos/:id/novedades',                crearNovedad);
router.delete('/periodos/:id/novedades/:idNovedad',   eliminarNovedad);

// Resultados
router.get('/periodos/:id/detalles',              listarDetalles);
router.get('/periodos/:id/detalles/:idEmpleado',  obtenerDetalle);
router.get('/periodos/:id/costo-laboral',         costoLaboral);

export default router;
