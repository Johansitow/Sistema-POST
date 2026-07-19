/**
 * Layout — AppLayout único que envuelve TODAS las rutas privadas.
 *
 * Usa <Outlet /> de React Router v6 en lugar de {children}, lo que garantiza
 * que el layout NUNCA se desmonta al navegar entre rutas (incluidas /admin/*).
 * Esto es la raíz del patrón de "layouts compartidos" en React Router v6.
 *
 * Sidebar dinámico:
 *   - Si pathname comienza con /admin → muestra menú de Administración
 *   - En otro caso                   → muestra menú principal del sistema
 *
 * La transición entre modos es instantánea y suave porque es el mismo
 * componente React — no hay desmonte/remonte.
 */

import { useState, useEffect, useMemo } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  AppBar, Box, Drawer, IconButton, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Toolbar,
  Typography, Avatar, Menu, MenuItem, Divider, Tooltip, Chip,
  Backdrop, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, Button,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import {
  Menu as MenuIcon, AdminPanelSettings, Logout, Person, KeyboardArrowDown,
  ManageSearch, Settings, ChevronLeft,
  Category, Flag, Print, Lock, Palette,
  ArrowBack, AccountTree, SupervisorAccount,
  PlayCircleOutline, Groups,
} from '@mui/icons-material';
import { useAuthStore, useStore } from '../../store/useStore';
import { useUIStore }   from '../../store/uiStore';
import { authService }  from '../../services/auth.service';
import { People, Business } from '@mui/icons-material';
import { useFeatureFlagStore, useFeatureFlag } from '../../store/featureFlagStore';
import { useBrandingStore } from '../../store/brandingStore';
import { useMenuStore } from '../../store/menuStore';
import type { MenuGrupoDTO } from '../../services/menu.service';
import { MODULE_CATALOG, MODULE_MAP, DEFAULT_GROUPS, type ModuloMenu } from '../../config/menuCatalog';
import { useRestauranteStore, type RestauranteMini, type GrupoMini } from '../../store/restauranteStore';
import { gruposNegocioService, type GrupoNegocio } from '../../services/grupos-negocio.service';
import { miGrupoService } from '../../services/mi-grupo.service';
import { socket, connectGlobal } from '../../lib/socket';
// useAdminModules removed — admin sidebar now uses static groups
import { AppBreadcrumbs } from '../common/AppBreadcrumbs';
import NotificationsMenu from './NotificationsMenu';

const DRAWER_WIDTH    = 248;
const COLLAPSED_WIDTH = 64;

// ── Menú principal ────────────────────────────────────────────────────────────
// Las subdivisiones (grupo, orden, visibilidad) vienen de la API /menu — editables
// desde Personalización → Menú lateral. MODULE_CATALOG solo resuelve texto/ícono
// por path. Ver buildEffectiveGroups() más abajo.

const menuItems = MODULE_CATALOG;

// ── Grupos del panel de administración (estáticos) ────────────────────────────

const ADMIN_GROUPS = [
  {
    label: 'Gestión',
    items: [
      { text: 'Usuarios',     icon: <People />,         path: '/admin/usuarios'     },
      { text: 'Restaurantes', icon: <Business />,       path: '/admin/restaurantes' },
      { text: 'Grupos',       icon: <AccountTree />,    path: '/admin/grupos'       },
      { text: 'Permisos',     icon: <Lock />,           path: '/admin/permisos'     },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { text: 'Funciones',    icon: <Flag />,                path: '/admin/feature-flags'      },
      { text: 'Parámetros',   icon: <Settings />,            path: '/admin/configuracion'      },
      { text: 'Categorías',   icon: <Category />,            path: '/admin/categorias'         },
      { text: 'Probar configuración', icon: <PlayCircleOutline />, path: '/admin/onboarding-prueba' },
    ],
  },
  {
    label: 'Personalización',
    items: [
      { text: 'Apariencia',   icon: <Palette />,        path: '/admin/apariencia'   },
      { text: 'Impresión',    icon: <Print />,          path: '/admin/plantillas'   },
    ],
  },
];

const ADMIN_STANDALONE = [
  { text: 'Auditoría', icon: <ManageSearch />, path: '/admin/auditoria' },
];

// Flat list for AppBar title lookup
const adminAllItems = [
  ...ADMIN_GROUPS.flatMap(g => g.items),
  ...ADMIN_STANDALONE,
];

// ── Helper: buildEffectiveGroups ──────────────────────────────────────────────
//
// Construye los grupos a renderizar a partir de la API /menu (menuStore).
// Si no hay datos (falla de red, o tabla vacía) cae a DEFAULT_GROUPS para que
// el sidebar nunca quede en blanco. `ocultosExtra` son paths escondidos por
// feature flags (no por configuración del admin).

type MenuGroup = { label: string; items: ModuloMenu[] };

function buildEffectiveGroups(dbGrupos: MenuGrupoDTO[], ocultosExtra: string[]): MenuGroup[] {
  const fuente = dbGrupos.length > 0
    ? dbGrupos
        .slice().sort((a, b) => a.orden - b.orden)
        .map(g => ({
          nombre: g.nombre,
          paths: g.items
            .filter(i => i.visible)
            .slice().sort((a, b) => a.orden - b.orden)
            .map(i => i.path),
        }))
    : DEFAULT_GROUPS;

  return fuente
    .map(g => ({
      label: g.nombre,
      items: g.paths
        .filter(path => !ocultosExtra.includes(path))
        .map(path => MODULE_MAP[path])
        // Por si un path quedó huérfano (módulo eliminado del código pero no de la DB)
        .filter((m): m is ModuloMenu => Boolean(m)),
    }))
    .filter(g => g.items.length > 0);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(nombre: string) {
  return nombre.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

const DEFAULT_COLOR = '#e53935';

// ── Componente ────────────────────────────────────────────────────────────────

export default function Layout() {
  const theme = useTheme();
  const { nombreSistema, logoUrl } = useBrandingStore();
  const [mobileOpen,    setMobileOpen]    = useState(false);
  const { sidebarCollapsed: collapsed, setSidebarCollapsed: setCollapsed, showToast } = useUIStore();
  const [anchorEl,      setAnchorEl]      = useState<null | HTMLElement>(null);
  const [restAnchorEl,  setRestAnchorEl]  = useState<null | HTMLElement>(null);
  const [grupoAnchorEl, setGrupoAnchorEl] = useState<null | HTMLElement>(null);
  const [grupos,        setGrupos]        = useState<GrupoNegocio[]>([]);
  const [cambiandoSede, setCambiandoSede] = useState(false);
  const [sedePendiente, setSedePendiente] = useState<RestauranteMini | null>(null);
  const [esAdminGrupo,  setEsAdminGrupo]  = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { usuario, logout, isSuperAdmin } = useAuthStore();
  const { loadFlags, reloadFlags, loaded: flagsLoaded } = useFeatureFlagStore();
  const { grupos: menuGrupos, loadMenu, reloadMenu } = useMenuStore();

  const showListasCompras    = useFeatureFlag('listas_compras');
  const showRecetas          = useFeatureFlag('recetas');
  const showClientes         = useFeatureFlag('clientes_fidelizacion');

  const { restaurantes, activo: restauranteActivo,
          cargar: cargarRestaurantes, setActivo: setRestActivo,
          grupoActivo, setGrupoActivo,
          clear: clearRestaurantes } = useRestauranteStore();

  // ── Detectar sección admin ─────────────────────────────────────────────────
  const isAdminSection = location.pathname.startsWith('/admin');

  // Admin sidebar usa grupos estáticos (ADMIN_GROUPS + ADMIN_STANDALONE)

  // ── Efectos ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!flagsLoaded) loadFlags();
  }, [flagsLoaded, loadFlags]);

  useEffect(() => {
    const disconnect = connectGlobal();
    const handleFlagChanged = () => reloadFlags();
    socket.on('FEATURE_FLAG_CHANGED', handleFlagChanged);
    return () => {
      socket.off('FEATURE_FLAG_CHANGED', handleFlagChanged);
      disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { cargarRestaurantes(grupoActivo?.id); }, [cargarRestaurantes, grupoActivo?.id]);

  useEffect(() => {
    if (!isSuperAdmin()) return;
    gruposNegocioService.listar().then(setGrupos).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadMenu(); }, [loadMenu]);

  // ¿Puede administrar su grupo? (owner/admin del grupo o superadmin).
  // El backend decide (requireGrupoAdmin); un 403 simplemente oculta la entrada.
  useEffect(() => {
    let alive = true;
    if (!usuario?.id) { setEsAdminGrupo(false); return; }
    miGrupoService.getResumen()
      .then(() => { if (alive) setEsAdminGrupo(true); })
      .catch(() => { if (alive) setEsAdminGrupo(false); });
    return () => { alive = false; };
  }, [usuario?.id]);

  // Refresca el menú al volver a esta pestaña (cambio de pestaña, minimizar,
  // o restauración desde bfcache) — cubre el caso de dejar el sidebar abierto
  // en una sesión mientras otro admin (u otra pestaña propia) edita el menú,
  // sin depender de un socket dedicado para esto.
  useEffect(() => {
    const handleVisible = () => { if (document.visibilityState === 'visible') reloadMenu(); };
    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('pageshow', handleVisible);
    return () => {
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('pageshow', handleVisible);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Computados ─────────────────────────────────────────────────────────────

  const rolColor    = usuario?.rol?.color || DEFAULT_COLOR;
  const drawerWidth = collapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH;

  const effectiveGroups = useMemo(() => {
    const flagOcultos: string[] = [];
    if (!showListasCompras) flagOcultos.push('/listas-compras');
    if (!showRecetas)       flagOcultos.push('/recetas');
    if (!showClientes)      flagOcultos.push('/clientes');
    return buildEffectiveGroups(menuGrupos, flagOcultos);
  }, [menuGrupos, showListasCompras, showRecetas, showClientes]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    try { await authService.logout(); } catch { /* ignorar */ }
    logout();
    clearRestaurantes();
    navigate('/login');
  };

  // Cambio de sucursal: no-op si es la misma sede; al cambiar, el key del
  // contenedor <main> re-monta la página activa y todo se recarga con el
  // nuevo X-Restaurante-Id. El backdrop cubre el remount para evitar el
  // flash de datos de la sede anterior.
  const aplicarCambioSede = (r: RestauranteMini) => {
    setCambiandoSede(true);
    setRestActivo(r);
    showToast(`Ahora estás en ${r.nombre}`, 'success');
    window.setTimeout(() => setCambiandoSede(false), 450);
  };

  const handleCambiarSede = (r: RestauranteMini) => {
    setRestAnchorEl(null);
    if (r.id === restauranteActivo?.id) return;
    // Si hay una orden a medio construir, confirmar antes de descartarla
    if (useStore.getState().ordenActual !== null) {
      setSedePendiente(r);
      return;
    }
    aplicarCambioSede(r);
  };

  // ── Sub-componente NavItem ─────────────────────────────────────────────────

  const NavItem = ({
    item,
    activeColor = theme.palette.primary.main,
    activeBg    = `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)}, ${alpha(theme.palette.primary.main, 0.05)})`,
  }: {
    item: { text: string; icon: React.ReactNode; path: string };
    activeColor?: string;
    activeBg?: string;
  }) => {
    // El ítem de Administración se activa en cualquier ruta /admin/*
    const isAdminEntry = item.path === '/admin/usuarios';
    const active = isAdminEntry
      ? location.pathname.startsWith('/admin')
      : location.pathname === item.path ||
        (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
    return (
      <ListItem disablePadding sx={{ mb: 0.5 }}>
        <Tooltip title={collapsed ? item.text : ''} placement="right" arrow>
          <ListItemButton
            component={Link} to={item.path} selected={active}
            sx={{
              borderRadius: 2,
              justifyContent: collapsed ? 'center' : 'flex-start',
              px: collapsed ? 1 : 2,
              minHeight: 44,
              '&.Mui-selected': {
                background: activeBg,
                borderLeft: `3px solid ${activeColor}`,
                '& .MuiListItemIcon-root': { color: activeColor },
                '& .MuiListItemText-primary': { color: activeColor, fontWeight: 700 },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, mr: collapsed ? 0 : 1 }}>
              {item.icon}
            </ListItemIcon>
            {!collapsed && <ListItemText primary={item.text} />}
          </ListItemButton>
        </Tooltip>
      </ListItem>
    );
  };

  // ── Sidebar: modo PRINCIPAL ────────────────────────────────────────────────

  const mainDrawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Logo */}
      <Toolbar sx={{
        background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
        justifyContent: collapsed ? 'center' : 'flex-start',
        minHeight: '64px !important',
        px: collapsed ? 1 : 2,
        transition: 'padding 0.2s',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 1.5 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          }}>
            {logoUrl ? (
              <Box component="img" src={logoUrl} alt={nombreSistema}
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <Typography sx={{ color: 'white', fontSize: '1.1rem' }}>🍽</Typography>
            )}
          </Box>
          {!collapsed && (
            <Box>
              <Typography variant="subtitle1" fontWeight={800} sx={{ color: 'white', lineHeight: 1.2 }}>
                {restauranteActivo?.nombre ?? nombreSistema}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                {restauranteActivo ? nombreSistema : 'Panel de control'}
              </Typography>
            </Box>
          )}
        </Box>
      </Toolbar>

      {/* Menú principal */}
      <Box sx={{ px: collapsed ? 0.5 : 1.5, pt: 2, flexGrow: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {effectiveGroups.map((group, idx) => (
          <Box key={group.label}>
            {idx > 0 && <Divider sx={{ my: 1, opacity: 0.5 }} />}
            {!collapsed && (
              <Typography variant="overline" sx={{ px: 1, color: 'text.disabled', fontSize: '0.65rem' }}>
                {group.label}
              </Typography>
            )}
            <List dense>
              {group.items.map(item => <NavItem key={item.text} item={item} />)}
            </List>
          </Box>
        ))}

        {/* Mi Grupo — panel del dueño/admin del grupo (compartido entre sedes) */}
        {esAdminGrupo && (
          <>
            <Divider sx={{ my: 1, opacity: 0.5 }} />
            <List dense>
              <NavItem
                item={{ text: 'Mi Grupo', icon: <Groups />, path: '/mi-grupo' }}
                activeColor="#7c3aed"
                activeBg="rgba(124,58,237,0.1)"
              />
            </List>
          </>
        )}

        {/* Acceso a administración — un solo ítem que lleva a /admin/usuarios */}
        {isSuperAdmin() && (
          <>
            <Divider sx={{ my: 1, opacity: 0.5 }} />
            <List dense>
              <NavItem
                item={{ text: 'Administración', icon: <AdminPanelSettings />, path: '/admin/usuarios' }}
                activeColor="#ff9800"
                activeBg="rgba(255,152,0,0.1)"
              />
            </List>
          </>
        )}
      </Box>

      {/* Info usuario */}
      {!collapsed ? (
        <Box sx={{ p: 2, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ width: 36, height: 36, fontSize: '0.8rem', fontWeight: 700, bgcolor: rolColor }}>
              {usuario ? getInitials(usuario.nombre_completo) : '?'}
            </Avatar>
            <Box sx={{ overflow: 'hidden', flexGrow: 1 }}>
              <Typography variant="body2" fontWeight={600} noWrap>{usuario?.nombre_completo}</Typography>
              <Chip label={usuario?.rol?.nombre} size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: `${rolColor}22` }} />
            </Box>
          </Box>
        </Box>
      ) : (
        <Box sx={{ py: 1.5, display: 'flex', justifyContent: 'center', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
          <Tooltip title={usuario?.nombre_completo ?? ''} placement="right" arrow>
            <Avatar sx={{ width: 36, height: 36, fontSize: '0.8rem', fontWeight: 700, bgcolor: rolColor, cursor: 'pointer' }}>
              {usuario ? getInitials(usuario.nombre_completo) : '?'}
            </Avatar>
          </Tooltip>
        </Box>
      )}
    </Box>
  );

  // ── Sidebar: modo ADMIN ────────────────────────────────────────────────────
  //
  // Cuando pathname comienza con /admin, el sidebar muestra exclusivamente
  // los módulos de administración. Incluye un botón "← Sistema" para volver.
  // Los ítems vienen del hook useAdminModules() (plugins activos + core pages).

  const adminDrawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Cabecera: indica que estamos en modo admin */}
      <Toolbar sx={{
        background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
        justifyContent: collapsed ? 'center' : 'flex-start',
        minHeight: '64px !important',
        px: collapsed ? 1 : 2,
        transition: 'padding 0.2s',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 1.5 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #ff9800, #f57c00)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AdminPanelSettings sx={{ color: 'white', fontSize: 20 }} />
          </Box>
          {!collapsed && (
            <Box>
              <Typography variant="subtitle1" fontWeight={800} sx={{ color: 'white', lineHeight: 1.2 }}>
                Administración
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                Panel de control
              </Typography>
            </Box>
          )}
        </Box>
      </Toolbar>

      {/* Botón volver al sistema */}
      <Box sx={{ px: collapsed ? 0.5 : 1.5, pt: 1.5 }}>
        <Tooltip title={collapsed ? 'Volver al sistema' : ''} placement="right" arrow>
          <ListItemButton
            component={Link}
            to="/dashboard"
            sx={{
              borderRadius: 2,
              justifyContent: collapsed ? 'center' : 'flex-start',
              px: collapsed ? 1 : 2,
              minHeight: 40,
              color: 'text.secondary',
              mb: 0.5,
              '&:hover': { color: 'primary.main' },
            }}
          >
            <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, mr: collapsed ? 0 : 1 }}>
              <ArrowBack fontSize="small" />
            </ListItemIcon>
            {!collapsed && (
              <ListItemText
                primary="Volver al sistema"
                primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: 500 }}
              />
            )}
          </ListItemButton>
        </Tooltip>
        <Divider sx={{ mt: 0.5 }} />
      </Box>

      {/* Grupos de administración (estáticos) */}
      <Box sx={{ px: collapsed ? 0.5 : 1.5, pt: 1, flexGrow: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {ADMIN_GROUPS.map((group, idx) => (
          <Box key={group.label}>
            {idx > 0 && <Divider sx={{ my: 1, opacity: 0.5 }} />}
            {!collapsed && (
              <Typography variant="overline"
                sx={{ px: 1, color: 'text.disabled', fontSize: '0.65rem' }}>
                {group.label}
              </Typography>
            )}
            <List dense>
              {group.items.map(item => {
                const active = location.pathname === item.path ||
                               location.pathname.startsWith(item.path + '/');
                return (
                  <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
                    <Tooltip title={collapsed ? item.text : ''} placement="right" arrow>
                      <ListItemButton
                        component={Link} to={item.path} selected={active}
                        sx={{
                          borderRadius: 2,
                          justifyContent: collapsed ? 'center' : 'flex-start',
                          px: collapsed ? 1 : 2,
                          minHeight: 44,
                          '&.Mui-selected': {
                            background: 'rgba(255,152,0,0.12)',
                            borderLeft: '3px solid #ff9800',
                            '& .MuiListItemIcon-root': { color: '#ff9800' },
                            '& .MuiListItemText-primary': { color: '#ff9800', fontWeight: 700 },
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, mr: collapsed ? 0 : 1 }}>
                          {item.icon}
                        </ListItemIcon>
                        {!collapsed && <ListItemText primary={item.text} />}
                      </ListItemButton>
                    </Tooltip>
                  </ListItem>
                );
              })}
            </List>
          </Box>
        ))}

        {/* Auditoría — standalone */}
        <Divider sx={{ my: 1, opacity: 0.5 }} />
        <List dense>
          {ADMIN_STANDALONE.map(item => {
            const active = location.pathname === item.path ||
                           location.pathname.startsWith(item.path + '/');
            return (
              <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
                <Tooltip title={collapsed ? item.text : ''} placement="right" arrow>
                  <ListItemButton
                    component={Link} to={item.path} selected={active}
                    sx={{
                      borderRadius: 2,
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      px: collapsed ? 1 : 2,
                      minHeight: 44,
                      '&.Mui-selected': {
                        background: 'rgba(255,152,0,0.12)',
                        borderLeft: '3px solid #ff9800',
                        '& .MuiListItemIcon-root': { color: '#ff9800' },
                        '& .MuiListItemText-primary': { color: '#ff9800', fontWeight: 700 },
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, mr: collapsed ? 0 : 1 }}>
                      {item.icon}
                    </ListItemIcon>
                    {!collapsed && <ListItemText primary={item.text} />}
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            );
          })}
        </List>
      </Box>

      {/* Info usuario (igual que modo principal) */}
      {!collapsed ? (
        <Box sx={{ p: 2, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ width: 36, height: 36, fontSize: '0.8rem', fontWeight: 700, bgcolor: rolColor }}>
              {usuario ? getInitials(usuario.nombre_completo) : '?'}
            </Avatar>
            <Box sx={{ overflow: 'hidden', flexGrow: 1 }}>
              <Typography variant="body2" fontWeight={600} noWrap>{usuario?.nombre_completo}</Typography>
              <Chip label={usuario?.rol?.nombre} size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: `${rolColor}22` }} />
            </Box>
          </Box>
        </Box>
      ) : (
        <Box sx={{ py: 1.5, display: 'flex', justifyContent: 'center', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
          <Tooltip title={usuario?.nombre_completo ?? ''} placement="right" arrow>
            <Avatar sx={{ width: 36, height: 36, fontSize: '0.8rem', fontWeight: 700, bgcolor: rolColor, cursor: 'pointer' }}>
              {usuario ? getInitials(usuario.nombre_completo) : '?'}
            </Avatar>
          </Tooltip>
        </Box>
      )}
    </Box>
  );

  // ── Selector de contenido del drawer ──────────────────────────────────────
  // Una sola expresión condicional: sin remonte, sin flash.
  const drawer = isAdminSection ? adminDrawer : mainDrawer;

  // ── Título del AppBar ──────────────────────────────────────────────────────

  const allNavItems = [
    ...menuItems,
    ...adminAllItems,
  ];
  const pageTitle = allNavItems.find(m =>
    m.path === location.pathname ||
    (m.path !== '/dashboard' && location.pathname.startsWith(m.path))
  )?.text ?? 'Sistema POS';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex' }}>

      {/* AppBar — único para ambas secciones */}
      <AppBar
        position="fixed" elevation={0}
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml:    { sm: `${drawerWidth}px` },
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(0,0,0,0.07)',
          boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
          color: 'text.primary',
          transition: 'width 0.2s, margin-left 0.2s',
        }}
      >
        <Toolbar>
          {/* Móvil */}
          <IconButton
            edge="start"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ mr: 1, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          {/* Desktop: colapsa/expande */}
          <Tooltip title={collapsed ? 'Expandir menú' : 'Colapsar menú'} placement="bottom">
            <IconButton
              edge="start"
              onClick={() => setCollapsed(!collapsed)}
              sx={{ mr: 2, display: { xs: 'none', sm: 'flex' } }}
            >
              {collapsed ? <MenuIcon /> : <ChevronLeft />}
            </IconButton>
          </Tooltip>

          {/* Indicador de sección admin */}
          {isAdminSection && (
            <Chip
              icon={<AdminPanelSettings sx={{ fontSize: '14px !important' }} />}
              label="Admin"
              size="small"
              sx={{ mr: 1.5, bgcolor: 'rgba(255,152,0,0.12)', color: '#f57c00', fontWeight: 700, fontSize: '0.7rem' }}
            />
          )}

          <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
            {pageTitle}
          </Typography>

          {/* Selector de grupo — solo super admin con más de un grupo */}
          {isSuperAdmin() && grupos.length > 1 && (
            <>
              <Tooltip title="Cambiar grupo de negocio">
                <Box
                  onClick={e => setGrupoAnchorEl(e.currentTarget)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer',
                    px: 1.5, py: 0.5, mr: 1, borderRadius: 2, border: '1px solid',
                    borderColor: 'warning.light',
                    bgcolor: 'rgba(255,152,0,0.06)',
                    '&:hover': { bgcolor: 'rgba(255,152,0,0.12)' },
                  }}
                >
                  <SupervisorAccount fontSize="small" sx={{ color: 'warning.dark' }} />
                  <Typography variant="body2" fontWeight={600} sx={{
                    display: { xs: 'none', md: 'block' },
                    maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: 'warning.dark',
                  }}>
                    {grupoActivo?.nombre ?? 'Todos los grupos'}
                  </Typography>
                  <KeyboardArrowDown fontSize="small" sx={{ color: 'warning.dark' }} />
                </Box>
              </Tooltip>

              <Menu
                anchorEl={grupoAnchorEl}
                open={Boolean(grupoAnchorEl)}
                onClose={() => setGrupoAnchorEl(null)}
                PaperProps={{ sx: { minWidth: 220 } }}
              >
                <Box sx={{ px: 2, py: 1 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    GRUPO DE NEGOCIO
                  </Typography>
                </Box>
                <Divider />
                <MenuItem
                  selected={!grupoActivo}
                  onClick={() => { setGrupoActivo(null); setGrupoAnchorEl(null); }}
                  sx={{ gap: 1.5 }}
                >
                  <SupervisorAccount fontSize="small" sx={{ color: 'text.secondary' }} />
                  <Typography variant="body2" fontWeight={!grupoActivo ? 700 : 400}>
                    Todos los grupos
                  </Typography>
                </MenuItem>
                <Divider />
                {grupos.map(g => (
                  <MenuItem
                    key={g.id}
                    selected={grupoActivo?.id === g.id}
                    onClick={() => {
                      setGrupoActivo({ id: g.id, nombre: g.nombre, logo_url: g.logo_url } as GrupoMini);
                      setGrupoAnchorEl(null);
                    }}
                    sx={{ gap: 1.5 }}
                  >
                    {g.logo_url ? (
                      <Box component="img" src={g.logo_url} alt={g.nombre}
                        sx={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <AccountTree fontSize="small" sx={{ color: 'text.secondary' }} />
                    )}
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body2" fontWeight={grupoActivo?.id === g.id ? 700 : 400}>
                        {g.nombre}
                      </Typography>
                      {g.plan && (
                        <Typography variant="caption" color="text.secondary">{g.plan}</Typography>
                      )}
                    </Box>
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}

          {/* Selector de restaurante — siempre visible como indicador de sede activa.
              Con una sola sede es informativo; con varias abre el menú de cambio. */}
          {restaurantes.length > 0 && !isAdminSection && (
            <>
              <Tooltip title={restaurantes.length > 1 ? 'Cambiar restaurante' : 'Restaurante activo'}>
                <Box
                  onClick={restaurantes.length > 1 ? (e => setRestAnchorEl(e.currentTarget)) : undefined}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.75,
                    cursor: restaurantes.length > 1 ? 'pointer' : 'default',
                    px: 1.5, py: 0.5, mr: 1, borderRadius: 2, border: '1px solid',
                    borderColor: 'divider',
                    ...(restaurantes.length > 1 ? { '&:hover': { bgcolor: 'action.hover' } } : {}),
                  }}
                >
                  {restauranteActivo?.logo_url ? (
                    <Box component="img" src={restauranteActivo.logo_url} alt={restauranteActivo.nombre}
                      sx={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <Business fontSize="small" sx={{ color: 'text.secondary' }} />
                  )}
                  <Typography variant="body2" fontWeight={600}
                    sx={{ display: { xs: 'none', md: 'block' }, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {restauranteActivo?.nombre ?? 'Sin restaurante'}
                  </Typography>
                  {restaurantes.length > 1 && (
                    <KeyboardArrowDown fontSize="small" sx={{ color: 'text.secondary' }} />
                  )}
                </Box>
              </Tooltip>

              <Menu
                anchorEl={restAnchorEl}
                open={Boolean(restAnchorEl)}
                onClose={() => setRestAnchorEl(null)}
                PaperProps={{ sx: { minWidth: 200 } }}
              >
                <Box sx={{ px: 2, py: 1 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>RESTAURANTE ACTIVO</Typography>
                </Box>
                <Divider />
                {restaurantes.map((r: RestauranteMini) => (
                  <MenuItem
                    key={r.id} selected={r.id === restauranteActivo?.id}
                    onClick={() => handleCambiarSede(r)}
                    sx={{ gap: 1.5 }}
                  >
                    {r.logo_url ? (
                      <Box component="img" src={r.logo_url} alt={r.nombre}
                        sx={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <Business fontSize="small" sx={{ color: 'text.secondary' }} />
                    )}
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body2" fontWeight={r.id === restauranteActivo?.id ? 700 : 400}>
                        {r.nombre}
                      </Typography>
                    </Box>
                    {r.es_default && (
                      <Chip label="default" size="small" sx={{ height: 16, fontSize: '0.6rem' }} />
                    )}
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}

          {/* Campana de notificaciones (solo en sección principal) */}
          {!isAdminSection && <NotificationsMenu />}

          {/* Menú usuario */}
          <Tooltip title="Mi cuenta">
            <Box
              onClick={e => setAnchorEl(e.currentTarget)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer',
                px: 1, py: 0.5, borderRadius: 2, '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: rolColor, fontSize: '0.75rem', fontWeight: 700 }}>
                {usuario ? getInitials(usuario.nombre_completo) : '?'}
              </Avatar>
              <Typography variant="body2" fontWeight={600} sx={{ display: { xs: 'none', sm: 'block' } }}>
                {usuario?.nombre_completo?.split(' ')[0]}
              </Typography>
              <KeyboardArrowDown fontSize="small" />
            </Box>
          </Tooltip>

          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="body2" fontWeight={700}>{usuario?.nombre_completo}</Typography>
              <Typography variant="caption" color="text.secondary">{usuario?.email}</Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => { setAnchorEl(null); navigate('/perfil'); }}>
              <ListItemIcon><Person fontSize="small" /></ListItemIcon>
              Mi perfil
            </MenuItem>
            <MenuItem onClick={() => { setAnchorEl(null); handleLogout(); }} sx={{ color: 'error.main' }}>
              <ListItemIcon><Logout fontSize="small" color="error" /></ListItemIcon>
              Cerrar sesión
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Nav — Drawer */}
      <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 }, transition: 'width 0.2s' }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent" open
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              borderRight: '1px solid rgba(0,0,0,0.08)',
              overflowX: 'hidden',
              transition: 'width 0.2s',
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Contenido principal — usa <Outlet /> para renderizar la página activa.
          El key por sede re-monta la página al cambiar de sucursal, garantizando
          que todos sus datos se recarguen con el nuevo X-Restaurante-Id. */}
      <Box
        component="main"
        key={restauranteActivo?.id ?? 'sin-sede'}
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          transition: 'width 0.2s',
          minWidth: 0,
        }}
      >
        <Toolbar />
        <AppBreadcrumbs />
        <Outlet />
      </Box>

      {/* Confirmación: cambiar de sede con una orden sin guardar */}
      <Dialog open={Boolean(sedePendiente)} onClose={() => setSedePendiente(null)}>
        <DialogTitle>Cambiar de sucursal</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Tienes una orden sin guardar en <strong>{restauranteActivo?.nombre}</strong>.
            Se descartará al cambiar a <strong>{sedePendiente?.nombre}</strong>.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSedePendiente(null)}>Cancelar</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              const destino = sedePendiente;
              setSedePendiente(null);
              if (destino) aplicarCambioSede(destino);
            }}
          >
            Cambiar de todos modos
          </Button>
        </DialogActions>
      </Dialog>

      {/* Overlay de transición al cambiar de sede (evita el flash de datos viejos) */}
      <Backdrop
        open={cambiandoSede}
        sx={{ zIndex: theme.zIndex.drawer + 2, color: '#fff', flexDirection: 'column', gap: 2 }}
      >
        <CircularProgress color="inherit" />
        <Typography fontWeight={600}>Cambiando a {restauranteActivo?.nombre}…</Typography>
      </Backdrop>
    </Box>
  );
}
