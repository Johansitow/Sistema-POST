/**
 * ProveedorService - Frontend
 */
import api from './api';

export interface Proveedor {
  id: number;
  razon_social: string;
  nit?: string;
  contacto_nombre?: string;
  contacto_telefono?: string;
  contacto_whatsapp?: string;
  contacto_email?: string;
  direccion?: string;
  ciudad?: string;
  sitio_web?: string;
  calificacion?: number;
  tiempo_entrega_promedio?: number;
  estado: 'activo' | 'inactivo' | 'eliminado';
  fecha_creacion: string;
  _count?: { productos: number };
  productos?: ProveedorProducto[];
}

export interface ProveedorProducto {
  id: number;
  id_proveedor: number;
  id_producto: number;
  precio_unitario: number;
  tiempo_entrega?: number;
  cantidad_minima?: number;
  calidad_calificacion?: number;
  fecha_ultima_entrega?: string;
  es_proveedor_preferido: boolean;
  estado: string;
  producto?: { id: number; nombre: string; sku: string; categoria?: { nombre: string } };
  proveedor?: Proveedor;
}

export interface ProveedorCreateDTO {
  razon_social: string;
  nit?: string;
  contacto_nombre?: string;
  contacto_telefono?: string;
  contacto_whatsapp?: string;
  contacto_email?: string;
  direccion?: string;
  ciudad?: string;
  sitio_web?: string;
  calificacion?: number;
  tiempo_entrega_promedio?: number;
}

class ProveedorServiceFrontend {
  async getAll(params: { page?: number; limit?: number; search?: string; estado?: string } = {}): Promise<{ data: Proveedor[]; meta: any }> {
    const res = await api.get('/proveedores', { params });
    return { data: res.data.data, meta: res.data.meta };
  }

  async getById(id: number): Promise<Proveedor> {
    const res = await api.get(`/proveedores/${id}`);
    return res.data.data;
  }

  async create(data: ProveedorCreateDTO): Promise<Proveedor> {
    const res = await api.post('/proveedores', data);
    return res.data.data;
  }

  async update(id: number, data: Partial<ProveedorCreateDTO>): Promise<Proveedor> {
    const res = await api.put(`/proveedores/${id}`, data);
    return res.data.data;
  }

  async cambiarEstado(id: number, estado: 'activo' | 'inactivo'): Promise<Proveedor> {
    const res = await api.patch(`/proveedores/${id}/estado`, { estado });
    return res.data.data;
  }

  async getProductos(id: number): Promise<ProveedorProducto[]> {
    const res = await api.get(`/proveedores/${id}/productos`);
    return res.data.data;
  }

  async asociarProducto(id: number, data: { id_producto: number; precio_unitario: number; tiempo_entrega?: number; es_proveedor_preferido?: boolean; calidad_calificacion?: number }): Promise<ProveedorProducto> {
    const res = await api.post(`/proveedores/${id}/productos`, data);
    return res.data.data;
  }

  async actualizarRelacion(id: number, productoId: number, data: Partial<{ precio_unitario: number; tiempo_entrega: number; es_proveedor_preferido: boolean; calidad_calificacion: number }>): Promise<ProveedorProducto> {
    const res = await api.put(`/proveedores/${id}/productos/${productoId}`, data);
    return res.data.data;
  }

  async desasociarProducto(id: number, productoId: number): Promise<void> {
    await api.delete(`/proveedores/${id}/productos/${productoId}`);
  }
}

export const proveedorService = new ProveedorServiceFrontend();

// ─────────────────────────────────────────────────────────────────────────────

/**
 * FacturaService - Frontend
 */
export interface Factura {
  id: number;
  id_orden: number;
  numero_factura: string;
  estado_factura: 'pendiente' | 'pagada' | 'anulada';
  subtotal: number;
  impuestos: number;
  total: number;
  fecha_emision: string;
  fecha_pago?: string;
  orden?: any;
}

class FacturaServiceFrontend {
  async getAll(params: { page?: number; limit?: number; estado_factura?: string; fecha_desde?: string; fecha_hasta?: string; id_restaurante?: number; search?: string } = {}): Promise<{ data: Factura[]; meta: any }> {
    const res = await api.get('/facturas', { params });
    return { data: res.data.data.map(this.parse), meta: res.data.meta };
  }

  async getById(id: number): Promise<Factura> {
    const res = await api.get(`/facturas/${id}`);
    return this.parse(res.data.data);
  }

  async getByOrden(id_orden: number): Promise<Factura> {
    const res = await api.get(`/ordenes/${id_orden}/factura`);
    return this.parse(res.data.data);
  }

  private parse(f: any): Factura {
    return { ...f, subtotal: Number(f.subtotal), impuestos: Number(f.impuestos), total: Number(f.total) };
  }
}

export const facturaService = new FacturaServiceFrontend();

// ─────────────────────────────────────────────────────────────────────────────

/**
 * AuditoriaService - Frontend
 */
export interface AuditoriaEntry {
  id: string;
  id_usuario?: number;
  usuario?: { id: number; nombre_completo: string; usuario: string };
  accion: string;
  modulo: string;
  tabla_afectada?: string;
  id_registro_afectado?: number;
  datos_anteriores?: any;
  datos_nuevos?: any;
  ip_address?: string;
  fecha_hora: string;
}

class AuditoriaServiceFrontend {
  async getAll(params: { page?: number; limit?: number; id_usuario?: number; modulo?: string; accion?: string; fecha_desde?: string; fecha_hasta?: string } = {}): Promise<{ data: AuditoriaEntry[]; meta: any }> {
    const res = await api.get('/auditoria', { params });
    return { data: res.data.data, meta: res.data.meta };
  }
}

export const auditoriaService = new AuditoriaServiceFrontend();

// ─────────────────────────────────────────────────────────────────────────────

/**
 * EstadoOrdenService - Frontend
 * Carga estados dinámicamente desde BD
 */
export interface EstadoOrdenFull {
  id: number;
  nombre: string;
  codigo: string;
  descripcion?: string;
  color?: string;
  icono?: string;
  orden: number;
  es_inicial: boolean;
  es_final: boolean;
  permite_edicion: boolean;
  imprime_comanda: boolean;
  activo: boolean;
  transiciones_desde?: Array<{ id: number; id_estado_hacia: number; estado_hacia: EstadoOrdenFull }>;
}

export interface MetodoPagoFrontend {
  id: number;
  nombre: string;
  codigo: string;
  icono?: string;
  requiere_referencia: boolean;
  activo: boolean;
  orden: number;
}

class EstadoOrdenServiceFrontend {
  async getAll(): Promise<EstadoOrdenFull[]> {
    const res = await api.get('/estados-orden');
    return res.data.data;
  }

  async getTransicionesDesde(id: number): Promise<EstadoOrdenFull[]> {
    const res = await api.get(`/estados-orden/${id}/transiciones`);
    return res.data.data.map((t: any) => t.estado_hacia);
  }
}

export const estadoOrdenService = new EstadoOrdenServiceFrontend();

class MetodoPagoServiceFrontend {
  async getAll(): Promise<MetodoPagoFrontend[]> {
    // Los métodos de pago vienen en el detalle de la orden o podemos exponerlos
    // Por ahora los cargamos desde el endpoint de configuración de pagos
    const res = await api.get('/metodos-pago');
    return res.data.data;
  }
}

export const metodoPagoService = new MetodoPagoServiceFrontend();
