/**
 * NotificationsMenu — campana de notificaciones del AppBar.
 *
 * - Badge con el conteo de alertas no leídas (polling cada 60s + eventos socket).
 * - Al abrir, carga las últimas alertas no leídas de la sede activa.
 * - Click en una notificación: la marca como leída y navega a la página
 *   relevante según el tipo de alerta.
 * - "Marcar todas como leídas" y acceso al historial completo (/inventario).
 *
 * El scoping por sede es automático: cada request viaja con X-Restaurante-Id.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge, Box, Button, CircularProgress, Divider, IconButton,
  List, ListItemButton, ListItemIcon, ListItemText, Popover,
  Tooltip, Typography,
} from '@mui/material';
import {
  NotificationsOutlined, WarningAmberOutlined, ErrorOutline,
  EventOutlined, ShoppingCartOutlined, TuneOutlined,
  ReportProblemOutlined, PointOfSaleOutlined, NotificationsNoneOutlined,
  DoneAllOutlined,
} from '@mui/icons-material';
import { alertaService, type Alerta } from '../../services/alerta.service';
import { useRestauranteStore } from '../../store/restauranteStore';
import { socket } from '../../lib/socket';
import { formatRelativeTime } from '../../utils/format';

// ── Mapping tipo de alerta → destino e icono ─────────────────────────────────

const RUTA_POR_CODIGO: Record<string, string> = {
  STOCK_MINIMO:     '/inventario',
  STOCK_AGOTADO:    '/inventario',
  VENCIMIENTO:      '/inventario',
  AJUSTE_STOCK:     '/inventario',
  PERDIDA_SIN_LOTE: '/inventario',
  LISTA_COMPRA:     '/listas-compras',
  CIERRE_CAJA:      '/caja',
};

const ICONO_POR_CODIGO: Record<string, React.ReactNode> = {
  STOCK_MINIMO:     <WarningAmberOutlined fontSize="small" sx={{ color: '#FFC107' }} />,
  STOCK_AGOTADO:    <ErrorOutline fontSize="small" sx={{ color: '#F44336' }} />,
  VENCIMIENTO:      <EventOutlined fontSize="small" sx={{ color: '#FF5722' }} />,
  LISTA_COMPRA:     <ShoppingCartOutlined fontSize="small" sx={{ color: '#FF9800' }} />,
  AJUSTE_STOCK:     <TuneOutlined fontSize="small" sx={{ color: '#2196F3' }} />,
  PERDIDA_SIN_LOTE: <ReportProblemOutlined fontSize="small" sx={{ color: '#D32F2F' }} />,
  CIERRE_CAJA:      <PointOfSaleOutlined fontSize="small" sx={{ color: '#4CAF50' }} />,
};

const rutaDe  = (a: Alerta) => RUTA_POR_CODIGO[a.tipo_alerta?.codigo ?? ''] ?? '/inventario';
const iconoDe = (a: Alerta) =>
  ICONO_POR_CODIGO[a.tipo_alerta?.codigo ?? ''] ?? <NotificationsOutlined fontSize="small" sx={{ color: 'text.secondary' }} />;

// ── Componente ───────────────────────────────────────────────────────────────

export default function NotificationsMenu() {
  const navigate = useNavigate();
  const restauranteActivo = useRestauranteStore(s => s.activo);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [count,    setCount]    = useState(0);
  const [alertas,  setAlertas]  = useState<Alerta[]>([]);
  const [loading,  setLoading]  = useState(false);

  const open = Boolean(anchorEl);

  const fetchCount = useCallback(async () => {
    try {
      setCount(await alertaService.getCountNoLeidas());
    } catch { /* silencioso — el badge simplemente no se actualiza */ }
  }, []);

  const fetchAlertas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await alertaService.getAll({ es_leida: false, limit: 10 });
      setAlertas(res.data);
    } catch {
      setAlertas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Badge: polling + refetch al cambiar de sede
  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => clearInterval(interval);
  }, [fetchCount, restauranteActivo?.id]);

  // Tiempo real: cualquier evento de alerta refresca el badge (y la lista si está abierta).
  // El backend emite STOCK_BAJO y CIERRE_COMPLETADO solo a las rooms 'admin'/'caja',
  // y el Layout conecta el socket sin room (connectGlobal) — hay que unirse aquí.
  // El refetch viaja con X-Restaurante-Id, así que cada sede solo ve lo suyo.
  useEffect(() => {
    const joinRoom = () => socket.emit('join', { room: 'admin' });
    if (socket.connected) joinRoom();
    socket.on('connect', joinRoom);

    const handleEvento = () => {
      fetchCount();
      if (open) fetchAlertas();
    };
    socket.on('STOCK_BAJO', handleEvento);
    socket.on('CIERRE_COMPLETADO', handleEvento);
    return () => {
      socket.off('connect', joinRoom);
      socket.off('STOCK_BAJO', handleEvento);
      socket.off('CIERRE_COMPLETADO', handleEvento);
    };
  }, [fetchCount, fetchAlertas, open]);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
    fetchAlertas();
  };

  const handleClickAlerta = (alerta: Alerta) => {
    // Optimista: quitarla de la lista y bajar el badge de inmediato
    setAlertas(prev => prev.filter(a => a.id !== alerta.id));
    setCount(prev => Math.max(0, prev - 1));
    alertaService.marcarLeida(alerta.id).catch(() => fetchCount());
    setAnchorEl(null);
    navigate(rutaDe(alerta));
  };

  const handleMarcarTodas = async () => {
    setAlertas([]);
    setCount(0);
    try { await alertaService.marcarTodasLeidas(); } catch { fetchCount(); }
  };

  return (
    <>
      <Tooltip title={count > 0 ? `${count} ${count === 1 ? 'notificación' : 'notificaciones'} sin leer` : 'Notificaciones'}>
        <IconButton onClick={handleOpen} sx={{ mr: 1 }}>
          <Badge badgeContent={count > 0 ? count : null} color="error" max={99}>
            <NotificationsOutlined sx={{ color: count > 0 ? 'error.main' : 'text.secondary' }} />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 360, maxWidth: '90vw' } }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2" fontWeight={700}>Notificaciones</Typography>
          {count > 0 && (
            <Button
              size="small"
              startIcon={<DoneAllOutlined fontSize="small" />}
              onClick={handleMarcarTodas}
              sx={{ textTransform: 'none', fontSize: '0.75rem' }}
            >
              Marcar todas leídas
            </Button>
          )}
        </Box>
        <Divider />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : alertas.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 1 }}>
            <NotificationsNoneOutlined sx={{ fontSize: 40, color: 'text.disabled' }} />
            <Typography variant="body2" color="text.secondary">Sin notificaciones nuevas</Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ maxHeight: 380, overflowY: 'auto' }}>
            {alertas.map(alerta => (
              <ListItemButton
                key={alerta.id}
                onClick={() => handleClickAlerta(alerta)}
                divider
                sx={{ alignItems: 'flex-start', py: 1.25 }}
              >
                <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>{iconoDe(alerta)}</ListItemIcon>
                <ListItemText
                  primary={alerta.mensaje}
                  secondary={formatRelativeTime(alerta.fecha_creacion)}
                  primaryTypographyProps={{ variant: 'body2', sx: { lineHeight: 1.35 } }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItemButton>
            ))}
          </List>
        )}

        <Divider />
        <Box sx={{ p: 1 }}>
          <Button
            fullWidth size="small"
            onClick={() => { setAnchorEl(null); navigate('/inventario'); }}
            sx={{ textTransform: 'none' }}
          >
            Ver historial de alertas
          </Button>
        </Box>
      </Popover>
    </>
  );
}
