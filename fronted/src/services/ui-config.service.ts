/**
 * UiConfigService — API client para configuraciones dinámicas de UI
 * Usado para: sidebar layout, preferencias de usuario, configuración por restaurante
 */

import api from './api';

export interface UiConfig {
  id:                 number;
  scope:              string;
  clave:              string;
  valor:              unknown;
  contexto?:          string | null;
  version:            number;
  fecha_creacion:     string;
  fecha_modificacion: string;
}

const BASE = '/ui-config';

export const uiConfigService = {

  /** Todas las configs (requiere superadmin) */
  getAll: async (): Promise<UiConfig[]> => {
    const { data } = await api.get<{ success: boolean; data: UiConfig[] }>(`${BASE}`);
    return data.data ?? [];
  },

  getByScope: async (scope: string): Promise<UiConfig[]> => {
    const { data } = await api.get<{ success: boolean; data: UiConfig[] }>(`${BASE}/${scope}`);
    return data.data ?? [];
  },

  getConfig: async (scope: string, clave: string, contexto?: string): Promise<UiConfig | null> => {
    const params = contexto ? { contexto } : {};
    const { data } = await api.get<{ success: boolean; data: UiConfig | null }>(`${BASE}/${scope}/${clave}`, { params });
    return data.data;
  },

  setConfig: async (scope: string, clave: string, valor: unknown, contexto?: string): Promise<UiConfig> => {
    const { data } = await api.put<{ success: boolean; data: UiConfig }>(`${BASE}/${scope}/${clave}`, { valor, contexto });
    return data.data;
  },

  /** Elimina una config por ID (requiere superadmin) */
  deleteConfig: async (id: number): Promise<void> => {
    await api.delete(`${BASE}/${id}`);
  },
};
