/**
 * admin.service.ts — Cliente para los endpoints de metadatos de administración
 *
 * GET /api/v1/admin/modules  → páginas de admin de plugins activos
 * GET /api/v1/admin/plugins  → lista de plugins activos
 */

import api from './api';

export interface AdminPage {
  label:         string;
  path:          string;
  icon?:         string;
  order?:        number;
  requiredFlag?: string;
}

export interface PluginInfo {
  name:        string;
  version:     string;
  description: string;
  featureFlag: string | null;
  adminPages:  number;
  permissions: number;
}

export const adminService = {
  async getModules(): Promise<AdminPage[]> {
    const res = await api.get<{ success: boolean; data: AdminPage[] }>('/admin/modules');
    return res.data.data;
  },

  async getPlugins(): Promise<PluginInfo[]> {
    const res = await api.get<{ success: boolean; data: PluginInfo[] }>('/admin/plugins');
    return res.data.data;
  },
};
