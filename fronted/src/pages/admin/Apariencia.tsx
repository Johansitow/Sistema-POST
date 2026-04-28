/**
 * Apariencia — Personalización visual y menú lateral
 *
 * Tab 0: Apariencia  (nombre, color, logo)
 * Tab 1: Menú lateral (visibilidad y orden de ítems)
 */
import { useState, useEffect, useRef } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Alert, Box, Button, Chip, CircularProgress,
  Paper, Snackbar, Switch, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import { DragIndicator, Palette, Save } from '@mui/icons-material';
import { uiConfigService } from '../../services/ui-config.service';

// ── Catálogo de navegación ────────────────────────────────────────────────────

const NAV_CATALOG = [
  { grupo: 'Principal',  label: 'Dashboard',     path: '/dashboard'      },
  { grupo: 'Ventas',     label: 'Órdenes',       path: '/ordenes'        },
  { grupo: 'Ventas',     label: 'Clientes',      path: '/clientes'       },
  { grupo: 'Ventas',     label: 'Proveedores',   path: '/proveedores'    },
  { grupo: 'Inventario', label: 'Inventario',    path: '/inventario'     },
  { grupo: 'Inventario', label: 'Lotes',         path: '/lotes'          },
  { grupo: 'Inventario', label: 'Recetas',       path: '/recetas'        },
  { grupo: 'Inventario', label: 'Lista Compras', path: '/listas-compras' },
  { grupo: 'Finanzas',   label: 'Facturas',      path: '/facturas'       },
  { grupo: 'Finanzas',   label: 'Caja',          path: '/caja'           },
  { grupo: 'Finanzas',   label: 'Reportes',      path: '/reportes'       },
];

interface NavDisplayItem {
  path:    string;
  label:   string;
  grupo:   string;
  visible: boolean;
}

// ── SortableNavRow ────────────────────────────────────────────────────────────

function SortableNavRow({ item, onToggle }: { item: NavDisplayItem; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.path });

  return (
    <Box
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        px: 2, py: 1,
        borderBottom: '1px solid', borderColor: 'divider',
        bgcolor: isDragging ? 'action.selected' : (item.visible ? 'transparent' : 'grey.50'),
        opacity: item.visible ? 1 : 0.5,
        cursor: isDragging ? 'grabbing' : 'default',
        transition: 'background 0.15s',
      }}
    >
      <Box
        {...listeners}
        {...attributes}
        sx={{ cursor: 'grab', color: 'text.disabled', display: 'flex', flexShrink: 0, '&:active': { cursor: 'grabbing' } }}
      >
        <DragIndicator fontSize="small" />
      </Box>
      <Switch checked={item.visible} onChange={onToggle} size="small" color="primary" />
      <Typography
        variant="body2"
        fontWeight={item.visible ? 600 : 400}
        color={item.visible ? 'text.primary' : 'text.disabled'}
        sx={{ flexGrow: 1 }}
      >
        {item.label}
      </Typography>
      {!item.visible && (
        <Chip label="Oculto" size="small"
          sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'grey.200', color: 'text.disabled' }} />
      )}
    </Box>
  );
}

// ── Panel: Apariencia ─────────────────────────────────────────────────────────

function AparienciaPanel() {
  const [nombreSistema, setNombreSistema] = useState('');
  const [colorPrimario, setColorPrimario] = useState('#e53935');
  const [logoUrl,       setLogoUrl]       = useState('');
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState('');
  const colorRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      uiConfigService.getConfig('apariencia', 'nombre_sistema'),
      uiConfigService.getConfig('apariencia', 'color_primario'),
      uiConfigService.getConfig('apariencia', 'logo_url'),
    ]).then(([nombre, color, logo]) => {
      if (nombre?.valor) setNombreSistema(String(nombre.valor));
      if (color?.valor)  setColorPrimario(String(color.valor));
      if (logo?.valor)   setLogoUrl(String(logo.valor));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        uiConfigService.setConfig('apariencia', 'nombre_sistema', nombreSistema),
        uiConfigService.setConfig('apariencia', 'color_primario', colorPrimario),
        uiConfigService.setConfig('apariencia', 'logo_url',       logoUrl),
      ]);
      setToast('Apariencia guardada');
    } catch { setToast('Error al guardar'); }
    finally { setSaving(false); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Apariencia</Typography>
          <Typography variant="body2" color="text.secondary">
            Personaliza el nombre, color y logo del sistema.
          </Typography>
        </Box>
        <Button variant="contained"
          startIcon={saving ? <CircularProgress size={16} /> : <Save />}
          onClick={handleSave} disabled={saving}>
          Guardar
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5, maxWidth: 480 }}>
        {/* Nombre del sistema */}
        <Box>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>Nombre del sistema</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Aparece en la barra superior y en la pantalla de inicio de sesión.
          </Typography>
          <TextField value={nombreSistema} onChange={e => setNombreSistema(e.target.value)}
            placeholder="Ej: Mi Restaurante POS" fullWidth size="small" />
        </Box>

        {/* Color primario */}
        <Box>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>Color principal</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Color de acento del sidebar y botones principales.
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box onClick={() => colorRef.current?.click()} sx={{
              width: 44, height: 44, borderRadius: 2, bgcolor: colorPrimario,
              border: '2px solid', borderColor: 'divider', cursor: 'pointer', flexShrink: 0,
              transition: 'transform 0.1s', '&:hover': { transform: 'scale(1.08)' },
            }} />
            <input ref={colorRef} type="color" value={colorPrimario}
              onChange={e => setColorPrimario(e.target.value)}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }} />
            <TextField value={colorPrimario} onChange={e => setColorPrimario(e.target.value)}
              size="small" sx={{ width: 120, '& input': { fontFamily: 'monospace' } }} />
            <Box sx={{ display: 'flex', gap: 1 }}>
              {['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa'].map(c => (
                <Box key={c} onClick={() => setColorPrimario(c)} sx={{
                  width: 24, height: 24, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                  border: '2px solid',
                  borderColor: colorPrimario === c ? 'text.primary' : 'transparent',
                  transition: 'transform 0.1s', '&:hover': { transform: 'scale(1.15)' },
                }} />
              ))}
            </Box>
          </Box>
        </Box>

        {/* Logo URL */}
        <Box>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>URL del logo</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Imagen PNG o SVG. Dejar vacío para usar el ícono por defecto.
          </Typography>
          <TextField value={logoUrl} onChange={e => setLogoUrl(e.target.value)}
            placeholder="https://..." fullWidth size="small" />
          {logoUrl && (
            <Box sx={{ mt: 1.5, p: 1.5, border: '1px dashed', borderColor: 'divider', borderRadius: 1.5, display: 'inline-block' }}>
              <img src={logoUrl} alt="Preview" style={{ height: 40, objectFit: 'contain' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </Box>
          )}
        </Box>
      </Box>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={toast.startsWith('Error') ? 'error' : 'success'}
          onClose={() => setToast('')} variant="filled">
          {toast}
        </Alert>
      </Snackbar>
    </>
  );
}

// ── Panel: Menú lateral ───────────────────────────────────────────────────────

function MenuLateralPanel() {
  const [displayItems, setDisplayItems] = useState<NavDisplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    Promise.all([
      uiConfigService.getConfig('navegacion', 'items_ocultos'),
      uiConfigService.getConfig('navegacion', 'orden_items'),
    ]).then(([ocultosRes, ordenRes]) => {
      const ocultos: string[] = Array.isArray(ocultosRes?.valor) ? (ocultosRes!.valor as string[]) : [];
      const orden:   string[] = Array.isArray(ordenRes?.valor)   ? (ordenRes!.valor   as string[]) : [];
      let base = [...NAV_CATALOG];
      if (orden.length > 0) {
        const inOrder = orden.flatMap(p => base.filter(x => x.path === p));
        const rest    = base.filter(x => !orden.includes(x.path));
        base = [...inOrder, ...rest];
      }
      setDisplayItems(base.map(x => ({ ...x, visible: !ocultos.includes(x.path) })));
    }).catch(() => {
      setDisplayItems(NAV_CATALOG.map(x => ({ ...x, visible: true })));
    }).finally(() => setLoading(false));
  }, []);

  const toggleVisible = (path: string) =>
    setDisplayItems(prev => prev.map(x => x.path === path ? { ...x, visible: !x.visible } : x));

  const handleDragEnd = (event: DragEndEvent, grupo: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDisplayItems(prev => {
      const grupoItems = prev.filter(x => x.grupo === grupo);
      const otros      = prev.filter(x => x.grupo !== grupo);
      const oldIdx = grupoItems.findIndex(x => x.path === String(active.id));
      const newIdx = grupoItems.findIndex(x => x.path === String(over.id));
      const reordered = arrayMove(grupoItems, oldIdx, newIdx);
      const grupos = [...new Set(NAV_CATALOG.map(x => x.grupo))];
      return grupos.flatMap(g => g === grupo ? reordered : otros.filter(x => x.grupo === g));
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const itemsOcultos = displayItems.filter(x => !x.visible).map(x => x.path);
      const ordenItems   = displayItems.map(x => x.path);
      await Promise.all([
        uiConfigService.setConfig('navegacion', 'items_ocultos', itemsOcultos),
        uiConfigService.setConfig('navegacion', 'orden_items',   ordenItems),
      ]);
      setToast('Navegación guardada — recarga la página para ver los cambios');
    } catch { setToast('Error al guardar'); }
    finally { setSaving(false); }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      await Promise.all([
        uiConfigService.setConfig('navegacion', 'items_ocultos', []),
        uiConfigService.setConfig('navegacion', 'orden_items',   []),
      ]);
      setDisplayItems(NAV_CATALOG.map(x => ({ ...x, visible: true })));
      setToast('Navegación restablecida a valores por defecto');
    } catch { setToast('Error al restablecer'); }
    finally { setSaving(false); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  const grupos = [...new Set(NAV_CATALOG.map(x => x.grupo))];
  const visiblesCount = displayItems.filter(x => x.visible).length;

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Menú lateral</Typography>
          <Typography variant="body2" color="text.secondary">
            Activa, desactiva y arrastra para reordenar las secciones del menú.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" variant="outlined" onClick={handleReset} disabled={saving}>
            Restablecer
          </Button>
          <Button size="small" variant="contained"
            startIcon={saving ? <CircularProgress size={14} /> : <Save />}
            onClick={handleSave} disabled={saving}>
            Guardar
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        {[
          { label: 'Visibles', value: visiblesCount,                       color: '#10b981' },
          { label: 'Ocultos',  value: displayItems.length - visiblesCount, color: '#9ca3af' },
        ].map(s => (
          <Paper key={s.label} variant="outlined"
            sx={{ px: 2.5, py: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h5" fontWeight={800} sx={{ color: s.color }}>{s.value}</Typography>
            <Typography variant="caption" color="text.secondary">{s.label}</Typography>
          </Paper>
        ))}
      </Box>

      <Alert severity="info" variant="outlined" sx={{ mb: 3 }}>
        Los cambios se aplican al recargar la página. Arrastra el ícono ☰ para reordenar.
      </Alert>

      {grupos.map(grupo => {
        const grupoItems = displayItems.filter(x => x.grupo === grupo);
        return (
          <Box key={grupo} sx={{ mb: 2 }}>
            <Typography variant="overline" fontWeight={700} color="text.secondary"
              sx={{ px: 0.5, fontSize: '0.68rem', letterSpacing: 1 }}>
              {grupo}
            </Typography>
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', mt: 0.5 }}>
              <DndContext sensors={sensors} collisionDetection={closestCenter}
                onDragEnd={e => handleDragEnd(e, grupo)}>
                <SortableContext items={grupoItems.map(x => x.path)} strategy={verticalListSortingStrategy}>
                  {grupoItems.map(item => (
                    <SortableNavRow key={item.path} item={item} onToggle={() => toggleVisible(item.path)} />
                  ))}
                </SortableContext>
              </DndContext>
            </Paper>
          </Box>
        );
      })}

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={toast.startsWith('Error') ? 'error' : 'success'}
          onClose={() => setToast('')} variant="filled">
          {toast}
        </Alert>
      </Snackbar>
    </>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Apariencia() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Box sx={{ p: 1.5, borderRadius: 2, background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', display: 'flex' }}>
          <Palette sx={{ color: 'white', fontSize: 24 }} />
        </Box>
        <Box>
          <Typography variant="h5" fontWeight={800}>Personalización</Typography>
          <Typography variant="body2" color="text.secondary">
            Apariencia visual y configuración del menú lateral
          </Typography>
        </Box>
      </Box>

      <Paper variant="outlined" sx={{ borderRadius: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <Tab icon={<Palette fontSize="small" />} iconPosition="start" label="Apariencia" />
          <Tab icon={<DragIndicator fontSize="small" />} iconPosition="start" label="Menú lateral" />
        </Tabs>
        <Box sx={{ p: 3 }}>
          {tab === 0 && <AparienciaPanel />}
          {tab === 1 && <MenuLateralPanel />}
        </Box>
      </Paper>
    </Box>
  );
}
