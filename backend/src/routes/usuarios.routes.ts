/**
 * Usuarios Routes
 */

import { Router } from 'express';
import { listar, obtener, crear, actualizar, cambiarEstado, resetPassword, asignarRol, listarRoles, estadisticas, getNomina, upsertNomina, listarAdminsDeGrupo, listarPermisosDirectos, sincronizarPermisosDirectos } from '../controller/usuarios.controller';
import { authenticate, requireSuperAdmin } from '../middlewares/auth.middleware';
import { requireAdminAccess } from '../middlewares/adminAccess.middleware';
import { tenantContextOptional } from '../middlewares/tenantContext.middleware';
import { sanitizarSuperAdminFlag, protegerSuperAdmin } from '../middlewares/superAdmin.guard';

const router = Router();

// Superadmin (acceso global) o admin de grupo con el permiso usuarios.gestionar
// (scoped: solo ve/gestiona usuarios de su propio grupo — ver grupoScope en el controller)
router.use(authenticate, tenantContextOptional, requireAdminAccess('usuarios.gestionar'));

router.get('/',                     listar);
router.get('/roles',                listarRoles);
router.get('/estadisticas',         estadisticas);

// ── Permisos directos por usuario (SOLO superadmin) ───────────────────────────
// El SA decide qué módulos del panel admin puede usar cada admin de grupo.
router.get('/admins-grupo',         requireSuperAdmin, listarAdminsDeGrupo);
router.get('/:id/permisos',         requireSuperAdmin, listarPermisosDirectos);
router.put('/:id/permisos',         requireSuperAdmin, sincronizarPermisosDirectos);

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
