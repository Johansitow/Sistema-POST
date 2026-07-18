/**
 * Apariencia — Personalización visual y menú lateral
 *
 * Tab 0: Apariencia   (nombre, color, logo)
 * Tab 1: Menú lateral (subdivisiones editables: renombrar, crear/eliminar grupos,
 *        mover módulos entre grupos, reordenar grupos y módulos, ocultar/mostrar)
 */
import { useState, useEffect, useRef } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDroppable,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Alert, Box, Button, Chip, CircularProgress, IconButton,
  Paper, Snackbar, Switch, Tab, Tabs, TextField, Typography,
  Select, MenuItem,
} from '@mui/material';
import { DragIndicator, Palette, Save, Add, DeleteOutline } from '@mui/icons-material';
import { uiConfigService } from '../../services/ui-config.service';
import { useBrandingStore } from '../../store/brandingStore';
import { menuService, type GuardarMenuGrupo } from '../../services/menu.service';
import { useMenuStore } from '../../store/menuStore';
import { MODULE_CATALOG, MODULE_MAP, DEFAULT_GROUPS } from '../../config/menuCatalog';

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
      // Refleja el cambio de inmediato en sidebar/login — sin esto solo se vería tras recargar.
      useBrandingStore.getState().setBranding({ nombreSistema, colorPrimario, logoUrl });
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
//
// Modelo del editor: un array plano de grupos y un array plano de items, cada
// item con su `grupoId`. Mover un módulo entre grupos es solo reasignar su
// grupoId; el `orden` de cada item se recalcula por su posición relativa
// dentro del array tras cada drag (ver reordenarPorPosicion).

interface EditorGrupo { id: string; nombre: string; orden: number }
interface EditorItem  { path: string; grupoId: string; orden: number; visible: boolean }

const GRUPO_SIN_ASIGNAR_ID = 'sin-asignar';

function dtoAEditor(dtos: Awaited<ReturnType<typeof menuService.listar>>): { grupos: EditorGrupo[]; items: EditorItem[] } {
  const grupos: EditorGrupo[] = dtos
    .slice().sort((a, b) => a.orden - b.orden)
    .map(g => ({ id: String(g.id), nombre: g.nombre, orden: g.orden }));

  const items: EditorItem[] = dtos.flatMap(g =>
    g.items.slice().sort((a, b) => a.orden - b.orden)
      .map(i => ({ path: i.path, grupoId: String(g.id), orden: i.orden, visible: i.visible }))
  );

  // Módulos del catálogo que no vinieron en la respuesta (p.ej. uno nuevo que
  // se agregó al código pero aún no tiene asignación) — van a un grupo aparte
  // para que sigan siendo visibles y movibles, en vez de desaparecer.
  const asignados = new Set(items.map(i => i.path));
  const huerfanos = MODULE_CATALOG.filter(m => !asignados.has(m.path));
  if (huerfanos.length > 0) {
    grupos.push({ id: GRUPO_SIN_ASIGNAR_ID, nombre: 'Sin asignar', orden: grupos.length });
    huerfanos.forEach((m, i) => items.push({ path: m.path, grupoId: GRUPO_SIN_ASIGNAR_ID, orden: i, visible: true }));
  }

  return { grupos, items };
}

function defaultsAEditor(): { grupos: EditorGrupo[]; items: EditorItem[] } {
  const grupos = DEFAULT_GROUPS.map((g, gi) => ({ id: `default-${gi}`, nombre: g.nombre, orden: gi }));
  const items = DEFAULT_GROUPS.flatMap((g, gi) =>
    g.paths.map((path, i) => ({ path, grupoId: `default-${gi}`, orden: i, visible: true }))
  );
  return { grupos, items };
}

/** Recalcula `orden` de todos los items según su posición dentro de cada grupo en el array. */
function renumerar(items: EditorItem[]): EditorItem[] {
  const contadores: Record<string, number> = {};
  return items.map(i => {
    const n = contadores[i.grupoId] ?? 0;
    contadores[i.grupoId] = n + 1;
    return { ...i, orden: n };
  });
}

/**
 * Mueve `activePath` al grupo `targetGrupoId`, insertado justo antes de `overPath`
 * (o al final del grupo destino si `overPath` es null). Usada tanto por el
 * drag-and-drop entre grupos como por el selector de grupo (alternativa sin arrastrar).
 */
function moverItem(items: EditorItem[], activePath: string, targetGrupoId: string, overPath: string | null): EditorItem[] {
  const activeItem = items.find(i => i.path === activePath);
  if (!activeItem) return items;

  const rest  = items.filter(i => i.path !== activePath);
  const moved = { ...activeItem, grupoId: targetGrupoId };

  let insertPos: number;
  if (overPath) {
    insertPos = rest.findIndex(i => i.path === overPath);
    if (insertPos === -1) insertPos = rest.length;
  } else {
    let lastIdxOfGroup = -1;
    rest.forEach((i, idx) => { if (i.grupoId === targetGrupoId) lastIdxOfGroup = idx; });
    insertPos = lastIdxOfGroup === -1 ? rest.length : lastIdxOfGroup + 1;
  }

  const next = [...rest.slice(0, insertPos), moved, ...rest.slice(insertPos)];
  return renumerar(next);
}

// ── Fila de módulo ──────────────────────────────────────────────────────────
//
// Dos formas de mover un módulo a otro grupo: arrastrando (☰) o eligiéndolo en
// el selector — la segunda es más simple para quien tiene dificultad con drag-and-drop.

function SortableItemRow({
  item, grupos, onToggle, onMoveToGroup,
}: {
  item: EditorItem;
  grupos: EditorGrupo[];
  onToggle: () => void;
  onMoveToGroup: (path: string, targetGrupoId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `item:${item.path}` });
  const modulo = MODULE_MAP[item.path];

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
        {modulo?.text ?? item.path}
      </Typography>
      {!item.visible && (
        <Chip label="Oculto" size="small"
          sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'grey.200', color: 'text.disabled' }} />
      )}
      <Select
        value={item.grupoId}
        onChange={e => onMoveToGroup(item.path, e.target.value)}
        size="small"
        variant="outlined"
        sx={{ minWidth: 150, fontSize: '0.8rem' }}
        // Evita que un clic/drag accidental sobre el select dispare el sensor de arrastre de la fila
        onPointerDown={e => e.stopPropagation()}
      >
        {grupos.map(g => (
          <MenuItem key={g.id} value={g.id} sx={{ fontSize: '0.8rem' }}>{g.nombre || '(sin nombre)'}</MenuItem>
        ))}
      </Select>
    </Box>
  );
}

// ── Grupo (encabezado arrastrable + cuerpo droppable con sus módulos) ─────────

function SortableGrupo({
  grupo, items, todosLosGrupos, onToggleItem, onRename, onDelete, onMoveToGroup,
}: {
  grupo: EditorGrupo;
  items: EditorItem[];
  todosLosGrupos: EditorGrupo[];
  onToggleItem: (path: string) => void;
  onRename: (id: string, nombre: string) => void;
  onDelete: (id: string) => void;
  onMoveToGroup: (path: string, targetGrupoId: string) => void;
}) {
  const {
    attributes, listeners, setNodeRef: setHeaderRef, transform, transition, isDragging,
  } = useSortable({ id: `group:${grupo.id}` });
  const { setNodeRef: setBodyRef, isOver } = useDroppable({ id: `container:${grupo.id}` });

  return (
    <Box
      ref={setHeaderRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      sx={{ mb: 2, opacity: isDragging ? 0.6 : 1 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 0.5, mb: 0.5 }}>
        <Box
          {...listeners}
          {...attributes}
          sx={{ cursor: 'grab', color: 'text.disabled', display: 'flex', '&:active': { cursor: 'grabbing' } }}
        >
          <DragIndicator fontSize="small" />
        </Box>
        <TextField
          value={grupo.nombre}
          onChange={e => onRename(grupo.id, e.target.value)}
          variant="standard"
          size="small"
          sx={{
            '& .MuiInput-input': { fontWeight: 700, fontSize: '0.75rem', letterSpacing: 1, textTransform: 'uppercase' },
          }}
        />
        <Box sx={{ flexGrow: 1 }} />
        <IconButton size="small" onClick={() => onDelete(grupo.id)} sx={{ color: 'text.disabled' }}>
          <DeleteOutline fontSize="small" />
        </IconButton>
      </Box>
      <Paper
        ref={setBodyRef}
        variant="outlined"
        sx={{
          borderRadius: 2, overflow: 'hidden', minHeight: 48,
          borderColor: isOver ? 'primary.main' : 'divider',
          borderStyle: items.length === 0 ? 'dashed' : 'solid',
        }}
      >
        <SortableContext items={items.map(i => `item:${i.path}`)} strategy={verticalListSortingStrategy}>
          {items.length === 0 ? (
            <Box sx={{ px: 2, py: 2, textAlign: 'center' }}>
              <Typography variant="caption" color="text.disabled">Arrastra un módulo aquí</Typography>
            </Box>
          ) : (
            items.map(item => (
              <SortableItemRow
                key={item.path}
                item={item}
                grupos={todosLosGrupos}
                onToggle={() => onToggleItem(item.path)}
                onMoveToGroup={onMoveToGroup}
              />
            ))
          )}
        </SortableContext>
      </Paper>
    </Box>
  );
}

function MenuLateralPanel() {
  const [grupos, setGrupos] = useState<EditorGrupo[]>([]);
  const [items,  setItems]  = useState<EditorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState('');
  // Sin esto, arrastrar un módulo se ve aplicado de inmediato en el editor (estado local)
  // y es fácil pensar que ya quedó guardado — pero hasta que no se hace clic en "Guardar"
  // no se persiste ni se refleja en el sidebar real.
  const [dirty, setDirty] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    menuService.listar()
      .then(dtos => {
        const { grupos, items } = dtoAEditor(dtos);
        setGrupos(grupos);
        setItems(items);
      })
      .catch(() => {
        const { grupos, items } = defaultsAEditor();
        setGrupos(grupos);
        setItems(items);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleVisible = (path: string) => {
    setDirty(true);
    setItems(prev => prev.map(i => i.path === path ? { ...i, visible: !i.visible } : i));
  };

  const handleRename = (id: string, nombre: string) => {
    setDirty(true);
    setGrupos(prev => prev.map(g => g.id === id ? { ...g, nombre } : g));
  };

  const handleAddGrupo = () => {
    setDirty(true);
    const id = `new-${Date.now()}`;
    setGrupos(prev => [...prev, { id, nombre: 'Nuevo grupo', orden: prev.length }]);
  };

  const handleDeleteGrupo = (id: string) => {
    if (items.some(i => i.grupoId === id)) {
      setToast('Mueve los módulos de este grupo antes de eliminarlo');
      return;
    }
    setDirty(true);
    setGrupos(prev => prev.filter(g => g.id !== id).map((g, i) => ({ ...g, orden: i })));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId   = String(over.id);
    if (activeId === overId) return;
    setDirty(true);

    if (activeId.startsWith('group:')) {
      if (!overId.startsWith('group:')) return;
      setGrupos(prev => {
        const oldIdx = prev.findIndex(g => `group:${g.id}` === activeId);
        const newIdx = prev.findIndex(g => `group:${g.id}` === overId);
        if (oldIdx === -1 || newIdx === -1) return prev;
        return arrayMove(prev, oldIdx, newIdx).map((g, i) => ({ ...g, orden: i }));
      });
      return;
    }

    if (activeId.startsWith('item:')) {
      const activePath = activeId.slice(5);
      setItems(prev => {
        const activeItem = prev.find(i => i.path === activePath);
        if (!activeItem) return prev;

        let targetGrupoId = activeItem.grupoId;
        let overPath: string | null = null;
        if (overId.startsWith('item:')) {
          overPath = overId.slice(5);
          const overItem = prev.find(i => i.path === overPath);
          if (overItem) targetGrupoId = overItem.grupoId;
        } else if (overId.startsWith('container:')) {
          targetGrupoId = overId.slice('container:'.length);
        } else {
          return prev;
        }

        return moverItem(prev, activePath, targetGrupoId, overPath);
      });
    }
  };

  /** Alternativa sin arrastrar: elegir el grupo destino desde un selector en cada fila. */
  const handleMoveToGroup = (path: string, targetGrupoId: string) => {
    setDirty(true);
    setItems(prev => moverItem(prev, path, targetGrupoId, null));
  };

  const persistir = async (gruposAGuardar: EditorGrupo[], itemsAGuardar: EditorItem[]) => {
    const payload: GuardarMenuGrupo[] = gruposAGuardar
      .slice().sort((a, b) => a.orden - b.orden)
      .map(g => ({
        nombre: g.nombre.trim() || 'Grupo',
        orden:  g.orden,
        items: itemsAGuardar
          .filter(i => i.grupoId === g.id)
          .sort((a, b) => a.orden - b.orden)
          .map(i => ({ path: i.path, orden: i.orden, visible: i.visible })),
      }))
      .filter(g => g.items.length > 0); // grupos vacíos no se persisten (no aportan nada al sidebar)

    await menuService.guardar(payload);
    await useMenuStore.getState().reloadMenu();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await persistir(grupos, items);
      setDirty(false);
      setToast('Menú guardado — ya se aplicó en el sidebar');
    } catch (e: any) {
      setToast(`Error: ${e.response?.data?.error || 'No se pudo guardar'}`);
    } finally { setSaving(false); }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      const { grupos: g, items: i } = defaultsAEditor();
      await persistir(g, i);
      setGrupos(g);
      setItems(i);
      setDirty(false);
      setToast('Menú restablecido a valores por defecto');
    } catch { setToast('Error al restablecer'); }
    finally { setSaving(false); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  const visiblesCount = items.filter(i => i.visible).length;
  const gruposOrdenados = grupos.slice().sort((a, b) => a.orden - b.orden);

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Menú lateral</Typography>
          <Typography variant="body2" color="text.secondary">
            Renombra o crea subdivisiones y usa el selector de cada módulo (o arrastra) para moverlo entre ellas.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" variant="outlined" startIcon={<Add />} onClick={handleAddGrupo} disabled={saving}>
            Nuevo grupo
          </Button>
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
          { label: 'Visibles', value: visiblesCount,               color: '#10b981' },
          { label: 'Ocultos',  value: items.length - visiblesCount, color: '#9ca3af' },
          { label: 'Grupos',   value: grupos.length,                color: '#6366f1' },
        ].map(s => (
          <Paper key={s.label} variant="outlined"
            sx={{ px: 2.5, py: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h5" fontWeight={800} sx={{ color: s.color }}>{s.value}</Typography>
            <Typography variant="caption" color="text.secondary">{s.label}</Typography>
          </Paper>
        ))}
      </Box>

      {dirty ? (
        <Alert severity="warning" variant="filled" sx={{ mb: 3 }}>
          Tienes cambios sin guardar — no se aplican al sidebar hasta que hagas clic en <strong>Guardar</strong>.
        </Alert>
      ) : (
        <Alert severity="info" variant="outlined" sx={{ mb: 3 }}>
          Para mover un módulo a otro grupo, usa el selector a la derecha de cada fila — es más simple que arrastrar.
          El ícono ☰ sigue sirviendo para reordenar (dentro de un grupo, o los grupos entre sí arrastrando su encabezado).
        </Alert>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={gruposOrdenados.map(g => `group:${g.id}`)} strategy={verticalListSortingStrategy}>
          {gruposOrdenados.map(grupo => (
            <SortableGrupo
              key={grupo.id}
              grupo={grupo}
              items={items.filter(i => i.grupoId === grupo.id).sort((a, b) => a.orden - b.orden)}
              todosLosGrupos={gruposOrdenados}
              onToggleItem={toggleVisible}
              onRename={handleRename}
              onDelete={handleDeleteGrupo}
              onMoveToGroup={handleMoveToGroup}
            />
          ))}
        </SortableContext>
      </DndContext>

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
