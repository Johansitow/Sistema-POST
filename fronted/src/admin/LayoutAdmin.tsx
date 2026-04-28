/**
 * LayoutAdmin — Layout dedicado para la sección de administración
 *
 * Diferencias respecto al Layout principal:
 *  - Sidebar más estrecho con solo los módulos de admin
 *  - Las entradas del sidebar se construyen dinámicamente desde useAdminModules()
 *    (plugins activos + páginas core: configuración, auditoria, flags, plantillas)
 *  - Header con indicador "Panel de Administración"
 *  - No incluye selector de restaurante ni alertas (contexto de superadmin)
 */

import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Box, Drawer, IconButton, List, ListItemButton,
  ListItemIcon, ListItemText, Toolbar, Typography, Tooltip,
  Divider, CircularProgress,
} from '@mui/material';
import {
  Menu as MenuIcon, ChevronLeft, AdminPanelSettings, Logout,
  People, Restaurant, Category, Settings, Flag, Print,
  ManageSearch, Dashboard, Extension,
} from '@mui/icons-material';
import { useAuthStore } from '../store/useStore';
import { authService }  from '../services/auth.service';
import { useAdminModules } from './hooks/useAdminModules';

const DRAWER_WIDTH    = 240;
const COLLAPSED_WIDTH = 64;

/** Mapa de nombre de ícono (string) → componente MUI Icon */
const ICON_MAP: Record<string, React.ReactNode> = {
  People:       <People />,
  Restaurant:   <Restaurant />,
  Category:     <Category />,
  Settings:     <Settings />,
  Flag:         <Flag />,
  Print:        <Print />,
  ManageSearch: <ManageSearch />,
  Dashboard:    <Dashboard />,
  Extension:    <Extension />,
};

const getIcon = (iconName?: string): React.ReactNode =>
  (iconName && ICON_MAP[iconName]) ?? <Extension />;

interface LayoutAdminProps {
  children: React.ReactNode;
}

export default function LayoutAdmin({ children }: LayoutAdminProps) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuthStore();
  const [open, setOpen] = useState(true);

  const { pages, loading } = useAdminModules();

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login', { replace: true });
  };

  const drawerWidth = open ? DRAWER_WIDTH : COLLAPSED_WIDTH;

  const sidebarContent = useMemo(() => (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header del sidebar */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: open ? 'space-between' : 'center',
        px: open ? 2 : 0, py: 1.5, minHeight: 64,
      }}>
        {open && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AdminPanelSettings sx={{ color: 'primary.main', fontSize: 20 }} />
            <Typography variant="subtitle2" fontWeight={700} color="primary">
              Admin
            </Typography>
          </Box>
        )}
        <IconButton onClick={() => setOpen(v => !v)} size="small">
          {open ? <ChevronLeft /> : <MenuIcon />}
        </IconButton>
      </Box>

      <Divider />

      {/* Volver al sistema */}
      <List dense disablePadding sx={{ pt: 1 }}>
        <Tooltip title={open ? '' : 'Volver al sistema'} placement="right">
          <ListItemButton
            onClick={() => navigate('/dashboard')}
            sx={{ px: open ? 2 : 'auto', justifyContent: open ? 'flex-start' : 'center' }}
          >
            <ListItemIcon sx={{ minWidth: open ? 40 : 'auto' }}>
              <Dashboard sx={{ fontSize: 20 }} />
            </ListItemIcon>
            {open && <ListItemText primary="Volver al sistema" primaryTypographyProps={{ fontSize: 13 }} />}
          </ListItemButton>
        </Tooltip>
      </List>

      <Divider sx={{ my: 0.5 }} />

      {/* Módulos de admin (dinámicos desde plugins) */}
      <List dense disablePadding sx={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={20} />
          </Box>
        ) : pages.map(page => {
          const active = location.pathname === page.path ||
                         location.pathname.startsWith(page.path + '/');
          return (
            <Tooltip key={page.path} title={open ? '' : page.label} placement="right">
              <ListItemButton
                selected={active}
                onClick={() => navigate(page.path)}
                sx={{
                  px: open ? 2 : 'auto',
                  justifyContent: open ? 'flex-start' : 'center',
                  borderLeft: active ? '3px solid' : '3px solid transparent',
                  borderColor: active ? 'primary.main' : 'transparent',
                  '&.Mui-selected': { bgcolor: 'action.selected' },
                }}
              >
                <ListItemIcon sx={{ minWidth: open ? 40 : 'auto', color: active ? 'primary.main' : 'inherit' }}>
                  {getIcon(page.icon)}
                </ListItemIcon>
                {open && (
                  <ListItemText
                    primary={page.label}
                    primaryTypographyProps={{
                      fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      color: active ? 'primary.main' : 'text.primary',
                    }}
                  />
                )}
              </ListItemButton>
            </Tooltip>
          );
        })}
      </List>

      <Divider />

      {/* Usuario + Logout */}
      <Box sx={{ p: open ? 1.5 : 0.5 }}>
        {open && (
          <Typography variant="caption" color="text.secondary" display="block" noWrap sx={{ mb: 0.5 }}>
            {user?.nombre_completo ?? user?.usuario}
          </Typography>
        )}
        <Tooltip title="Cerrar sesión" placement="right">
          <ListItemButton
            onClick={handleLogout}
            sx={{ borderRadius: 1, px: open ? 1 : 'auto', justifyContent: open ? 'flex-start' : 'center' }}
          >
            <ListItemIcon sx={{ minWidth: open ? 36 : 'auto' }}>
              <Logout sx={{ fontSize: 18 }} />
            </ListItemIcon>
            {open && <ListItemText primary="Cerrar sesión" primaryTypographyProps={{ fontSize: 13 }} />}
          </ListItemButton>
        </Tooltip>
      </Box>
    </Box>
  ), [open, pages, loading, location.pathname, navigate, user, handleLogout]);

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default' }}>
      {/* AppBar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: theme => theme.zIndex.drawer + 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          color: 'text.primary',
        }}
      >
        <Toolbar variant="dense" sx={{ minHeight: 56 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            <AdminPanelSettings sx={{ color: 'primary.main' }} />
            <Typography variant="h6" fontWeight={700} fontSize={16}>
              Panel de Administración
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            mt: '56px',
            height: 'calc(100% - 56px)',
            transition: theme => theme.transitions.create('width', {
              easing:   theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
            overflowX: 'hidden',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        {sidebarContent}
      </Drawer>

      {/* Contenido principal */}
      <Box
        component="main"
        sx={{
          flex: 1,
          mt: '56px',
          overflow: 'auto',
          transition: theme => theme.transitions.create('margin', {
            easing:   theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
