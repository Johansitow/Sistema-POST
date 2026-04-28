/**
 * FeatureFlagsService — API client para feature flags
 */

import api from './api';

export interface FeatureFlag {
  id:          number;
  nombre:      string;
  descripcion: string | null;
  habilitado:  boolean;
  scope:       string;
  metadata:    Record<string, unknown> | null;
  asignaciones: FeatureFlagAsignacion[];
  fecha_creacion:    string;
  fecha_modificacion: string;
}

export interface FeatureFlagAsignacion {
  id:              number;
  id_feature_flag: number;
  contexto:        string;
  habilitado:      boolean;
}

export interface CreateFeatureFlagDto {
  nombre:      string;
  descripcion?: string;
  habilitado?:  boolean;
  scope?:       'global' | 'contexto';
  metadata?:    Record<string, unknown>;
}

export const featureFlagsService = {
  /** Lista todos los flags (solo admin) */
  listar: async (): Promise<FeatureFlag[]> => {
    const { data } = await api.get<{ success: boolean; data: FeatureFlag[] }>('/feature-flags');
    return data.data;
  },

  /** Obtiene flags para el cliente actual (todos los usuarios) */
  getClientFlags: async (contexto?: string): Promise<Record<string, boolean>> => {
    const params = contexto ? { contexto } : {};
    const { data } = await api.get<{ success: boolean; data: Record<string, boolean> }>(
      '/feature-flags/client', { params }
    );
    return data.data;
  },

  crear: async (dto: CreateFeatureFlagDto): Promise<FeatureFlag> => {
    const { data } = await api.post<{ success: boolean; data: FeatureFlag }>('/feature-flags', dto);
    return data.data;
  },

  actualizar: async (id: number, dto: Partial<CreateFeatureFlagDto>): Promise<FeatureFlag> => {
    const { data } = await api.put<{ success: boolean; data: FeatureFlag }>(`/feature-flags/${id}`, dto);
    return data.data;
  },

  eliminar: async (id: number): Promise<void> => {
    await api.delete(`/feature-flags/${id}`);
  },

  setAsignacion: async (id: number, contexto: string, habilitado: boolean): Promise<FeatureFlagAsignacion> => {
    const { data } = await api.put<{ success: boolean; data: FeatureFlagAsignacion }>(
      `/feature-flags/${id}/asignaciones`, { contexto, habilitado }
    );
    return data.data;
  },

  eliminarAsignacion: async (id: number, contexto: string): Promise<void> => {
    await api.delete(`/feature-flags/${id}/asignaciones/${contexto}`);
  },
};
