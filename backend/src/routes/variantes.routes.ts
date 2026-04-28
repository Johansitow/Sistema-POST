/**
 * Variantes Routes — bajo /productos/:productoId/variantes
 */

import { Router } from 'express';
import { getAll, getById, create, update, remove, reorder } from '../controller/variantes.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';
import { tenantContextOptional } from '../middlewares/tenantContext.middleware';
import { tenantIsolation } from '../middlewares/tenantIsolation.middleware';

const router = Router({ mergeParams: true });

router.use(authenticate, tenantContextOptional, tenantIsolation);

/**
 * @openapi
 * /productos/{productoId}/variantes:
 *   get:
 *     tags: [Variantes]
 *     summary: Listar variantes de un producto
 *     parameters:
 *       - in: path
 *         name: productoId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de variantes activas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ProductoVariante' }
 *       401: { description: No autenticado }
 *
 *   post:
 *     tags: [Variantes]
 *     summary: Crear variante (requiere productos.crear)
 *     parameters:
 *       - in: path
 *         name: productoId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/VarianteCreate' }
 *     responses:
 *       201:
 *         description: Variante creada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/ProductoVariante' }
 *       404: { description: Producto no encontrado }
 *       409: { description: SKU duplicado }
 *
 * /productos/{productoId}/variantes/{id}:
 *   get:
 *     tags: [Variantes]
 *     summary: Obtener variante por ID
 *     parameters:
 *       - in: path
 *         name: productoId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Variante encontrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/ProductoVariante' }
 *       404: { description: No encontrada }
 *
 *   put:
 *     tags: [Variantes]
 *     summary: Actualizar variante (requiere productos.editar)
 *     parameters:
 *       - in: path
 *         name: productoId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/VarianteUpdate' }
 *     responses:
 *       200: { description: Variante actualizada }
 *       404: { description: No encontrada }
 *       409: { description: SKU en uso por otra variante }
 *
 *   delete:
 *     tags: [Variantes]
 *     summary: Soft-delete de variante (requiere productos.eliminar)
 *     parameters:
 *       - in: path
 *         name: productoId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Variante eliminada }
 *       404: { description: No encontrada }
 *
 * /productos/{productoId}/variantes/reorder:
 *   patch:
 *     tags: [Variantes]
 *     summary: Reordenar variantes (requiere productos.editar)
 *     parameters:
 *       - in: path
 *         name: productoId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 items: { $ref: '#/components/schemas/ReordenarItem' }
 *     responses:
 *       200: { description: Orden actualizado }
 *       400: { description: IDs inválidos, orden duplicado o lista incompleta }
 */
router.get('/',                    getAll);
router.get('/:id',                 getById);
router.post('/',    requirePermission('productos.crear'),   create);
router.put('/:id',  requirePermission('productos.editar'),  update);
router.delete('/:id', requirePermission('productos.eliminar'), remove);
router.patch('/reorder', requirePermission('productos.editar'), reorder);

export default router;
