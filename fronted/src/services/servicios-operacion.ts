/**
 * servicios-operacion.ts
 * Servicios frontend para módulos de operación:
 *   - configuracionService  → parámetros del sistema
 *   - turnoCajaService      → turnos de caja
 *   - cierreCajaService     → cierres de caja
 *   - recetaService         → recetas con rentabilidad
 *
 * Los métodos de permisos de configuracionService delegan
 * a permisoService para mantener compatibilidad con Configuracion.tsx.
 */

import api from './api';
import { permisoService } from './permiso.service';

// Re-exportar tipos de permiso para que Configuracion.tsx siga importando desde aquí
export type { Permiso, RolPermiso } from './permiso.service';

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────

export interface Configuracion {
  id:            number;
  clave:         string;
  valor:         string;
  valor_parseado?: string | number | boolean | object;
  tipo_dato:     'string' | 'number' | 'boolean' | 'json';
  descripcion?:  string;
  categoria:     string;
  es_editable:   boolean;
}

class ConfiguracionServiceFrontend {

  async getAll(categoria?: string): Promise<Configuracion[]> {
    const res = await api.get('/configuracion', { params: categoria ? { categoria } : {} });
    return res.data.data;
  }

  async getByClave(clave: string): Promise<Configuracion> {
    const res = await api.get(`/configuracion/${clave}`);
    return res.data.data;
  }

  async update(clave: string, valor: string): Promise<Configuracion> {
    const res = await api.put(`/configuracion/${clave}`, { valor });
    return res.data.data;
  }

  async updateMany(items: { clave: string; valor: string }[]): Promise<Configuracion[]> {
    const res = await api.patch('/configuracion', { items });
    return res.data.data;
  }

  // ── Métodos de permisos — delegan a permisoService ────────────────────────
  // Se mantienen aquí para compatibilidad con Configuracion.tsx que los llama
  // como configuracionService.getPermisos(), .getPermisosRol(), etc.

  /** @alias permisoService.getAll() */
  getPermisos() {
    return permisoService.getAll();
  }

  /** @alias permisoService.getByRol() — devuelve solo los Permiso[] (sin el wrapper RolPermiso) */
  async getPermisosRol(id_rol: number) {
    const rolPermisos = await permisoService.getByRol(id_rol);
    return rolPermisos.map(rp => rp.permiso);
  }

  /** @alias permisoService.sincronizar() */
  async sincronizarPermisos(id_rol: number, ids_permisos: number[]) {
    return permisoService.sincronizar(id_rol, ids_permisos);
  }

  /** @alias permisoService.asignar() */
  async asignarPermiso(id_rol: number, id_permiso: number) {
    return permisoService.asignar(id_rol, id_permiso);
  }

  /** @alias permisoService.revocar() */
  async revocarPermiso(id_rol: number, id_permiso: number) {
    return permisoService.revocar(id_rol, id_permiso);
  }
}

export const configuracionService = new ConfiguracionServiceFrontend();

// ─── TURNOS DE CAJA ───────────────────────────────────────────────────────────

export interface TurnoCaja {
  id:             number;
  nombre:         string;
  hora_apertura:  string;
  hora_cierre:    string;
  dias_semana:    number[] | null;
  activo:         boolean;
  fecha_creacion: string;
  _count?: { cierres: number };
}

class TurnoCajaServiceFrontend {

  async getAll(soloActivos = false): Promise<TurnoCaja[]> {
    const res = await api.get('/caja/turnos', { params: soloActivos ? { activo: true } : {} });
    return res.data.data;
  }

  async create(data: {
    nombre: string; hora_apertura: string; hora_cierre: string; dias_semana?: number[];
  }): Promise<TurnoCaja> {
    const res = await api.post('/caja/turnos', data);
    return res.data.data;
  }

  async update(id: number, data: Partial<TurnoCaja>): Promise<TurnoCaja> {
    const res = await api.put(`/caja/turnos/${id}`, data);
    return res.data.data;
  }

  async delete(id: number): Promise<void> {
    await api.delete(`/caja/turnos/${id}`);
  }
}

export const turnoCajaService = new TurnoCajaServiceFrontend();

// ─── CIERRES DE CAJA ──────────────────────────────────────────────────────────

export interface CierreCaja {
  id:                  number;
  id_usuario:          number;
  id_turno?:           number;
  numero_cierre:       string;
  fecha_apertura:      string;
  fecha_cierre:        string;
  monto_inicial:       number;
  monto_final:         number;
  totales_por_metodo?: Record<string, number>;
  total_ventas:        number;
  total_efectivo:      number;
  diferencia:          number;
  justificacion?:      string;
  estado:              'pendiente' | 'en_proceso' | 'completado' | 'con_diferencia';
  observaciones?:      string;
  usuario?:            { id: number; nombre_completo: string; usuario: string };
  turno?:              TurnoCaja;
}

class CierreCajaServiceFrontend {

  async getAll(params: {
    page?: number; limit?: number;
    estado?: string; fecha_desde?: string; fecha_hasta?: string;
    id_restaurante?: number;
  } = {}): Promise<{ data: CierreCaja[]; meta: any }> {
    const res = await api.get('/caja/cierres', { params });
    return { data: (res.data.data || []).map(this.parse), meta: res.data.meta };
  }

  async getById(id: number): Promise<CierreCaja> {
    const res = await api.get(`/caja/cierres/${id}`);
    return this.parse(res.data.data);
  }

  async iniciar(data: {
    id_turno?: number; fecha_apertura: string; monto_inicial: number;
  }): Promise<CierreCaja> {
    const res = await api.post('/caja/cierres/iniciar', data);
    return this.parse(res.data.data);
  }

  async confirmar(id: number, data: {
    monto_final: number; justificacion?: string; observaciones?: string;
  }): Promise<CierreCaja> {
    const res = await api.post(`/caja/cierres/${id}/confirmar`, data);
    return this.parse(res.data.data);
  }

  private parse(c: any): CierreCaja {
    return {
      ...c,
      monto_inicial:  Number(c.monto_inicial  ?? 0),
      monto_final:    Number(c.monto_final    ?? 0),
      total_ventas:   Number(c.total_ventas   ?? 0),
      total_efectivo: Number(c.total_efectivo ?? 0),
      diferencia:     Number(c.diferencia     ?? 0),
    };
  }
}

export const cierreCajaService = new CierreCajaServiceFrontend();

// ─── RECETAS ──────────────────────────────────────────────────────────────────

export interface RecetaIngrediente {
  id:          number;
  id_receta:   number;
  id_producto: number;
  cantidad:    number;
  unidad:      string;
  es_opcional: boolean;
  notas?:      string;
  orden:       number;
  producto: {
    id:              number;
    nombre:          string;
    sku:             string;
    precio_unitario: number;
    /** Precio bruto de compra del proveedor; null si aún no se asocia. Base de costo. */
    precio_compra?:  number | null;
    unidad_medida:   string;
    stock_actual:    number;
    tipo_materia:    string;
  };
}

export interface Rentabilidad {
  costo_ingredientes:       number;
  costo_con_merma:          number;
  costo_unitario:           number;
  precio_sugerido_minimo:   number;
  precio_actual:            number;
  margen_actual_porcentaje: number;
  es_rentable:              boolean;
  diferencia_precio:        number;
  alerta_rentabilidad:      string | null;
  /** true mientras falte el precio de compra de algún insumo — el margen llega en 0%. */
  datos_incompletos?:       boolean;
  ingredientes_sin_precio?: number;
  advertencias?:            { ingrediente: string; mensaje: string }[];
}

export interface Receta {
  id:                        number;
  id_producto_final:         number;
  nombre_receta:             string;
  descripcion?:              string;
  cantidad_producida:        number;
  unidad_produccion:         string;
  tiempo_preparacion?:       number;
  instrucciones?:            string;
  notas?:                    string;
  merma_esperada_porcentaje?: number;
  estado:                    'activo' | 'inactivo';
  fecha_creacion:            string;
  producto_final: {
    id:            number;
    nombre:        string;
    sku:           string;
    precio_venta?: number;
    precio_unitario: number;
    unidad_medida: string;
  };
  ingredientes:  RecetaIngrediente[];
  rentabilidad:  Rentabilidad;
}

class RecetaServiceFrontend {

  async getAll(params: {
    page?: number; limit?: number; id_producto?: number; estado?: string;
  } = {}): Promise<{ data: Receta[]; meta: any }> {
    const res = await api.get('/recetas', { params });
    return { data: (res.data.data || []).map(this.parse), meta: res.data.meta };
  }

  async getById(id: number): Promise<Receta> {
    const res = await api.get(`/recetas/${id}`);
    return this.parse(res.data.data);
  }

  async getByProducto(id_producto: number): Promise<Receta> {
    const res = await api.get(`/recetas/producto/${id_producto}`);
    return this.parse(res.data.data);
  }

  async create(data: {
    id_producto_final:          number;
    nombre_receta:              string;
    descripcion?:               string;
    cantidad_producida:         number;
    unidad_produccion:          string;
    tiempo_preparacion?:        number;
    instrucciones?:             string;
    merma_esperada_porcentaje?: number;
    ingredientes: {
      id_producto: number; cantidad: number; unidad: string;
      es_opcional?: boolean; orden?: number;
    }[];
  }): Promise<Receta> {
    const res = await api.post('/recetas', data);
    return this.parse(res.data.data);
  }

  async update(id: number, data: any): Promise<Receta> {
    const res = await api.put(`/recetas/${id}`, data);
    return this.parse(res.data.data);
  }

  async updateIngredientes(id: number, ingredientes: {
    id_producto: number; cantidad: number; unidad: string;
    es_opcional?: boolean; orden?: number;
  }[]): Promise<Receta> {
    const res = await api.put(`/recetas/${id}/ingredientes`, { ingredientes });
    return this.parse(res.data.data);
  }

  async verificarStock(id_orden: number): Promise<{ ok: true } | { error: string; detalle: any[] }> {
    try {
      const res = await api.post(`/recetas/verificar-stock/${id_orden}`);
      return res.data.data;
    } catch (err: any) {
      if (err.response?.status === 422) {
        return { error: err.response.data.error, detalle: err.response.data.detalle };
      }
      throw err;
    }
  }

  private parse(r: any): Receta {
    return {
      ...r,
      cantidad_producida:        Number(r.cantidad_producida ?? 1),
      merma_esperada_porcentaje: r.merma_esperada_porcentaje != null
        ? Number(r.merma_esperada_porcentaje)
        : undefined,
      ingredientes: (r.ingredientes ?? []).map((i: any) => ({
        ...i,
        cantidad: Number(i.cantidad),
        producto: {
          ...i.producto,
          precio_unitario: Number(i.producto?.precio_unitario ?? 0),
          stock_actual:    Number(i.producto?.stock_actual    ?? 0),
        },
      })),
    };
  }
}

export const recetaService = new RecetaServiceFrontend();