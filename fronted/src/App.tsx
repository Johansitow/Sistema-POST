/**
 * App.tsx — Rutas anidadas con un único Layout compartido
 *
 * Patrón React Router v6: nested routes con <Outlet />.
 *
 * Por qué este patrón elimina el problema de layouts separados:
 *   - Layout es un SOLO componente que nunca se desmonta al navegar.
 *   - React Router solo re-renderiza el <Outlet /> (la página activa).
 *   - El sidebar, AppBar, estado de colapso, alertas, etc. persisten.
 *
 * Estructura de rutas:
 *   /login                  → público, sin layout
 *   /                       → PrivateGuard → Layout → Outlet
 *     /dashboard
 *     /ordenes, /inventario, etc.
 *     /admin/*              → AdminGuard (adicional en el elemento)
 *
 * Las páginas de admin usan React.lazy() para no inflar el bundle inicial.
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import Layout from './components/layout/Layout';
import { useAuthStore } from './store/useStore';
import { ErrorBoundary }       from './components/common/ErrorBoundary';
import { GlobalSnackbar }      from './components/common/GlobalSnackbar';
import { RequireRestaurante }  from './components/common/RequireRestaurante';

// ── Páginas principales (bundle inicial) ─────────────────────────────────────

import { Login }        from './pages/Login';
import { Dashboard }    from './pages/Dashboard';
import { Inventario }   from './pages/Inventario';
import { Ordenes }      from './pages/Ordenes';
import { Reportes }     from './pages/Reportes';
import { Clientes }     from './pages/Clientes';
import { Proveedores }  from './pages/Proveedores';
import { Facturas }     from './pages/Facturas';
import { Recetas }      from './pages/Recetas';
import { CierreCaja }   from './pages/CierreCaja';
import { ListaCompras } from './pages/ListaCompras';
import { Lotes }        from './pages/Lotes';
import { OrdenesGrupo } from './pages/OrdenesGrupo';
import { Cocina }       from './pages/Cocina';

// ── Páginas de admin (lazy: solo se cargan al navegar a /admin/*) ─────────────

const Usuarios        = lazy(() => import('./pages/admin/Usuarios'));
const Auditoria       = lazy(() => import('./pages/admin/Auditoria').then(m => ({ default: m.Auditoria })));
const Configuracion   = lazy(() => import('./pages/admin/Configuracion').then(m => ({ default: m.Configuracion })));
const Restaurantes    = lazy(() => import('./pages/admin/Restaurantes').then(m => ({ default: m.Restaurantes })));
const Categorias      = lazy(() => import('./pages/admin/Categorias').then(m => ({ default: m.Categorias })));
const FeatureFlags    = lazy(() => import('./pages/admin/FeatureFlags').then(m => ({ default: m.FeatureFlags })));
const Plantillas      = lazy(() => import('./pages/admin/Plantillas').then(m => ({ default: m.Plantillas })));
const UiConfiguracion = lazy(() => import('./pages/admin/UiConfiguracion'));
const Permisos        = lazy(() => import('./pages/admin/Permisos').then(m => ({ default: m.Permisos })));
const Apariencia      = lazy(() => import('./pages/admin/Apariencia'));
const GruposNegocio   = lazy(() => import('./pages/admin/GruposNegocio'));

// ── Fallback mientras el chunk lazy se descarga ────────────────────────────────

const PageFallback = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
    <CircularProgress />
  </Box>
);

// ── Guards ────────────────────────────────────────────────────────────────────

/**
 * PrivateGuard — Redirige a /login si no hay sesión activa.
 * Usa <Outlet /> para que funcione como route layout element.
 */
const PrivateGuard: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

/**
 * AdminGuard — Bloquea rutas /admin si el usuario no es superadmin.
 * Se coloca como wrapper del element de cada ruta admin (no como layout).
 */
const AdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isSuperAdmin } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login"     replace />;
  if (!isSuperAdmin())  return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>

          {/* ── Pública ─────────────────────────────────────────────────── */}
          <Route path="/login" element={<Login />} />

          {/* ── Privadas — Layout persiste en TODAS estas rutas ─────────── */}
          {/*                                                                 */}
          {/* Al usar <Route element={<Layout />}> con rutas hijas,           */}
          {/* React Router monta Layout UNA SOLA VEZ y solo re-renderiza      */}
          {/* el <Outlet /> al cambiar de ruta. El sidebar nunca se remonta.  */}

          <Route element={<PrivateGuard />}>
            <Route element={<Layout />}>

              {/* Raíz → dashboard */}
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* Sistema principal */}
              <Route path="/dashboard"     element={<Dashboard   />} />
              <Route path="/inventario"    element={<RequireRestaurante><Inventario  /></RequireRestaurante>} />
              <Route path="/ordenes"       element={<RequireRestaurante><Ordenes     /></RequireRestaurante>} />
              <Route path="/reportes"      element={<Reportes    />} />
              <Route path="/proveedores"   element={<Proveedores />} />
              <Route path="/facturas"      element={<RequireRestaurante><Facturas    /></RequireRestaurante>} />
              <Route path="/recetas"       element={<RequireRestaurante><Recetas     /></RequireRestaurante>} />
              <Route path="/clientes"      element={<Clientes    />} />
              <Route path="/caja"          element={<RequireRestaurante><CierreCaja  /></RequireRestaurante>} />
              <Route path="/listas-compras" element={<RequireRestaurante><ListaCompras /></RequireRestaurante>} />
              <Route path="/lotes"         element={<RequireRestaurante><Lotes         /></RequireRestaurante>} />
              <Route path="/ordenes-grupo" element={<OrdenesGrupo  />} />
              <Route path="/cocina"       element={<RequireRestaurante><Cocina /></RequireRestaurante>} />

              {/* Administración — AdminGuard al nivel del element, no del Route.     */}
              {/* Esto mantiene el mismo Layout pero añade la verificación de permisos */}
              {/* sin crear un árbol de componentes separado.                          */}
              <Route
                path="/admin/usuarios"
                element={
                  <AdminGuard>
                    <Suspense fallback={<PageFallback />}><Usuarios /></Suspense>
                  </AdminGuard>
                }
              />
              <Route
                path="/admin/auditoria"
                element={
                  <AdminGuard>
                    <Suspense fallback={<PageFallback />}><Auditoria /></Suspense>
                  </AdminGuard>
                }
              />
              <Route
                path="/admin/configuracion"
                element={
                  <AdminGuard>
                    <Suspense fallback={<PageFallback />}><Configuracion /></Suspense>
                  </AdminGuard>
                }
              />
              <Route
                path="/admin/restaurantes"
                element={
                  <AdminGuard>
                    <Suspense fallback={<PageFallback />}><Restaurantes /></Suspense>
                  </AdminGuard>
                }
              />
              <Route
                path="/admin/categorias"
                element={
                  <AdminGuard>
                    <Suspense fallback={<PageFallback />}><Categorias /></Suspense>
                  </AdminGuard>
                }
              />
              <Route
                path="/admin/feature-flags"
                element={
                  <AdminGuard>
                    <Suspense fallback={<PageFallback />}><FeatureFlags /></Suspense>
                  </AdminGuard>
                }
              />
              <Route
                path="/admin/plantillas"
                element={
                  <AdminGuard>
                    <Suspense fallback={<PageFallback />}><Plantillas /></Suspense>
                  </AdminGuard>
                }
              />
              <Route
                path="/admin/ui-config"
                element={
                  <AdminGuard>
                    <Suspense fallback={<PageFallback />}><UiConfiguracion /></Suspense>
                  </AdminGuard>
                }
              />
              <Route
                path="/admin/permisos"
                element={
                  <AdminGuard>
                    <Suspense fallback={<PageFallback />}><Permisos /></Suspense>
                  </AdminGuard>
                }
              />
              <Route
                path="/admin/apariencia"
                element={
                  <AdminGuard>
                    <Suspense fallback={<PageFallback />}><Apariencia /></Suspense>
                  </AdminGuard>
                }
              />
              <Route
                path="/admin/grupos"
                element={
                  <AdminGuard>
                    <Suspense fallback={<PageFallback />}><GruposNegocio /></Suspense>
                  </AdminGuard>
                }
              />

            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />

        </Routes>
        <GlobalSnackbar />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
