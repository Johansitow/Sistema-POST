/**
 * orden-grupo.service.ts — Servicio frontend para OrdenGrupo
 * Consume /api/v1/ordenes-grupo
 */

import api from './api';

export interface OrdenGrupoResumen {
  id:             number;
  numero_grupo:   string;
  id_grupo:       number;
  id_usuario:     number;
  estado:         string;
  total_pagado:   number;
  notas?:         string;
  fecha_creacion: string;
  ordenes: {
    id:           number;
    numero_orden: string;
    id_restaurante?: number;
    total:        number;
    estado?: { nombre: string; codigo: string; color?: string };
  }[];
  pagos: {
    id:             number;
    monto:          number;
    metodo_pago?:   { nombre: string; codigo: string };
    fecha_pago:     string;
  }[];
  _count?: { ordenes: number; pagos: number };
}

export interface OrdenGrupoRecibo {
  id:           number;
  estado:       string;
  fecha_creacion: string;
  ordenes: {
    id:           number;
    numero_orden: string;
    restaurante?: string;
    subtotal:     number;
    impuestos:    number;
    total:        number;
    detalles: { nombre: string; cantidad: number; precio_unitario: number; total: number }[];
  }[];
  resumen: {
    subtotal:     number;
    impuestos:    number;
    total:        number;
    total_pagado: number;
    pendiente:    number;
  };
  pagos: { metodo: string; monto: number; referencia?: string }[];
}

const BASE = '/ordenes-grupo';

// ── DTOs para creación y pago ─────────────────────────────────────────────────

export interface ItemOrdenGrupoDto {
  id_producto:     number;
  id_variante?:    number;
  cantidad:        number;
  precio_unitario: number;
  notas?:          string;
}

export interface RestauranteOrdenDto {
  id_restaurante: number;
  items:          ItemOrdenGrupoDto[];
}

export interface CrearOrdenGrupoDto {
  id_grupo:     number;
  id_estado:    number;
  tipo_orden:   'local' | 'domicilio';
  notas?:       string;
  id_cliente?:  number;
  restaurantes: RestauranteOrdenDto[];
}

export interface RegistrarPagoDto {
  id_metodo_pago: number;
  monto:          number;
  referencia?:    string;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const ordenGrupoService = {
  async listar(params?: {
    page?: number; limit?: number;
    id_grupo?: number; estado?: string;
    desde?: string; hasta?: string;
  }) {
    const { data } = await api.get(BASE, { params });
    return data.data as { data: OrdenGrupoResumen[]; meta: any };
  },

  async obtener(id: number): Promise<OrdenGrupoResumen> {
    const { data } = await api.get(`${BASE}/${id}`);
    return data.data;
  },

  async recibo(id: number): Promise<OrdenGrupoRecibo> {
    const { data } = await api.get(`${BASE}/${id}/recibo`);
    return data.data;
  },

  async cancelar(id: number): Promise<OrdenGrupoResumen> {
    const { data } = await api.post(`${BASE}/${id}/cancelar`);
    return data.data;
  },

  /** Crea un OrdenGrupo con sus órdenes hijas de forma atómica */
  async crearConOrdenes(dto: CrearOrdenGrupoDto): Promise<OrdenGrupoResumen> {
    const { data } = await api.post(`${BASE}/con-ordenes`, dto);
    return data.data;
  },

  /** Registra un pago consolidado sobre el grupo */
  async registrarPago(id: number, dto: RegistrarPagoDto): Promise<void> {
    await api.post(`${BASE}/${id}/pagos`, dto);
  },
};
