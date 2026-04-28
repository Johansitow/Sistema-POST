/**
 * GrupoNegocio Routes — /api/v1/grupos
 * Solo accesible por super admin.
 */

import { Router, Request, Response } from 'express';
import { z }                         from 'zod';
import { PlanSaaS }                  from '@prisma/client';
import { authenticate, requireSuperAdmin } from '../middlewares/auth.middleware';
import { grupoNegocioService }        from '../services/grupo-negocio.service';
import { successResponse }            from '../lib/response';
import { asyncHandler }               from '../middlewares/error.middleware';
import prisma                         from '../config/database';

const router = Router();

// Todos los endpoints requieren autenticación + super admin
router.use(authenticate, requireSuperAdmin);

// ── Schemas de validación ──────────────────────────────────────────────────────

const crearSchema = z.object({
  nombre:                 z.string().min(2).max(200),
  nit:                    z.string().max(50).optional(),
  logo_url:               z.string().url().optional(),
  plan:                   z.nativeEnum(PlanSaaS).optional(),
  plan_max_restaurantes:  z.number().int().min(1).max(100).optional(),
});

const actualizarSchema = crearSchema.partial().extend({
  activo: z.boolean().optional(),
});

const miembroSchema = z.object({
  id_usuario:   z.number().int().positive(),
  rol_en_grupo: z.enum(['owner', 'admin', 'operador']).default('operador'),
});

// ── Listar grupos ──────────────────────────────────────────────────────────────

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const result = await grupoNegocioService.listar({
    page:   req.query.page,
    limit:  req.query.limit,
    activo: req.query.activo !== undefined ? req.query.activo === 'true' : undefined,
    plan:   req.query.plan as PlanSaaS | undefined,
  });
  res.json(successResponse(result));
}));

// ── Obtener grupo por ID ───────────────────────────────────────────────────────

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const grupo = await grupoNegocioService.obtenerPorId(Number(req.params.id));
  res.json(successResponse(grupo));
}));

// ── Crear grupo ────────────────────────────────────────────────────────────────

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const data  = crearSchema.parse(req.body);
  const grupo = await grupoNegocioService.crear(data);
  res.status(201).json(successResponse(grupo, 'Grupo de negocio creado'));
}));

// ── Actualizar grupo ───────────────────────────────────────────────────────────

router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const data  = actualizarSchema.parse(req.body);
  const grupo = await grupoNegocioService.actualizar(Number(req.params.id), data);
  res.json(successResponse(grupo, 'Grupo actualizado'));
}));

// ── Miembros del grupo ─────────────────────────────────────────────────────────

router.get('/:id/miembros', asyncHandler(async (req: Request, res: Response) => {
  const miembros = await grupoNegocioService.listarMiembros(Number(req.params.id));
  res.json(successResponse(miembros));
}));

router.post('/:id/miembros', asyncHandler(async (req: Request, res: Response) => {
  const { id_usuario, rol_en_grupo } = miembroSchema.parse(req.body);
  const miembro = await grupoNegocioService.asignarMiembro(
    Number(req.params.id), id_usuario, rol_en_grupo
  );
  res.status(201).json(successResponse(miembro, 'Miembro asignado al grupo'));
}));

router.delete('/:id/miembros/:id_usuario', asyncHandler(async (req: Request, res: Response) => {
  await grupoNegocioService.removerMiembro(
    Number(req.params.id), Number(req.params.id_usuario)
  );
  res.json(successResponse(null, 'Miembro removido del grupo'));
}));

// ── Dashboard consolidado del grupo ───────────────────────────────────────────
// Retorna métricas agregadas de TODOS los restaurantes del grupo,
// más el desglose individual por sede. Solo super admin.

router.get('/:id/dashboard', asyncHandler(async (req: Request, res: Response) => {
  const id_grupo = Number(req.params.id);
  await grupoNegocioService.obtenerPorId(id_grupo); // valida que el grupo existe

  const hoy     = new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana  = new Date(hoy);
  manana.setDate(manana.getDate() + 1);
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  // Restaurantes del grupo
  const restaurantes = await prisma.restaurante.findMany({
    where: { id_grupo, activo: true },
    select: { id: true, nombre: true, ciudad: true, tipo_tenant: true },
    orderBy: { nombre: 'asc' },
  });

  // Métricas por restaurante en paralelo
  const metricas = await Promise.all(
    restaurantes.map(async r => {
      const [ventasHoy, ventasMes, ordenesActivas, alertasStock] = await Promise.all([
        // Ventas del día
        prisma.orden.aggregate({
          _sum: { total: true },
          _count: { id: true },
          where: { id_restaurante: r.id, fecha_apertura: { gte: hoy, lt: manana } },
        }),
        // Ventas del mes
        prisma.orden.aggregate({
          _sum: { total: true },
          _count: { id: true },
          where: { id_restaurante: r.id, fecha_apertura: { gte: inicioMes } },
        }),
        // Órdenes sin cerrar (no tienen estado completado/cancelado)
        prisma.orden.count({
          where: {
            id_restaurante: r.id,
            estado: { codigo: { notIn: ['completado', 'cancelado', 'cerrado'] } },
          },
        }),
        // Alertas de stock crítico (stock_actual <= stock_minimo) — comparación en memoria
        prisma.productoStock.findMany({
          where: { id_restaurante: r.id, activo: true },
          select: { stock_actual: true, stock_minimo: true },
        }).then(ss => ss.filter(s => Number(s.stock_actual) <= Number(s.stock_minimo)).length)
          .catch(() => 0),
      ]);

      return {
        restaurante: r,
        ventas_hoy:       Number(ventasHoy._sum.total  ?? 0),
        ordenes_hoy:      ventasHoy._count.id,
        ventas_mes:       Number(ventasMes._sum.total  ?? 0),
        ordenes_mes:      ventasMes._count.id,
        ordenes_activas:  ordenesActivas,
        alertas_stock:    alertasStock as number,
      };
    })
  );

  // Totales consolidados
  const totales = metricas.reduce(
    (acc, m) => ({
      ventas_hoy:      acc.ventas_hoy      + m.ventas_hoy,
      ordenes_hoy:     acc.ordenes_hoy     + m.ordenes_hoy,
      ventas_mes:      acc.ventas_mes      + m.ventas_mes,
      ordenes_mes:     acc.ordenes_mes     + m.ordenes_mes,
      ordenes_activas: acc.ordenes_activas + m.ordenes_activas,
      alertas_stock:   acc.alertas_stock   + m.alertas_stock,
    }),
    { ventas_hoy: 0, ordenes_hoy: 0, ventas_mes: 0, ordenes_mes: 0, ordenes_activas: 0, alertas_stock: 0 }
  );

  res.json(successResponse({ restaurantes: metricas, totales }));
}));

export default router;
