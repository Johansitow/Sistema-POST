/**
 * Inventario Routes
 */

import { Router } from 'express';
import {
  getMovimientos, registrarMovimiento, getEstadisticas, getLotesVencimiento, getValorInventario,
  getLotes, getRentabilidadLote, actualizarEstadoLote, getLotesActivosPorProducto, getVidaUtilPromedio,
} from '../controller/inventario.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { tenantContext } from '../middlewares/tenantContext.middleware';
import { tenantIsolation } from '../middlewares/tenantIsolation.middleware';

const router = Router();

router.use(authenticate, tenantContext, tenantIsolation);

router.get('/movimientos',         getMovimientos);
router.post('/movimientos',        registrarMovimiento);
router.get('/movimientos/stats',   getEstadisticas);
router.get('/lotes',                    getLotes);
router.get('/lotes/vencimiento',        getLotesVencimiento);
router.get('/lotes/vida-util-promedio', getVidaUtilPromedio);
router.get('/lotes/:id/rentabilidad',   getRentabilidadLote);
router.patch('/lotes/:id',              actualizarEstadoLote);
router.get('/productos/:id_producto/lotes-activos', getLotesActivosPorProducto);
router.get('/valor',               getValorInventario);

export default router;
