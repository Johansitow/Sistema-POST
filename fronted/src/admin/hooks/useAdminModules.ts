/**
 * useAdminModules — Hook que obtiene las páginas de admin desde los plugins activos
 *
 * Llama a GET /api/v1/admin/modules y combina el resultado con las páginas
 * core siempre presentes (Configuración, Auditoría, Feature Flags).
 *
 * Las páginas core tienen orden < 100.
 * Las páginas de plugins dinámicos tienen el orden que declara el plugin.
 */

import { useEffect, useState } from 'react';
import { adminService, type AdminPage } from '../../services/admin.service';
import { useAuthStore } from '../../store/useStore';

/** Páginas core que siempre aparecen en el panel de administración */
const CORE_PAGES: AdminPage[] = [
  { label: 'Usuarios',     path: '/admin/usuarios',     icon: 'People',         order: 80 },
  { label: 'Restaurantes', path: '/admin/restaurantes', icon: 'Restaurant',     order: 81 },
  { label: 'Permisos',     path: '/admin/permisos',     icon: 'Lock',           order: 82 },
  { label: 'Funciones',    path: '/admin/feature-flags', icon: 'Flag',          order: 83 },
  { label: 'Parámetros',   path: '/admin/configuracion', icon: 'Settings',      order: 84 },
  { label: 'Categorías',   path: '/admin/categorias',    icon: 'Category',      order: 85 },
  { label: 'Apariencia',   path: '/admin/apariencia',    icon: 'Palette',       order: 86 },
  { label: 'Impresión',    path: '/admin/plantillas',    icon: 'Print',         order: 87 },
  { label: 'Auditoría',    path: '/admin/auditoria',     icon: 'ManageSearch',  order: 93 },
];

export function useAdminModules() {
  const { isSuperAdmin } = useAuthStore();
  const [pages,   setPages]   = useState<AdminPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperAdmin()) {
      setPages([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    adminService
      .getModules()
      .then(dynamicPages => {
        if (cancelled) return;

        // Combinar páginas de plugins con las core, eliminar duplicados por path
        const all = [...dynamicPages, ...CORE_PAGES];
        const unique = Array.from(
          new Map(all.map(p => [p.path, p])).values()
        );
        // Ordenar por order ascendente
        unique.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
        setPages(unique);
      })
      .catch(err => {
        if (cancelled) return;
        // Si falla la API, al menos mostrar las páginas core
        setPages(CORE_PAGES);
        setError(err?.message ?? 'Error cargando módulos de admin');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isSuperAdmin]);

  return { pages, loading, error };
}
