/**
 * AppBreadcrumbs — Breadcrumb automático basado en la ruta actual
 *
 * Lee `useLocation()` y construye el trail dividiendo el pathname en segmentos.
 * Cada segmento se busca en ROUTE_LABELS. El primer ítem siempre es "Sistema"
 * con enlace a /dashboard.
 *
 * Ejemplos:
 *   /dashboard               → Sistema
 *   /ordenes                 → Sistema / Órdenes
 *   /admin/usuarios          → Sistema / Administración / Usuarios
 *   /admin/configuracion     → Sistema / Administración / Configuración
 *
 * El último ítem del trail no es clicable (es la página actual).
 */

import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Breadcrumbs, Link, Typography } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

/** Etiqueta legible por ruta exacta */
const ROUTE_LABELS: Record<string, string> = {
  '/dashboard':           'Dashboard',
  '/ordenes':             'Órdenes',
  '/inventario':          'Inventario',
  '/recetas':             'Recetas',
  '/clientes':            'Clientes',
  '/proveedores':         'Proveedores',
  '/facturas':            'Facturas',
  '/caja':                'Caja',
  '/lotes':               'Lotes',
  '/reportes':            'Reportes',
  '/listas-compras':      'Lista de Compras',
  '/admin':               'Administración',
  '/admin/usuarios':      'Usuarios',
  '/admin/auditoria':     'Auditoría',
  '/admin/configuracion': 'Configuración',
  '/admin/restaurantes':  'Restaurantes',
  '/admin/categorias':    'Categorías',
  '/admin/feature-flags': 'Feature Flags',
  '/admin/plantillas':    'Plantillas',
  '/admin/ui-config':     'UI Config',
};

interface Crumb {
  label: string;
  path:  string;
}

/**
 * Construye el trail de breadcrumbs a partir del pathname.
 * Siempre incluye "Sistema" como raíz.
 */
function buildCrumbs(pathname: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: 'Sistema', path: '/dashboard' }];

  // Acumular segmentos: "/admin/usuarios" → ["/admin", "/admin/usuarios"]
  const segments = pathname.split('/').filter(Boolean);
  let accumulated = '';

  for (const segment of segments) {
    accumulated += `/${segment}`;
    const label = ROUTE_LABELS[accumulated];
    if (label) {
      crumbs.push({ label, path: accumulated });
    }
  }

  // Evitar duplicar "Sistema" si ya estamos en /dashboard
  if (crumbs.length === 1 && pathname === '/dashboard') return crumbs;

  return crumbs;
}

export function AppBreadcrumbs() {
  const { pathname } = useLocation();
  const crumbs = buildCrumbs(pathname);

  // Sin breadcrumb en dashboard (innecesario) o si solo hay un ítem
  if (crumbs.length <= 1) return null;

  return (
    <Breadcrumbs
      separator={<NavigateNextIcon fontSize="small" />}
      aria-label="breadcrumb"
      sx={{ mb: 2, '& .MuiBreadcrumbs-separator': { mx: 0.5 } }}
    >
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return isLast ? (
          <Typography
            key={crumb.path}
            variant="body2"
            color="text.primary"
            fontWeight={600}
          >
            {crumb.label}
          </Typography>
        ) : (
          <Link
            key={crumb.path}
            component={RouterLink}
            to={crumb.path}
            underline="hover"
            variant="body2"
            color="text.secondary"
            sx={{ '&:hover': { color: 'primary.main' } }}
          >
            {crumb.label}
          </Link>
        );
      })}
    </Breadcrumbs>
  );
}
