/**
 * ListaComprasService - Frontend
 * Conecta con GET/POST /listas-compras
 */

import api from './api';

export type EstadoListaCompras = 'generada' | 'enviada' | 'recibida' | 'parcial' | 'cancelada';

export interface ListaComprasItem {
  id: number;
  id_lista: number;
  id_producto: number;
  id_proveedor_sugerido?: number;
  cantidad_sugerida: number;
  precio_estimado?: number;
  cantidad_recibida?: number;
  observaciones?: string;
  producto?: {
    id: number;
    nombre: string;
    sku: string;
    unidad_medida: string;
    stock_actual: number;
    stock_minimo: number;
    stock_maximo?: number;
  };
}

export interface ListaCompras {
  id: number;
  numero_lista: string;
  estado: EstadoListaCompras;
  id_usuario_generado: number;
  id_proveedor_asignado?: number;
  fecha_generacion: string;
  fecha_envio?: string;
  fecha_recepcion?: string;
  notas?: string;
  total_estimado?: number;
  usuario_generado?: { id: number; nombre_completo: string };
  proveedor_asignado?: { id: number; razon_social: string };
  items?: ListaComprasItem[];
  _count?: { items: number };
}

class ListaComprasServiceFrontend {
  private readonly base = '/listas-compras';

  async listar(params: {
    page?: number; limit?: number;
    estado?: EstadoListaCompras;
    id_proveedor?: number;
    desde?: string; hasta?: string;
    id_restaurante?: number;
  } = {}): Promise<{ data: ListaCompras[]; pagination: any }> {
    const res = await api.get(this.base, { params });
    const body = res.data;
    return {
      data: (body.data ?? []).map(this.parse),
      pagination: body.pagination ?? body.meta ?? {},
    };
  }

  async obtener(id: number): Promise<ListaCompras> {
    const res = await api.get(`${this.base}/${id}`);
    return this.parse(res.data.data ?? res.data);
  }

  async generarAutomatico(notas?: string): Promise<{ lista?: ListaCompras; total_items: number; message: string }> {
    const res = await api.post(`${this.base}/generar`, { notas });
    const body = res.data;
    return {
      lista:       body.data?.lista ? this.parse(body.data.lista) : undefined,
      total_items: body.data?.total_items ?? 0,
      message:     body.message ?? 'OK',
    };
  }

  /** Crea una lista manual eligiendo productos y cantidades. */
  async crearManual(data: {
    notas?: string;
    id_proveedor_asignado?: number;
    items: {
      id_producto:           number;
      cantidad_sugerida:     number;
      id_proveedor_sugerido?: number;
      precio_estimado?:       number;
      observaciones?:         string;
    }[];
  }): Promise<{ lista?: ListaCompras; total_items: number; message: string }> {
    const res = await api.post(this.base, data);
    const body = res.data;
    return {
      lista:       body.data?.lista ? this.parse(body.data.lista) : undefined,
      total_items: body.data?.total_items ?? 0,
      message:     body.message ?? 'OK',
    };
  }

  async cambiarEstado(id: number, estado: EstadoListaCompras): Promise<ListaCompras> {
    const res = await api.patch(`${this.base}/${id}/estado`, { estado });
    return this.parse(res.data.data ?? res.data);
  }

  async actualizarItem(id: number, idItem: number, data: { cantidad_recibida?: number; observaciones?: string }): Promise<void> {
    await api.put(`${this.base}/${id}/items/${idItem}`, data);
  }

  private parse = (l: any): ListaCompras => ({
    ...l,
    total_estimado: l.total_estimado != null ? Number(l.total_estimado) : undefined,
    items: (l.items ?? []).map((item: any) => ({
      ...item,
      cantidad_sugerida: Number(item.cantidad_sugerida),
      precio_estimado:   item.precio_estimado != null ? Number(item.precio_estimado) : undefined,
      cantidad_recibida: item.cantidad_recibida != null ? Number(item.cantidad_recibida) : undefined,
    })),
  });
}

export const listaComprasService = new ListaComprasServiceFrontend();
