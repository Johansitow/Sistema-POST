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

import { lazy, Suspense, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Layout from './components/layout/Layout';
import { useAuthStore } from './store/useStore';
import { useBrandingStore } from './store/brandingStore';
import { ErrorBoundary }       from './components/common/ErrorBoundary';
import { GlobalSnackbar }      from './components/common/GlobalSnackbar';
import { RequireRestaurante }  from './components/common/RequireRestaurante';
import { OnboardingGuard }     from './components/common/OnboardingGuard';

// ── Páginas principales (bundle inicial) ─────────────────────────────────────

import { Login }        from './pages/Login';
import { Onboarding }   from './pages/Onboarding';
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
import { Cocina }       from './pages/Cocina';
import { Perfil }       from './pages/Perfil';

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
const OnboardingPrueba = lazy(() => import('./pages/admin/OnboardingPrueba').then(m => ({ default: m.OnboardingPrueba })));

// Panel del dueño/admin del grupo — no requiere superadmin (la API valida el rol)
const MiGrupo = lazy(() => import('./pages/MiGrupo'));

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
 *
 * `permiso` (opcional): si se indica, además de superadmin también pasan
 * los usuarios cuyo rol tenga ese código de permiso — igual que hace el
 * backend vía `requirePermission()`. Sin `permiso`, el comportamiento es
 * el de siempre: solo superadmin.
 */
const AdminGuard: React.FC<{ children: React.ReactNode; permiso?: string }> = ({ children, permiso }) => {
  const { isAuthenticated, isSuperAdmin, hasPermission } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login"     replace />;
  const autorizado = permiso ? hasPermission(permiso) : isSuperAdmin();
  if (!autorizado) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const colorPrimario = useBrandingStore(s => s.colorPrimario);
  const loadBranding  = useBrandingStore(s => s.loadBranding);

  // Carga la marca (nombre/color/logo) una sola vez, antes de que se monten
  // Login o Layout — ambos la necesitan y ninguno debe disparar el fetch dos veces.
  useEffect(() => { loadBranding(); }, [loadBranding]);

  // Tema MUI centralizado: color_primario alimenta palette.primary en toda la app
  // (botones, tabs, switches, etc.), en vez de los hex hardcodeados de antes.
  const theme = useMemo(() => createTheme({
    palette: { primary: { main: colorPrimario } },
  }), [colorPrimario]);

  return (
    <ThemeProvider theme={theme}>
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

              {/*
               * /onboarding está FUERA de OnboardingGuard para evitar bucle:
               * el guard redirige aquí, y esta ruta no vuelve a pasar por el guard.
               */}
              <Route path="/onboarding" element={<Onboarding />} />

              {/*
               * OnboardingGuard envuelve todas las rutas que requieren que el
               * onboarding esté completado. Si onboarding_completado=false,
               * redirige a /onboarding antes de renderizar cualquier ruta hija.
               */}
              <Route element={<OnboardingGuard />}>

              {/* Raíz → dashboard */}
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* Sistema principal */}
              <Route path="/dashboard"     element={<Dashboard   />} />
              {/* Perfil del usuario — no requiere sede activa */}
              <Route path="/perfil"        element={<Perfil      />} />
              <Route path="/inventario"      element={<RequireRestaurante><Inventario /></RequireRestaurante>} />
              <Route path="/inventario/:tab" element={<RequireRestaurante><Inventario /></RequireRestaurante>} />
              <Route path="/ordenes"       element={<RequireRestaurante><Ordenes     /></RequireRestaurante>} />
              <Route path="/reportes"      element={<Reportes    />} />
              <Route path="/proveedores"   element={<Proveedores />} />
              <Route path="/facturas"      element={<RequireRestaurante><Facturas    /></RequireRestaurante>} />
              <Route path="/recetas"       element={<RequireRestaurante><Recetas     /></RequireRestaurante>} />
              <Route path="/clientes"      element={<Clientes    />} />
              <Route path="/caja"          element={<RequireRestaurante><CierreCaja  /></RequireRestaurante>} />
              <Route path="/listas-compras" element={<RequireRestaurante><ListaCompras /></RequireRestaurante>} />
              {/* /lotes ya no existe como página propia — redirige a la pestaña Lotes del módulo Inventario */}
              <Route path="/lotes"         element={<Navigate to="/inventario/lotes" replace />} />
              {/* Panel del grupo: compartido entre sucursales (como Reportes) */}
              <Route path="/mi-grupo"      element={<Suspense fallback={<PageFallback />}><MiGrupo /></Suspense>} />
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
                  <AdminGuard permiso="config.sistema">
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
              <Route
                path="/admin/onboarding-prueba"
                element={
                  <AdminGuard>
                    <Suspense fallback={<PageFallback />}><OnboardingPrueba /></Suspense>
                  </AdminGuard>
                }
              />

              </Route>{/* /OnboardingGuard */}

            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />

        </Routes>
        <GlobalSnackbar />
      </BrowserRouter>
    </ErrorBoundary>
    </ThemeProvider>
  );
}
