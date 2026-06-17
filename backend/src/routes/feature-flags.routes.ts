/**
 * Feature Flags Routes
 */

import { Router } from 'express';
import {
  getAll, getById, create, update, remove,
  getClientFlags, setAsignacion, deleteAsignacion,
} from '../controller/feature-flags.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireSuperAdmin } from '../middlewares/auth.middleware';
import { tenantContextOptional } from '../middlewares/tenantContext.middleware';

const router = Router();

/**
 * @openapi
 * /feature-flags/client:
 *   get:
 *     tags: [Feature Flags]
 *     summary: Mapa nombre→boolean para el frontend (todos los usuarios autenticados)
 *     parameters:
 *       - in: query
 *         name: contexto
 *         schema: { type: string }
 *         description: Identificador de contexto para flags de scope=contexto
 *     responses:
 *       200:
 *         description: Mapa de flags
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   additionalProperties: { type: boolean }
 *                   example: { variantes_productos: true, reportes_avanzados: false }
 *       401: { description: No autenticado }
 *
 * /feature-flags:
 *   get:
 *     tags: [Feature Flags]
 *     summary: Listar todos los flags (superadmin)
 *     responses:
 *       200:
 *         description: Lista de feature flags
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/FeatureFlag' }
 *       403: { description: Acceso denegado }
 *
 *   post:
 *     tags: [Feature Flags]
 *     summary: Crear feature flag (superadmin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/FeatureFlagCreate' }
 *     responses:
 *       201:
 *         description: Flag creado. Emite evento WebSocket FEATURE_FLAG_CHANGED
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/FeatureFlag' }
 *       409: { description: El nombre ya existe }
 *
 * /feature-flags/{id}:
 *   get:
 *     tags: [Feature Flags]
 *     summary: Obtener flag por ID (superadmin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Feature flag
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/FeatureFlag' }
 *       404: { description: No encontrado }
 *
 *   put:
 *     tags: [Feature Flags]
 *     summary: Actualizar feature flag (superadmin). Emite evento WebSocket
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/FeatureFlagCreate' }
 *     responses:
 *       200: { description: Flag actualizado }
 *       404: { description: No encontrado }
 *
 *   delete:
 *     tags: [Feature Flags]
 *     summary: Eliminar feature flag (superadmin). Emite evento WebSocket
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Eliminado }
 *       404: { description: No encontrado }
 *
 * /feature-flags/{id}/asignaciones:
 *   put:
 *     tags: [Feature Flags]
 *     summary: Crear/actualizar asignación de contexto (superadmin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contexto, habilitado]
 *             properties:
 *               contexto:   { type: string, example: restaurante_1 }
 *               habilitado: { type: boolean }
 *     responses:
 *       200: { description: Asignación actualizada }
 *       404: { description: Flag no encontrado }
 *
 * /feature-flags/{id}/asignaciones/{contexto}:
 *   delete:
 *     tags: [Feature Flags]
 *     summary: Eliminar asignación de contexto (superadmin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: contexto
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Asignación eliminada }
 *       404: { description: No encontrada }
 */

// Endpoint público para el frontend (requiere auth; tenant opcional para resolver grupo)
router.get('/client', authenticate, tenantContextOptional, getClientFlags);

// Endpoints de gestión (solo superadmin)
router.use(authenticate, requireSuperAdmin);
router.get('/',    getAll);
router.get('/:id', getById);
router.post('/',   create);
router.put('/:id', update);
router.delete('/:id', remove);
router.put('/:id/asignaciones',              setAsignacion);
router.delete('/:id/asignaciones/:contexto', deleteAsignacion);

export default router;
