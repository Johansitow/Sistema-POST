/**
 * UsuariosService - Frontend
 *
 * Estructura de respuestas del backend:
 * - GET  /usuarios          → { data: [...], meta: {...} }  (paginado)
 * - GET  /usuarios/:id      → { usuario: {...} }
 * - POST /usuarios          → { message, usuario }
 * - PUT  /usuarios/:id      → { message, usuario }
 * - GET  /usuarios/roles    → { roles: [...] }
 * - GET  /usuarios/estadisticas → { stats: { total, activos, inactivos } }
 */

import api from './api';
import type {
  CreateUsuarioDto, UpdateUsuarioDto, NominaDto, NominaEmpleado, HistorialSalario,
} from '../types';

export const usuariosService = {

  /**
   * listar — respuesta paginada { data, meta }
   * Se devuelve completa para que el componente acceda a meta.total
   */
  async listar(params?: {
    page?: number; limit?: number;
    search?: string; estado?: string; id_rol?: number;
  }) {
    const res = await api.get('/usuarios', { params });
    // res.data = { data: Usuario[], meta: { total, page, limit, totalPages } }
    return res.data;
  },

  /**
   * obtenerPorId — respuesta envuelta { usuario: {...} }
   */
  async obtenerPorId(id: number) {
    const res = await api.get(`/usuarios/${id}`);
    return res.data.usuario; // ← antes: res.data.data (incorrecto)
  },

  /**
   * crear — respuesta envuelta { message, usuario }
   */
  async crear(data: CreateUsuarioDto) {
    const res = await api.post('/usuarios', data);
    return res.data.usuario; // ← antes: res.data.data (incorrecto)
  },

  /**
   * actualizar — respuesta envuelta { message, usuario }
   */
  async actualizar(id: number, data: UpdateUsuarioDto) {
    const res = await api.put(`/usuarios/${id}`, data);
    return res.data.usuario; // ← antes: res.data.data (incorrecto)
  },

  /**
   * cambiarEstado — respuesta envuelta { message, usuario }
   */
  async cambiarEstado(id: number, estado: 'activo' | 'inactivo') {
    const res = await api.patch(`/usuarios/${id}/estado`, { estado });
    return res.data.usuario; // ← antes: res.data.data (incorrecto)
  },

  /**
   * resetPassword — respuesta { message }
   *
   * La ruta es /reset-password (antes se llamaba a /password, que no existe
   * en el backend: el botón del panel devolvía 404).
   */
  async resetPassword(id: number, password: string) {
    const res = await api.patch(`/usuarios/${id}/reset-password`, { newPassword: password });
    // ← nota: el backend espera 'newPassword' no 'password'
    return res.data;
  },

  /**
   * estadisticas — respuesta envuelta { stats: { total, activos, inactivos } }
   */
  async estadisticas(): Promise<{ total: number; activos: number; inactivos: number }> {
    const res = await api.get('/usuarios/estadisticas');
    return res.data.stats; // ← antes: res.data.data (incorrecto)
  },

  /**
   * asignarRol — respuesta envuelta { message, usuario }
   */
  async asignarRol(id: number, id_rol: number) {
    const res = await api.patch(`/usuarios/${id}/rol`, { id_rol });
    return res.data.usuario; // ← antes: res.data.data (incorrecto)
  },

  /**
   * listarRoles — respuesta envuelta { roles: [...] }
   */
  async listarRoles() {
    const res = await api.get('/usuarios/roles');
    return res.data.roles;
  },

  /**
   * getNomina — respuesta { nomina: NominaEmpleado | null }
   */
  async getNomina(id: number): Promise<NominaEmpleado | null> {
    const res = await api.get(`/usuarios/${id}/nomina`);
    return res.data.nomina ?? null;
  },

  /**
   * guardarNomina — crea o actualiza la nómina del empleado
   */
  async guardarNomina(id: number, data: NominaDto): Promise<NominaEmpleado> {
    const res = await api.put(`/usuarios/${id}/nomina`, data);
    return res.data.nomina;
  },

  /**
   * historialSalarios — trazabilidad de cambios de salario del empleado.
   * Es solo lectura: el backend escribe el historial automáticamente al
   * guardar la nómina.
   */
  async historialSalarios(id: number): Promise<HistorialSalario[]> {
    const res = await api.get(`/usuarios/${id}/historial-salarios`);
    return res.data.historial ?? [];
  },
};