/**
 * OrdenesService - Frontend
 *
 * Soporta nueva arquitectura (Orden + OrdenSede + OrdenSedeItem)
 * y legado (Orden + OrdenDetalle + Pago) de forma transparente.
 */

import api from './api';

// ─── Enums ────────────────────────────────────────────────────────────────────

export type EstadoOrdenGlobal =
  | 'BORRADOR'
  | 'RECIBIDA'
  | 'EN_PROCESO'
  | 'LISTA'
  | 'ENTREGADA'
  | 'CANCELADA';

export type EstadoOrdenSede =
  | 'PENDIENTE'
  | 'EN_PREPARACION'
  | 'LISTA'
  | 'ENTREGADA'
  | 'CANCELADA';

// ─── Legado ───────────────────────────────────────────────────────────────────

export interface EstadoOrden {
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
}

export interface OrdenDetalle {
  id: number;
  id_orden: number;
  id_producto: number;
  producto?: { id: number; nombre: string; sku: string; precio_unitario: number };
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  descuento: number;
  total: number;
  notas?: string;
}

// ─── Nueva arquitectura ───────────────────────────────────────────────────────

export interface OrdenSedeItem {
  id: number;
  id_sede: number;
  id_producto: number;
  id_variante?: number;
  producto?: { id: number; nombre: string };
  cantidad: number;
  precio_unitario: number;
  descuento: number;
  subtotal: number;
  iva: number;
  total: number;
  notas?: string;
}

export interface OrdenSede {
  id: number;
  id_orden: number;
  id_restaurante: number;
  restaurante?: { id: number; nombre: string };
  sufijo: string;
  estado: EstadoOrdenSede;
  subtotal: number;
  descuento: number;
  iva: number;
  total: number;
  notas?: string;
  iniciado_en?: string;
  listo_en?: string;
  cancelado_en?: string;
  motivo_cancelacion?: string;
  items: OrdenSedeItem[];
}

export interface PagoOrden {
  id: number;
  id_orden: number;
  id_metodo_pago: number;
  metodo_pago?: { id: number; nombre: string };
  monto: number;
  referencia?: string;
  notas?: string;
  estado: 'PENDIENTE' | 'CONFIRMADO' | 'RECHAZADO';
}

// ─── Orden principal ───────────────────────────────────────────────────────────

export interface Orden {
  id: number;
  numero_orden: string;
  tipo_orden: 'local' | 'domicilio';
  // Legado
  id_estado?: number;
  estado?: EstadoOrden;
  // Nueva arquitectura
  estado_global?: EstadoOrdenGlobal;
  id_grupo?: number;
  id_usuario: number;
  id_cliente?: number;
  direccion_entrega?: string;
  telefono_contacto?: string;
  nombre_contacto?: string;
  notas_entrega?: string;
  costo_domicilio?: number;
  plataforma_delivery?: string;
  subtotal: number;
  descuento: number;
  impuestos: number;
  /** 'iva' | 'impoconsumo' — snapshot del tipo de impuesto aplicado al crear la orden. */
  impuesto_tipo?: string;
  propina: number;
  total: number;
  observaciones?: string;
  fecha_apertura: string;
  fecha_confirmacion?: string;
  fecha_entrega?: string;
  fecha_cancelacion?: string;
  motivo_cancelacion?: string;
  // Relaciones
  detalles?: OrdenDetalle[];
  sedes?: OrdenSede[];
  pagos?: any[];
  pagos_orden?: PagoOrden[];
}

// ─── DTOs de entrada ──────────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface OrdenesParams {
  tipo_orden?:     'local' | 'domicilio';
  id_estado?:      number;
  estado_global?:  EstadoOrdenGlobal;
  fecha_desde?:    string;
  fecha_hasta?:    string;
  page?:           number;
  limit?:          number;
  id_restaurante?: number;
  id_grupo?:       number;
}

export interface OrdenSedesParams {
  estado?:  EstadoOrdenSede;
  desde?:   string;
  hasta?:   string;
  page?:    number;
  limit?:   number;
}

export interface DetalleInput {
  id_producto: number;
  id_variante?: number;
  cantidad: number;
  precio_unitario: number;
  descuento?: number;
  notas?: string;
}

export interface SedeInput {
  id_restaurante: number;
  items: DetalleInput[];
}

/** Legado — una sola sede con detalles planos */
export interface OrdenCreateDTO {
  tipo_orden: 'local' | 'domicilio';
  id_estado: number;
  id_usuario: number;
  id_cliente?: number;
  id_restaurante?: number;
  direccion_entrega?: string;
  telefono_contacto?: string;
  nombre_contacto?: string;
  notas_entrega?: string;
  costo_domicilio?: number;
  plataforma_delivery?: string;
  descuento?: number;
  propina?: number;
  observaciones?: string;
  detalles: DetalleInput[];
}

/** Nueva arquitectura — multi-sede */
export interface OrdenCreateV2DTO {
  tipo_orden: 'local' | 'domicilio';
  id_grupo: number;
  id_cliente?: number;
  direccion_entrega?: string;
  telefono_contacto?: string;
  nombre_contacto?: string;
  notas_entrega?: string;
  costo_domicilio?: number;
  plataforma_delivery?: string;
  descuento?: number;
  propina?: number;
  observaciones?: string;
  sedes: SedeInput[];
}

export interface OrdenUpdateDTO extends Partial<Omit<OrdenCreateDTO, 'detalles'>> {}

export interface PagoInput {
  id_metodo_pago: number;
  monto: number;
  referencia?: string;
  notas?: string;
}

export interface ItemSedeInput {
  id_producto: number;
  id_variante?: number;
  cantidad: number;
  precio_unitario: number;
  descuento?: number;
  notas?: string;
}

export interface ActualizarItemInput {
  cantidad?: number;
  notas?: string;
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

class OrdenesService {
  private readonly basePath     = '/ordenes';
  private readonly sedesPath    = '/orden-sedes';

  // ── Listado de Órdenes ───────────────────────────────────────────────────────

  async getAll(params: OrdenesParams = {}): Promise<Orden[]> {
    try {
      const response = await api.get<{ success: boolean; data: Orden[]; meta: any }>(this.basePath, { params });
      return (response.data.data ?? []).map(o => this.parseOrden(o));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getPaginado(params: OrdenesParams = {}): Promise<PaginatedResult<Orden>> {
    try {
      const response = await api.get<{ success: boolean; data: Orden[]; meta: any }>(this.basePath, { params });
      return {
        data: (response.data.data ?? []).map(o => this.parseOrden(o)),
        meta: response.data.meta,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getById(id: number): Promise<Orden> {
    try {
      const response = await api.get<{ success: boolean; data: Orden }>(`${this.basePath}/${id}`);
      return this.parseOrden(response.data.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getEstadisticas(params: { fecha_desde?: string; fecha_hasta?: string; id_grupo?: number } = {}): Promise<any> {
    try {
      const response = await api.get(`${this.basePath}/estadisticas`, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ── Crear Orden ──────────────────────────────────────────────────────────────

  /** Legado: crea orden con detalles planos */
  async create(orden: OrdenCreateDTO): Promise<Orden> {
    try {
      const response = await api.post<{ success: boolean; data: Orden }>(this.basePath, orden);
      return this.parseOrden(response.data.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /** Nueva arquitectura: crea Orden + N OrdenSede en una sola transacción */
  async createV2(orden: OrdenCreateV2DTO): Promise<Orden> {
    try {
      const response = await api.post<{ success: boolean; data: Orden }>(this.basePath, orden);
      return this.parseOrden(response.data.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ── Pagar / Cancelar Orden (nueva arquitectura) ───────────────────────────────

  /** Registra el pago global de la Orden. Requiere estado_global === LISTA. */
  async pagar(id: number, pagos: PagoInput[]): Promise<Orden> {
    try {
      const response = await api.post<{ success: boolean; data: Orden }>(`${this.basePath}/${id}/pagar`, { pagos });
      return this.parseOrden(response.data.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /** Cancela la Orden completa + todas sus sedes activas. */
  async cancelar(id: number, motivo?: string): Promise<void> {
    try {
      await api.post(`${this.basePath}/${id}/cancelar`, { motivo });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ── Operaciones legado ────────────────────────────────────────────────────────

  async update(id: number, orden: OrdenUpdateDTO): Promise<Orden> {
    try {
      const response = await api.put<{ success: boolean; data: Orden }>(`${this.basePath}/${id}`, orden);
      return this.parseOrden(response.data.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateEstado(id: number, id_estado: number, pagos?: PagoInput[]): Promise<Orden> {
    try {
      const response = await api.patch<{ success: boolean; data: Orden }>(
        `${this.basePath}/${id}/estado`,
        { id_estado, pagos },
      );
      return this.parseOrden(response.data.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async delete(id: number): Promise<void> {
    try {
      await api.delete(`${this.basePath}/${id}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async addDetalle(id: number, detalle: DetalleInput): Promise<OrdenDetalle> {
    try {
      const response = await api.post<{ success: boolean; data: OrdenDetalle }>(
        `${this.basePath}/${id}/detalles`,
        detalle,
      );
      return this.parseDetalle(response.data.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async removeDetalle(detalleId: number): Promise<void> {
    try {
      await api.delete(`${this.basePath}/detalles/${detalleId}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ── OrdenSede ────────────────────────────────────────────────────────────────

  /** Lista las sedes del restaurante del usuario (vista de cocina / KDS). */
  async listarSedes(params: OrdenSedesParams = {}): Promise<PaginatedResult<OrdenSede>> {
    try {
      const response = await api.get<{ success: boolean; data: OrdenSede[]; meta: any }>(
        this.sedesPath,
        { params },
      );
      return {
        data: (response.data.data ?? []).map(s => this.parseSede(s)),
        meta: response.data.meta,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getSedeById(id: number): Promise<OrdenSede> {
    try {
      const response = await api.get<{ success: boolean; data: OrdenSede }>(`${this.sedesPath}/${id}`);
      return this.parseSede(response.data.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /** Avanza el estado de una sede: PENDIENTE → EN_PREPARACION → LISTA */
  async avanzarSede(id: number): Promise<OrdenSede> {
    try {
      const response = await api.patch<{ success: boolean; data: OrdenSede }>(
        `${this.sedesPath}/${id}/avanzar`,
      );
      return this.parseSede(response.data.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /** Agrega un producto a una sede activa. */
  async agregarItemSede(id: number, item: ItemSedeInput): Promise<OrdenSedeItem> {
    try {
      const response = await api.post<{ success: boolean; data: OrdenSedeItem }>(
        `${this.sedesPath}/${id}/items`,
        item,
      );
      return this.parseItem(response.data.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /** Actualiza cantidad o notas de un ítem de sede. */
  async actualizarItemSede(itemId: number, data: ActualizarItemInput): Promise<OrdenSedeItem> {
    try {
      const response = await api.put<{ success: boolean; data: OrdenSedeItem }>(
        `${this.sedesPath}/items/${itemId}`,
        data,
      );
      return this.parseItem(response.data.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /** Elimina un ítem y revierte su stock. */
  async eliminarItemSede(itemId: number): Promise<void> {
    try {
      await api.delete(`${this.sedesPath}/items/${itemId}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /** Cancela una sede específica. */
  async cancelarSede(id: number, motivo: string): Promise<void> {
    try {
      await api.post(`${this.sedesPath}/${id}/cancelar`, { motivo });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ── Parsers (Decimal → number) ────────────────────────────────────────────────

  private parseOrden(o: any): Orden {
    if (!o) return o;
    return {
      ...o,
      subtotal:        this.toNumber(o.subtotal),
      descuento:       this.toNumber(o.descuento),
      impuestos:       this.toNumber(o.impuestos),
      propina:         this.toNumber(o.propina),
      total:           this.toNumber(o.total),
      costo_domicilio: o.costo_domicilio != null ? this.toNumber(o.costo_domicilio) : undefined,
      detalles:        o.detalles?.map((d: any) => this.parseDetalle(d)),
      sedes:           o.sedes?.map((s: any) => this.parseSede(s)),
      pagos_orden:     o.pagos_orden?.map((p: any) => this.parsePago(p)),
    };
  }

  private parseDetalle(d: any): OrdenDetalle {
    return {
      ...d,
      cantidad:        this.toNumber(d.cantidad),
      precio_unitario: this.toNumber(d.precio_unitario),
      subtotal:        this.toNumber(d.subtotal),
      descuento:       this.toNumber(d.descuento),
      total:           this.toNumber(d.total),
    };
  }

  private parseSede(s: any): OrdenSede {
    return {
      ...s,
      subtotal: this.toNumber(s.subtotal),
      descuento: this.toNumber(s.descuento),
      iva:      this.toNumber(s.iva),
      total:    this.toNumber(s.total),
      items:    (s.items ?? []).map((i: any) => this.parseItem(i)),
    };
  }

  private parseItem(i: any): OrdenSedeItem {
    return {
      ...i,
      cantidad:        this.toNumber(i.cantidad),
      precio_unitario: this.toNumber(i.precio_unitario),
      descuento:       this.toNumber(i.descuento),
      subtotal:        this.toNumber(i.subtotal),
      iva:             this.toNumber(i.iva),
      total:           this.toNumber(i.total),
    };
  }

  private parsePago(p: any): PagoOrden {
    return { ...p, monto: this.toNumber(p.monto) };
  }

  private toNumber(value: any): number {
    const n = typeof value === 'string' ? parseFloat(value) : Number(value);
    return isNaN(n) ? 0 : n;
  }

  private handleError(error: any): Error {
    if (error.response) {
      return new Error(
        error.response.data?.error ||
        error.response.data?.message ||
        'Error en el servidor',
      );
    } else if (error.request) {
      return new Error('No se pudo conectar con el servidor.');
    }
    return error instanceof Error ? error : new Error('Error desconocido');
  }
}

export const ordenesService = new OrdenesService();
