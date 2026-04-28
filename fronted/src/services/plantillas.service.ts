/**
 * PlantillasService — API client para plantillas de impresión
 */

import api from './api';

export type TipoPlantilla = 'comanda' | 'factura' | 'ticket' | 'cocina';

export interface PlantillaImpresion {
  id:         number;
  nombre:     string;
  tipo:       TipoPlantilla;
  es_default: boolean;
  plantilla:  Record<string, unknown>;
  estado:     string;
  fecha_creacion:    string;
  fecha_modificacion: string;
}

export interface CreatePlantillaDto {
  nombre:     string;
  tipo:       TipoPlantilla;
  es_default?: boolean;
  plantilla:  Record<string, unknown>;
}

/** Estructura base de una plantilla de ticket */
export const PLANTILLA_TICKET_DEFAULT: Record<string, unknown> = {
  config: {
    paperWidth: '80mm',
    fontSize:   'medium',
    showLogo:   true,
  },
  sections: [
    { id: 'header', tipo: 'header', visible: true, orden: 0,
      campos: { restaurantName: true, nit: false, direccion: false, telefono: true } },
    { id: 'items',  tipo: 'items',  visible: true, orden: 1,
      campos: { cantidad: true, nombre: true, precio: true, variante: true, nota: true } },
    { id: 'totals', tipo: 'totals', visible: true, orden: 2,
      campos: { subtotal: true, iva: false, total: true, metodoPago: true } },
    { id: 'footer', tipo: 'footer', visible: true, orden: 3,
      campos: { gracias: true, fechaHora: true } },
  ],
};

/** Estructura base para una factura (más campos legales) */
export const PLANTILLA_FACTURA_DEFAULT: Record<string, unknown> = {
  config: { paperWidth: 'A4', fontSize: 'medium', showLogo: true },
  sections: [
    { id: 'header', tipo: 'header', visible: true, orden: 0,
      campos: { restaurantName: true, nit: true, direccion: true, telefono: true, resolucionDian: false } },
    { id: 'cliente', tipo: 'cliente', visible: true, orden: 1,
      campos: { nombre: true, documento: true, direccion: false, email: false } },
    { id: 'items',  tipo: 'items',  visible: true, orden: 2,
      campos: { cantidad: true, nombre: true, precio: true, descuento: false, subtotal: true } },
    { id: 'totals', tipo: 'totals', visible: true, orden: 3,
      campos: { subtotal: true, iva: true, descuento: false, total: true, metodoPago: true } },
    { id: 'footer', tipo: 'footer', visible: true, orden: 4,
      campos: { fechaHora: true, condicionesPago: false } },
  ],
};

/** Estructura base para comanda (para el mesero) */
export const PLANTILLA_COMANDA_DEFAULT: Record<string, unknown> = {
  config: { paperWidth: '80mm', fontSize: 'large', showLogo: false },
  sections: [
    { id: 'header', tipo: 'header', visible: true, orden: 0,
      campos: { mesa: true, mesero: true, fechaHora: true } },
    { id: 'items',  tipo: 'items',  visible: true, orden: 1,
      campos: { cantidad: true, nombre: true, variante: true, nota: true, precio: false } },
    { id: 'footer', tipo: 'footer', visible: true, orden: 2,
      campos: { totalItems: true } },
  ],
};

/** Estructura base para impresora de cocina */
export const PLANTILLA_COCINA_DEFAULT: Record<string, unknown> = {
  config: { paperWidth: '80mm', fontSize: 'large', showLogo: false },
  sections: [
    { id: 'header', tipo: 'header', visible: true, orden: 0,
      campos: { mesa: true, orden: true, fechaHora: true, prioridad: false } },
    { id: 'items',  tipo: 'items',  visible: true, orden: 1,
      campos: { cantidad: true, nombre: true, variante: true, nota: true } },
  ],
};

/** Mapa de plantillas por tipo */
export const PLANTILLA_DEFAULTS: Record<TipoPlantilla, Record<string, unknown>> = {
  ticket:  PLANTILLA_TICKET_DEFAULT,
  factura: PLANTILLA_FACTURA_DEFAULT,
  comanda: PLANTILLA_COMANDA_DEFAULT,
  cocina:  PLANTILLA_COCINA_DEFAULT,
};

export const plantillasService = {
  listar: async (tipo?: TipoPlantilla): Promise<PlantillaImpresion[]> => {
    const params = tipo ? { tipo } : {};
    const { data } = await api.get<{ success: boolean; data: PlantillaImpresion[] }>(
      '/plantillas', { params }
    );
    return data.data;
  },

  obtener: async (id: number): Promise<PlantillaImpresion> => {
    const { data } = await api.get<{ success: boolean; data: PlantillaImpresion }>(`/plantillas/${id}`);
    return data.data;
  },

  obtenerDefault: async (tipo: TipoPlantilla): Promise<PlantillaImpresion | null> => {
    try {
      const { data } = await api.get<{ success: boolean; data: PlantillaImpresion | null }>(
        `/plantillas/default/${tipo}`
      );
      return data.data;
    } catch {
      return null;
    }
  },

  crear: async (dto: CreatePlantillaDto): Promise<PlantillaImpresion> => {
    const { data } = await api.post<{ success: boolean; data: PlantillaImpresion }>('/plantillas', dto);
    return data.data;
  },

  actualizar: async (id: number, dto: Partial<CreatePlantillaDto>): Promise<PlantillaImpresion> => {
    const { data } = await api.put<{ success: boolean; data: PlantillaImpresion }>(`/plantillas/${id}`, dto);
    return data.data;
  },

  eliminar: async (id: number): Promise<void> => {
    await api.delete(`/plantillas/${id}`);
  },
};
