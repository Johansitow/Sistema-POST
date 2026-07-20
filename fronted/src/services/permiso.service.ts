/**
 * PermisoService - Frontend
 *
 * Endpoints del backend (bajo /configuracion/permisos):
 *   GET    /configuracion/permisos                  → listar todos
 *   GET    /configuracion/permisos/rol/:id_rol       → permisos de un rol
 *   POST   /configuracion/permisos/rol/:id_rol       → asignar permiso a rol
 *   DELETE /configuracion/permisos/rol/:id/:permiso  → revocar permiso
 *   PUT    /configuracion/permisos/rol/:id/sync      → sincronizar todos
 *
 * Requieren: superadmin, o admin de grupo con permiso permisos.gestionar.
 * Respuesta estándar: { success: true, data: [...] }
 *
 * Permisos por administrador de grupo (SOLO superadmin, bajo /usuarios):
 *   GET /usuarios/admins-grupo     → owners/admins de grupos
 *   GET /usuarios/:id/permisos     → permisos directos (UsuarioPermiso)
 *   PUT /usuarios/:id/permisos     → sincronizar permisos directos
 */

import api from './api';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface Permiso {
  id:             number;
  nombre:         string;
  codigo:         string;
  modulo:         string;
  descripcion?:   string;
  es_sistema:     boolean;
  fecha_creacion: string;
  _count?: { roles: number };
  roles?: Array<{
    id:     number;
    id_rol: number;
    rol:    { id: number; nombre: string; color?: string };
  }>;
}

export interface RolPermiso {
  id:               number;
  id_rol:           number;
  id_permiso:       number;
  permiso:          Permiso;
  fecha_asignacion: string;
}

export interface PermisoCreateDTO {
  nombre:       string;
  codigo:       string;
  modulo:       string;
  descripcion?: string;
  es_sistema?:  boolean;
}

export interface PermisoUpdateDTO {
  nombre?:      string;
  descripcion?: string;
  modulo?:      string;
}

export interface PermisosParams {
  modulo?:     string;
  es_sistema?: boolean;
}

/** Usuario owner/admin de algún grupo — candidato a permisos de administración */
export interface AdminDeGrupo {
  id:              number;
  uuid:            string;
  nombre_completo: string;
  email:           string;
  usuario:         string;
  estado:          string;
  grupos: Array<{
    id_grupo:     number;
    rol_en_grupo: string;
    grupo:        { nombre: string };
  }>;
}

// ─── Base path ────────────────────────────────────────────────────────────────

const BASE = '/configuracion/permisos';

// ─── Servicio ─────────────────────────────────────────────────────────────────

class PermisoServiceFrontend {

  // ── Permisos ──────────────────────────────────────────────────────────────

  /**
   * getAll — lista todos los permisos con filtros opcionales.
   * Respuesta del backend: { success: true, data: Permiso[] }
   */
  async getAll(params: PermisosParams = {}): Promise<Permiso[]> {
    try {
      const res = await api.get(BASE, { params });
      return res.data.data ?? [];
    } catch (error) {
      console.error('Error al obtener permisos:', error);
      throw this.handleError(error);
    }
  }

  /**
   * getByRol — permisos actualmente asignados a un rol específico.
   * Respuesta del backend: { success: true, data: RolPermiso[] }
   */
  async getByRol(id_rol: number): Promise<RolPermiso[]> {
    try {
      const res = await api.get(`${BASE}/rol/${id_rol}`);
      return res.data.data ?? [];
    } catch (error) {
      console.error(`Error al obtener permisos del rol ${id_rol}:`, error);
      throw this.handleError(error);
    }
  }

  /**
   * asignar — asigna un permiso individual a un rol.
   * Respuesta del backend: { success: true, data: RolPermiso }
   */
  async asignar(id_rol: number, id_permiso: number): Promise<RolPermiso> {
    try {
      const res = await api.post(`${BASE}/rol/${id_rol}`, { id_permiso });
      return res.data.data;
    } catch (error) {
      console.error(`Error al asignar permiso ${id_permiso} al rol ${id_rol}:`, error);
      throw this.handleError(error);
    }
  }

  /**
   * revocar — revoca un permiso específico de un rol.
   * Respuesta del backend: { success: true, data: null }
   */
  async revocar(id_rol: number, id_permiso: number): Promise<void> {
    try {
      await api.delete(`${BASE}/rol/${id_rol}/${id_permiso}`);
    } catch (error) {
      console.error(`Error al revocar permiso ${id_permiso} del rol ${id_rol}:`, error);
      throw this.handleError(error);
    }
  }

  /**
   * sincronizar — reemplaza TODOS los permisos del rol con los ids enviados.
   * Respuesta del backend: { success: true, data: RolPermiso[] }
   */
  async sincronizar(id_rol: number, ids_permisos: number[]): Promise<RolPermiso[]> {
    try {
      const res = await api.put(`${BASE}/rol/${id_rol}/sync`, { ids_permisos });
      return res.data.data ?? [];
    } catch (error) {
      console.error(`Error al sincronizar permisos del rol ${id_rol}:`, error);
      throw this.handleError(error);
    }
  }

  // ── Permisos por administrador de grupo (solo superadmin) ─────────────────

  /** Lista los usuarios que son owner/admin de algún grupo de negocio */
  async getAdminsGrupo(): Promise<AdminDeGrupo[]> {
    try {
      const res = await api.get('/usuarios/admins-grupo');
      return res.data.admins ?? [];
    } catch (error) {
      console.error('Error al obtener administradores de grupo:', error);
      throw this.handleError(error);
    }
  }

  /** Permisos directos (UsuarioPermiso) de un usuario */
  async getPermisosUsuario(id_usuario: number): Promise<Permiso[]> {
    try {
      const res = await api.get(`/usuarios/${id_usuario}/permisos`);
      return res.data.permisos ?? [];
    } catch (error) {
      console.error(`Error al obtener permisos del usuario ${id_usuario}:`, error);
      throw this.handleError(error);
    }
  }

  /** Reemplaza los permisos directos del usuario con los ids enviados */
  async sincronizarPermisosUsuario(id_usuario: number, ids_permisos: number[]): Promise<Permiso[]> {
    try {
      const res = await api.put(`/usuarios/${id_usuario}/permisos`, { ids_permisos });
      return res.data.permisos ?? [];
    } catch (error) {
      console.error(`Error al sincronizar permisos del usuario ${id_usuario}:`, error);
      throw this.handleError(error);
    }
  }

  // ── Helper privado ───────────────────────────────────────────────────────

  private handleError(error: any): Error {
    if (error.response) {
      const data = error.response.data;
      return new Error(data?.error || data?.message || 'Error en el servidor');
    } else if (error.request) {
      return new Error('No se pudo conectar con el servidor. Verifique su conexión.');
    }
    return error instanceof Error ? error : new Error('Error desconocido');
  }
}

export const permisoService = new PermisoServiceFrontend();
