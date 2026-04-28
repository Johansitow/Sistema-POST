/**
 * Reportes Routes
 *
 * Rutas individuales (por restaurante):
 *   GET /reportes/ventas
 *   GET /reportes/productos
 *   GET /reportes/categorias
 *   GET /reportes/metodos-pago
 *   GET /reportes/horas
 *   GET /reportes/completo
 *   GET /reportes/merma/valor
 *   GET /reportes/tendencias/consumo
 *   GET /reportes/clientes/top
 *   GET /reportes/lotes/por-vencer
 *
 * Rutas consolidadas por grupo (requieren membresía al grupo):
 *   GET /reportes/consolidado/:id_grupo              → reporte completo del grupo
 *   GET /reportes/consolidado/:id_grupo/ventas       → ventas desglosadas por sede + periodo
 *   GET /reportes/consolidado/:id_grupo/productos    → top productos del grupo
 *   GET /reportes/consolidado/:id_grupo/pagos        → métodos de pago del grupo
 *   GET /reportes/consolidado/:id_grupo/clientes     → top clientes del grupo
 */

import { Router } from 'express';
import {
  getVentas, getProductosMasVendidos, getVentasPorCategoria,
  getMetodosPago, getVentasPorHora, getReporteCompleto,
  getValorMerma, getTendenciasConsumo, getTopClientes, getLotesPorVencer,
  // Consolidados por grupo
  getConsolidadoGrupo, getVentasGrupo, getProductosGrupo,
  getPagosGrupo, getClientesGrupo,
  // Super admin — todos los grupos
  getSuperConsolidado,
} from '../controller/reportes.controller';
import { authenticate, requireSuperAdmin } from '../middlewares/auth.middleware';
import { tenantContext, tenantContextOptional } from '../middlewares/tenantContext.middleware';
import { tenantIsolation } from '../middlewares/tenantIsolation.middleware';
import { requireGrupoMember } from '../middlewares/grupoMember.middleware';

const router = Router();

// ─── Rutas individuales (requieren contexto de restaurante) ───────────────────
router.use(authenticate);

const individualRouter = Router();
individualRouter.use(tenantContext, tenantIsolation);

individualRouter.get('/ventas',             getVentas);
individualRouter.get('/productos',          getProductosMasVendidos);
individualRouter.get('/categorias',         getVentasPorCategoria);
individualRouter.get('/metodos-pago',       getMetodosPago);
individualRouter.get('/horas',              getVentasPorHora);
individualRouter.get('/completo',           getReporteCompleto);
individualRouter.get('/merma/valor',        getValorMerma);
individualRouter.get('/tendencias/consumo', getTendenciasConsumo);
individualRouter.get('/clientes/top',       getTopClientes);
individualRouter.get('/lotes/por-vencer',   getLotesPorVencer);

router.use(individualRouter);

// ─── Ruta super-consolidado (solo super admin) ───────────────────────────────
// No requiere tenant ni grupo: el SA ve TODOS los grupos del sistema.
router.get('/super-consolidado', requireSuperAdmin, getSuperConsolidado);

// ─── Rutas consolidadas por grupo ────────────────────────────────────────────
// tenantContextOptional — la ruta es de grupo, no requiere X-Restaurante-Id
// requireGrupoMember    — verifica que req.user pertenezca al grupo solicitado
const grupoRouter = Router({ mergeParams: true });
grupoRouter.use(tenantContextOptional, requireGrupoMember);

grupoRouter.get('/',          getConsolidadoGrupo);
grupoRouter.get('/ventas',    getVentasGrupo);
grupoRouter.get('/productos', getProductosGrupo);
grupoRouter.get('/pagos',     getPagosGrupo);
grupoRouter.get('/clientes',  getClientesGrupo);

router.use('/consolidado/:id_grupo', grupoRouter);

export default router;
