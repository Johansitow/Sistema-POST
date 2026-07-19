/**
 * MiGrupoService — administración del grupo por su owner/admin
 *
 * Panel "Mi Grupo": el dueño del grupo de restaurantes gestiona sus sedes y
 * qué usuarios acceden a cada una, sin ser superadmin.
 *
 * Reglas de seguridad:
 * - Toda operación recibe el id_grupo YA resuelto por requireGrupoAdmin.
 * - Anti-IDOR: una sede de otro grupo produce NotFoundError (mismo error que
 *   "no existe", igual que TenantRepository).
 * - Solo se pueden vincular a sedes usuarios que ya son miembros del grupo
 *   (UsuarioGrupo). Crear usuarios sigue siendo tarea del superadmin.
 * - La edición de sedes usa whitelist: nunca id_grupo, es_default, tipo_tenant
 *   ni config (escalación de privilegios / romper aislamiento).
 */

import { restauranteService } from './restaurante.service';
import { grupoNegocioService } from './grupo-negocio.service';
import { restauranteRepository } from '../repositories/restaurante.repository';
import { grupoNegocioRepository } from '../repositories/grupo-negocio.repository';
import { NotFoundError, BadRequestError } from '../exceptions/HttpErrors';

/** Campos de sede editables por un admin de grupo */
export type SedeUpdateData = Partial<{
  nombre:       string;
  descripcion:  string;
  logo_url:     string;
  direccion:    string;
  ciudad:       string;
  telefono:     string;
  email:        string;
  zona_horaria: string;
  moneda:       string;
  activo:       boolean;
}>;

/** Valida que la sede exista Y pertenezca al grupo administrado (anti-IDOR). */
async function assertSedeDelGrupo(id_restaurante: number, id_grupo: number) {
  const sede = await restauranteService.obtenerPorId(id_restaurante);
  if (sede.id_grupo !== id_grupo) {
    console.warn(`[MiGrupo] intento de acceso cross-grupo: sede=${id_restaurante} grupo=${id_grupo}`);
    throw new NotFoundError('Restaurante');
  }
  return sede;
}

export const miGrupoService = {

  /** Resumen del grupo: datos públicos + todas sus sedes (incluye inactivas). */
  async resumen(id_grupo: number) {
    const [grupo, restaurantes] = await Promise.all([
      grupoNegocioService.obtenerPorId(id_grupo),
      restauranteRepository.findByGrupo(id_grupo),
    ]);
    return {
      grupo: {
        id:                    grupo.id,
        nombre:                grupo.nombre,
        nit:                   grupo.nit,
        logo_url:              grupo.logo_url,
        plan:                  grupo.plan,
        plan_max_restaurantes: grupo.plan_max_restaurantes,
        activo:                grupo.activo,
      },
      restaurantes,
    };
  },

  /** Miembros del grupo (candidatos a vincular a sedes). */
  async miembros(id_grupo: number) {
    return grupoNegocioService.listarMiembros(id_grupo);
  },

  /** Usuarios con acceso a una sede del grupo. */
  async usuariosDeSede(id_grupo: number, id_restaurante: number) {
    await assertSedeDelGrupo(id_restaurante, id_grupo);
    return restauranteService.listarUsuarios(id_restaurante);
  },

  /** Vincula un miembro del grupo a una sede. */
  async asignarUsuario(id_grupo: number, id_restaurante: number, id_usuario: number) {
    await assertSedeDelGrupo(id_restaurante, id_grupo);
    const miembro = await grupoNegocioRepository.findMiembro(id_usuario, id_grupo);
    if (!miembro) {
      throw new BadRequestError(
        'El usuario no es miembro del grupo. Pide al superadmin que lo agregue al grupo primero.'
      );
    }
    return restauranteService.asignarUsuario(id_restaurante, id_usuario);
  },

  /** Desvincula un usuario de una sede del grupo. */
  async removerUsuario(id_grupo: number, id_restaurante: number, id_usuario: number) {
    await assertSedeDelGrupo(id_restaurante, id_grupo);
    return restauranteService.removerUsuario(id_restaurante, id_usuario);
  },

  /** Edita datos básicos de una sede del grupo (whitelist en el DTO de la ruta). */
  async actualizarSede(id_grupo: number, id_restaurante: number, data: SedeUpdateData) {
    await assertSedeDelGrupo(id_restaurante, id_grupo);
    return restauranteService.actualizar(id_restaurante, data);
  },
};
