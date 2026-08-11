/**
 * facturacion.service.ts — Facturación electrónica DIAN (emisión a solicitud + config).
 * Espeja los endpoints /facturacion del backend.
 */

import api from './api';

export interface AdquirienteFiscal {
  tipo_documento:   string; // código DIAN: '13' cédula, '31' NIT, '11' RC…
  numero_documento: string;
  nombre:           string;
  email?:           string;
  telefono?:        string;
  direccion?:       string;
}

export interface FacturaElectronica {
  id:            number;
  id_orden:      number;
  estado:        'pendiente' | 'emitida' | 'rechazada' | 'error' | 'anulada';
  cufe:          string | null;
  numero:        string | null;
  qr_url:        string | null;
  pdf_url:       string | null;
  mensaje_error: string | null;
}

export interface ConfigFE {
  configurada:        boolean;
  razon_social?:      string;
  regimen?:           string;
  responsabilidades?: string;
  ambiente?:          'pruebas' | 'produccion';
  numbering_range_id?: number | null;
  tiene_credenciales?: boolean;
}

export const facturacionService = {
  async emitir(idOrden: number, adquiriente: AdquirienteFiscal): Promise<FacturaElectronica> {
    const res = await api.post(`/facturacion/ordenes/${idOrden}/emitir`, adquiriente);
    return res.data.data;
  },

  async obtener(id: number): Promise<FacturaElectronica> {
    const res = await api.get(`/facturacion/${id}`);
    return res.data.data;
  },

  async getConfig(): Promise<ConfigFE> {
    const res = await api.get('/facturacion/config');
    return res.data.data;
  },

  async guardarConfig(dto: Partial<ConfigFE> & {
    credenciales?: { clientId: string; clientSecret: string; username: string; password: string };
  }): Promise<ConfigFE> {
    const res = await api.put('/facturacion/config', dto);
    return res.data.data;
  },
};

/** Tipos de documento DIAN comunes (para el selector del adquiriente). */
export const TIPOS_DOCUMENTO_DIAN = [
  { value: '13', label: 'Cédula de ciudadanía' },
  { value: '31', label: 'NIT' },
  { value: '22', label: 'Cédula de extranjería' },
  { value: '41', label: 'Pasaporte' },
  { value: '11', label: 'Registro civil' },
];
