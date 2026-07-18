/**
 * UI Config Routes — Configuraciones dinámicas de interfaz
 */

import { Router } from 'express';
import { authenticate, requireSuperAdmin } from '../middlewares/auth.middleware';
import { getAll, getByScope, getConfig, setConfig, deleteConfig, getPublicBranding } from '../controller/uiConfiguracion.controller';

const router = Router();

// Pública — registrada antes de `authenticate` a propósito: el login la necesita sin sesión.
router.get('/public/branding', getPublicBranding);

router.use(authenticate);

/**
 * @openapi
 * /ui-config:
 *   get:
 *     tags: [UI Config]
 *     summary: Obtener todas las configuraciones UI (superadmin)
 *     responses:
 *       200:
 *         description: Lista completa de configuraciones
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/UiConfiguracion' }
 *       403: { description: Acceso denegado }
 *
 * /ui-config/{scope}:
 *   get:
 *     tags: [UI Config]
 *     summary: Obtener todas las configuraciones de un scope
 *     parameters:
 *       - in: path
 *         name: scope
 *         required: true
 *         schema: { type: string }
 *         description: "Ej: theme, layout, notifications"
 *     responses:
 *       200:
 *         description: Configuraciones del scope
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/UiConfiguracion' }
 *
 * /ui-config/{scope}/{clave}:
 *   get:
 *     tags: [UI Config]
 *     summary: Obtener una configuración específica
 *     parameters:
 *       - in: path
 *         name: scope
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: clave
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: contexto
 *         schema: { type: string }
 *         description: Contexto opcional para configs multi-tenant
 *     responses:
 *       200:
 *         description: Configuración encontrada (null si no existe)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   oneOf:
 *                     - { $ref: '#/components/schemas/UiConfiguracion' }
 *                     - { type: 'null' }
 *
 *   put:
 *     tags: [UI Config]
 *     summary: Crear o actualizar configuración (superadmin)
 *     parameters:
 *       - in: path
 *         name: scope
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: clave
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [valor]
 *             properties:
 *               valor:    { description: 'Cualquier valor JSON' }
 *               contexto: { type: string, example: restaurante_1 }
 *     responses:
 *       200:
 *         description: Configuración guardada (upsert)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/UiConfiguracion' }
 *                 message: { type: string }
 *
 * /ui-config/{id}:
 *   delete:
 *     tags: [UI Config]
 *     summary: Eliminar configuración por ID (superadmin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Eliminada }
 *       400: { description: ID inválido }
 *       404: { description: No encontrada }
 */
router.get('/',              requireSuperAdmin, getAll);
router.get('/:scope',        getByScope);
router.get('/:scope/:clave', getConfig);
router.put('/:scope/:clave', requireSuperAdmin, setConfig);
router.delete('/:id',        requireSuperAdmin, deleteConfig);

export default router;
