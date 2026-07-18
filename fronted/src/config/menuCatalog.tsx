/**
 * menuCatalog — catálogo único de módulos del menú principal (path + texto + ícono)
 *
 * Antes existían tres listas hardcodeadas y divergentes (menuGroups en Layout.tsx,
 * NAV_CATALOG en Apariencia.tsx) que se desincronizaron (bug: Cocina/KDS faltaba
 * en una de ellas). Esta es la única fuente de verdad para "qué módulos existen".
 *
 * La subdivisión (grupo), el orden y la visibilidad de cada módulo SÍ son editables
 * por el admin — esos viven en la tabla GrupoMenu/AsignacionModuloMenu (backend),
 * consumida por menuStore. Este catálogo solo resuelve texto/ícono por path.
 */

import {
  Dashboard, ShoppingCart, RestaurantMenu, People, LocalShipping,
  Inventory, MenuBook, PlaylistAdd, Receipt, PointOfSale, Assessment,
} from '@mui/icons-material';

export interface ModuloMenu {
  path: string;
  text: string;
  icon: JSX.Element;
}

export const MODULE_CATALOG: ModuloMenu[] = [
  { path: '/dashboard',      text: 'Dashboard',     icon: <Dashboard /> },
  { path: '/ordenes',        text: 'Órdenes',       icon: <ShoppingCart /> },
  { path: '/cocina',         text: 'Cocina (KDS)',  icon: <RestaurantMenu /> },
  { path: '/clientes',       text: 'Clientes',      icon: <People /> },
  { path: '/proveedores',    text: 'Proveedores',   icon: <LocalShipping /> },
  { path: '/inventario',     text: 'Inventario',    icon: <Inventory /> },
  { path: '/recetas',        text: 'Recetas',       icon: <MenuBook /> },
  { path: '/listas-compras', text: 'Lista Compras', icon: <PlaylistAdd /> },
  { path: '/facturas',       text: 'Facturas',      icon: <Receipt /> },
  { path: '/caja',           text: 'Caja',          icon: <PointOfSale /> },
  { path: '/reportes',       text: 'Reportes',      icon: <Assessment /> },
];

export const MODULE_MAP: Record<string, ModuloMenu> = Object.fromEntries(
  MODULE_CATALOG.map(m => [m.path, m])
);

/**
 * Estructura de respaldo — usada solo si el backend no devuelve grupos
 * (falla de red, o la tabla está vacía). Reproduce el layout de siempre
 * para que el sidebar nunca quede en blanco.
 */
export const DEFAULT_GROUPS: { nombre: string; paths: string[] }[] = [
  { nombre: 'Principal',  paths: ['/dashboard'] },
  { nombre: 'Ventas',     paths: ['/ordenes', '/cocina', '/clientes', '/proveedores'] },
  { nombre: 'Inventario', paths: ['/inventario', '/recetas', '/listas-compras'] },
  { nombre: 'Finanzas',   paths: ['/facturas', '/caja', '/reportes'] },
];
