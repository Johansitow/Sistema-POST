/**
 * Plantillas de Impresión Routes
 */

import { Router } from 'express';
import { getAll, getById, getDefault, create, update, remove } from '../controller/plantillas.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { tenantContext, tenantContextOptional } from '../middlewares/tenantContext.middleware';
import { tenantIsolation } from '../middlewares/tenantIsolation.middleware';

const router = Router();

router.use(authenticate);

/**
 * @openapi
 * /plantillas:
 *   get:
 *     tags: [Plantillas]
 *     summary: Listar plantillas de impresión
 *     parameters:
 *       - in: query
 *         name: tipo
 *         schema: { type: string, enum: [ticket, factura, comanda] }
 *         description: Filtrar por tipo de plantilla
 *     responses:
 *       200:
 *         description: Lista de plantillas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/PlantillaImpresion' }
 *
 *   post:
 *     tags: [Plantillas]
 *     summary: Crear plantilla de impresión
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PlantillaCreate' }
 *     responses:
 *       201:
 *         description: Plantilla creada (si es_default=true quita el default anterior de forma atómica)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/PlantillaImpresion' }
 *       409: { description: Tipo de plantilla inválido }
 *
 * /plantillas/default/{tipo}:
 *   get:
 *     tags: [Plantillas]
 *     summary: Obtener plantilla por defecto para un tipo
 *     parameters:
 *       - in: path
 *         name: tipo
 *         required: true
 *         schema: { type: string, enum: [ticket, factura, comanda] }
 *     responses:
 *       200:
 *         description: Plantilla por defecto (null si no existe)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   oneOf:
 *                     - { $ref: '#/components/schemas/PlantillaImpresion' }
 *                     - { type: 'null' }
 *
 * /plantillas/{id}:
 *   get:
 *     tags: [Plantillas]
 *     summary: Obtener plantilla por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Plantilla encontrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/PlantillaImpresion' }
 *       404: { description: No encontrada o eliminada }
 *
 *   put:
 *     tags: [Plantillas]
 *     summary: Actualizar plantilla
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PlantillaCreate' }
 *     responses:
 *       200: { description: Plantilla actualizada }
 *       404: { description: No encontrada }
 *       409: { description: Tipo inválido }
 *
 *   delete:
 *     tags: [Plantillas]
 *     summary: Soft-delete de plantilla
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Eliminada }
 *       404: { description: No encontrada }
 */
router.get('/',              tenantContextOptional, getAll);
router.get('/default/:tipo', tenantContextOptional, getDefault);
router.get('/:id',           tenantContextOptional, getById);
router.post('/',             tenantContext, tenantIsolation, create);
router.put('/:id',           tenantContext, tenantIsolation, update);
router.delete('/:id',        tenantContext, tenantIsolation, remove);

export default router;
