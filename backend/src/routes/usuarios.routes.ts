/**
 * Usuarios Routes
 */

import { Router } from 'express';
import { listar, obtener, crear, actualizar, cambiarEstado, resetPassword, asignarRol, listarRoles, estadisticas, getNomina, upsertNomina } from '../controller/usuarios.controller';
import { authenticate, requireSuperAdmin } from '../middlewares/auth.middleware';
import { sanitizarSuperAdminFlag, protegerSuperAdmin } from '../middlewares/superAdmin.guard';

const router = Router();

// Todas requieren autenticación y ser super admin
router.use(authenticate, requireSuperAdmin);

router.get('/',                     listar);
router.get('/roles',                listarRoles);
router.get('/estadisticas',         estadisticas);
router.get('/:id',                  obtener);

// Creación: eliminar es_super_admin del body antes de llegar al controller
router.post('/',                    sanitizarSuperAdminFlag, crear);

// Actualización completa: sanitizar flag + proteger al SA de ser modificado
router.put('/:id',                  sanitizarSuperAdminFlag, protegerSuperAdmin, actualizar);

// Cambios de estado: no se puede deshabilitar/eliminar al SA
router.patch('/:id/estado',         protegerSuperAdmin, cambiarEstado);

// Reset de contraseña: el SA puede hacerlo sobre sí mismo; nadie más puede tocarlo
router.patch('/:id/reset-password', protegerSuperAdmin, resetPassword);

// Cambio de rol: el SA no tiene rol asignable (es immutable)
router.patch('/:id/rol',            protegerSuperAdmin, asignarRol);

router.get('/:id/nomina',           getNomina);
router.put('/:id/nomina',           upsertNomina);

export default router;
