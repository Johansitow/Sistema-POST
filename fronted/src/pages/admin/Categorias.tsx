/**
 * Categorias — Página de gestión de categorías con reordenamiento
 *
 * Funcionalidades:
 * - CRUD completo (crear, editar, eliminar)
 * - Reordenamiento con flechas ↑↓ (guardado en DB vía PATCH /categorias/reorder)
 * - Icono (emoji) y color personalizable por categoría
 * - Toggle activo/inactivo
 * - Contador de productos por categoría
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  IconButton, InputAdornment, Snackbar, Switch, TextField,
  Tooltip, Typography,
} from '@mui/material';
import {
  Add, ArrowDownward, ArrowUpward, Category,
  Close, Delete, Edit, Inventory2,
} from '@mui/icons-material';
import {
  categoriasService,
  type Categoria,
  type CreateCategoriaDto,
} from '../../services/categorias.service';

// ── Paleta de colores rápidos ─────────────────────────────────────────────────
const COLORES = [
  '#e53935', '#f57c00', '#fdd835', '#43a047',
  '#00acc1', '#1e88e5', '#8e24aa', '#6d4c41',
  '#546e7a', '#e91e63', '#00897b', '#fb8c00',
];

// ── Emojis sugeridos ──────────────────────────────────────────────────────────
const EMOJIS = ['🍕', '🍔', '🥤', '🍰', '🥗', '🍜', '🍣', '🌮', '🍗', '🥩', '🍺', '☕', '🍦', '🥪', '🍱'];

// ── Formulario de creación / edición ─────────────────────────────────────────
const EMPTY: CreateCategoriaDto = { nombre: '', descripcion: '', icono: '', color: '#1e88e5' };

function CategoriaForm({
  open, item, maxOrden, onClose, onSaved,
}: {
  open: boolean;
  item: Categoria | null;
  maxOrden: number;
  onClose: () => void;
  onSaved: (c: Categoria) => void;
}) {
  const isEdit = !!item;
  const [form, setForm]       = useState<CreateCategoriaDto>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(item
      ? { nombre: item.nombre, descripcion: item.descripcion || '', icono: item.icono || '', color: item.color || '#1e88e5' }
      : { ...EMPTY, orden: maxOrden });
  }, [open, item, maxOrden]);

  const set = (k: keyof CreateCategoriaDto) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setLoading(true);
    try {
      const c = isEdit
        ? await categoriasService.actualizar(item!.id, form)
        : await categoriasService.crear(form);
      onSaved(c);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isEdit ? <Edit fontSize="small" /> : <Add fontSize="small" />}
          <Typography fontWeight={700}>{isEdit ? 'Editar categoría' : 'Nueva categoría'}</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Nombre */}
          <TextField
            fullWidth label="Nombre *" value={form.nombre} onChange={set('nombre')}
            InputProps={{
              startAdornment: form.icono ? (
                <InputAdornment position="start">
                  <span style={{ fontSize: '1.2rem' }}>{form.icono}</span>
                </InputAdornment>
              ) : undefined,
            }}
          />

          {/* Descripción */}
          <TextField
            fullWidth label="Descripción" multiline rows={2}
            value={form.descripcion} onChange={set('descripcion')}
          />

          {/* Selector de emoji */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Icono (emoji)
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
              {EMOJIS.map(e => (
                <Box
                  key={e}
                  onClick={() => setForm(p => ({ ...p, icono: p.icono === e ? '' : e }))}
                  sx={{
                    fontSize: '1.4rem', cursor: 'pointer', p: 0.5, borderRadius: 1,
                    border: '2px solid', borderColor: form.icono === e ? 'primary.main' : 'transparent',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  {e}
                </Box>
              ))}
              {/* Campo libre para emoji personalizado */}
              <TextField
                size="small"
                placeholder="✏️"
                value={EMOJIS.includes(form.icono || '') ? '' : (form.icono || '')}
                onChange={e => setForm(p => ({ ...p, icono: e.target.value }))}
                sx={{ width: 72 }}
                inputProps={{ maxLength: 4, style: { fontSize: '1.2rem', textAlign: 'center' } }}
              />
            </Box>
          </Box>

          {/* Selector de color */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Color de la categoría
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
              {COLORES.map(c => (
                <Box
                  key={c}
                  onClick={() => setForm(p => ({ ...p, color: c }))}
                  sx={{
                    width: 28, height: 28, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                    border: '3px solid',
                    borderColor: form.color === c ? 'text.primary' : 'transparent',
                    '&:hover': { opacity: 0.85 },
                  }}
                />
              ))}
              {/* Color personalizado */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <input
                  type="color"
                  value={form.color || '#1e88e5'}
                  onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                  style={{ width: 28, height: 28, border: 'none', padding: 0, cursor: 'pointer', borderRadius: '50%' }}
                />
                <Typography variant="caption" color="text.secondary">{form.color}</Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} startIcon={<Close />} disabled={loading}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading}>
          {loading ? <CircularProgress size={20} /> : isEdit ? 'Guardar cambios' : 'Crear categoría'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export function Categorias() {
  const [items,    setItems]    = useState<Categoria[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<Categoria | null>(null);
  const [toast,    setToast]    = useState('');
  const [toastErr, setToastErr] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Cargar todas (activas + inactivas) para la gestión
      const all = await categoriasService.listar();
      setItems(all.sort((a, b) => a.orden - b.orden));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Reordenar: swap con el elemento adyacente y persistir ──────────────────
  const move = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;

    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    // Reasignar `orden` según la nueva posición
    const updated = next.map((c, i) => ({ ...c, orden: i }));
    setItems(updated);

    setSaving(true);
    try {
      await categoriasService.reordenar(updated.map(c => ({ id: c.id, orden: c.orden })));
      setToast('Orden guardado');
      setToastErr(false);
    } catch {
      setToast('Error al guardar el orden');
      setToastErr(true);
      load(); // revertir
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle activo/inactivo ─────────────────────────────────────────────────
  const handleToggle = async (c: Categoria) => {
    try {
      const updated = await categoriasService.toggleEstado(c.id, c.estado !== 'activo');
      setItems(prev => prev.map(x => x.id === updated.id ? updated : x));
      setToast(`Categoría ${updated.estado === 'activo' ? 'activada' : 'desactivada'}`);
      setToastErr(false);
    } catch (err: any) {
      setToast(err.response?.data?.error || 'Error al cambiar estado');
      setToastErr(true);
    }
  };

  // ── Eliminar ───────────────────────────────────────────────────────────────
  const handleDelete = async (c: Categoria) => {
    const count = c._count?.productos ?? 0;
    const msg = count > 0
      ? `La categoría "${c.nombre}" tiene ${count} producto(s). ¿Eliminar de todas formas?`
      : `¿Eliminar la categoría "${c.nombre}"?`;
    if (!window.confirm(msg)) return;
    try {
      await categoriasService.eliminar(c.id);
      setItems(prev => prev.filter(x => x.id !== c.id));
      setToast('Categoría eliminada');
      setToastErr(false);
    } catch (err: any) {
      setToast(err.response?.data?.error || 'Error al eliminar');
      setToastErr(true);
    }
  };

  // ── Saved callback ─────────────────────────────────────────────────────────
  const handleSaved = (c: Categoria) => {
    setItems(prev => {
      const idx = prev.findIndex(x => x.id === c.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = c; return n; }
      return [...prev, c].sort((a, b) => a.orden - b.orden);
    });
    setToast(editItem ? 'Categoría actualizada' : 'Categoría creada');
    setToastErr(false);
  };

  const activas   = items.filter(c => c.estado === 'activo').length;
  const inactivas = items.filter(c => c.estado !== 'activo').length;
  const maxOrden  = items.length;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Categorías</Typography>
          <Typography variant="body2" color="text.secondary">
            Organiza los productos del módulo de órdenes — arrastra para reordenar
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />}
          onClick={() => { setEditItem(null); setFormOpen(true); }}>
          Nueva categoría
        </Button>
      </Box>

      {/* Stats */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        {[
          { label: 'Total',     value: items.length, color: 'primary.main'   },
          { label: 'Activas',   value: activas,       color: 'success.main'   },
          { label: 'Inactivas', value: inactivas,     color: 'text.secondary' },
        ].map(s => (
          <Card key={s.label} sx={{ minWidth: 110 }}>
            <CardContent sx={{ textAlign: 'center', py: '12px !important' }}>
              <Typography variant="h4" fontWeight={700} color={s.color}>{s.value}</Typography>
              <Typography variant="caption" color="text.secondary">{s.label}</Typography>
            </CardContent>
          </Card>
        ))}
        {saving && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">Guardando orden...</Typography>
          </Box>
        )}
      </Box>

      {/* Lista */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
          <CircularProgress />
        </Box>
      ) : items.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center' }}>
          <Category sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography color="text.secondary" gutterBottom>No hay categorías creadas.</Typography>
          <Button variant="contained" startIcon={<Add />}
            onClick={() => { setEditItem(null); setFormOpen(true); }}>
            Crear primera categoría
          </Button>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {items.map((c, idx) => {
            const isActivo = c.estado === 'activo';
            const bgColor  = c.color || '#1e88e5';
            const count    = c._count?.productos ?? 0;

            return (
              <Card
                key={c.id}
                sx={{
                  opacity: isActivo ? 1 : 0.6,
                  borderLeft: `4px solid ${bgColor}`,
                  transition: 'box-shadow 0.15s',
                  '&:hover': { boxShadow: 3 },
                }}
              >
                <CardContent sx={{ py: '10px !important', display: 'flex', alignItems: 'center', gap: 2 }}>

                  {/* Controles de orden */}
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <IconButton size="small" onClick={() => move(idx, -1)} disabled={idx === 0 || saving}>
                      <ArrowUpward fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => move(idx, 1)} disabled={idx === items.length - 1 || saving}>
                      <ArrowDownward fontSize="small" />
                    </IconButton>
                  </Box>

                  {/* Icono + nombre */}
                  <Box
                    sx={{
                      width: 44, height: 44, borderRadius: 2, flexShrink: 0,
                      bgcolor: `${bgColor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {c.icono
                      ? <span style={{ fontSize: '1.5rem' }}>{c.icono}</span>
                      : <Category sx={{ color: bgColor }} />
                    }
                  </Box>

                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography fontWeight={700} noWrap>{c.nombre}</Typography>
                      <Chip
                        size="small"
                        label={`#${idx + 1}`}
                        sx={{ height: 18, fontSize: '0.65rem', bgcolor: `${bgColor}33`, color: bgColor }}
                      />
                    </Box>
                    {c.descripcion && (
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {c.descripcion}
                      </Typography>
                    )}
                  </Box>

                  {/* Productos */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 1 }}>
                    <Inventory2 fontSize="small" sx={{ color: 'text.disabled' }} />
                    <Typography variant="body2" color="text.secondary">{count}</Typography>
                  </Box>

                  {/* Estado toggle */}
                  <Tooltip title={isActivo ? 'Desactivar' : 'Activar'}>
                    <Switch
                      size="small"
                      checked={isActivo}
                      onChange={() => handleToggle(c)}
                    />
                  </Tooltip>

                  {/* Acciones */}
                  <Tooltip title="Editar">
                    <IconButton size="small" onClick={() => { setEditItem(c); setFormOpen(true); }}>
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Eliminar">
                    <IconButton size="small" color="error" onClick={() => handleDelete(c)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>

                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}

      {/* Nota de ayuda */}
      {items.length > 1 && (
        <Typography variant="caption" color="text.disabled" sx={{ mt: 2, display: 'block', textAlign: 'center' }}>
          Usa las flechas ↑↓ para cambiar el orden que se muestra en el módulo de órdenes.
          El cambio se guarda automáticamente.
        </Typography>
      )}

      {/* Dialog de creación/edición */}
      <CategoriaForm
        open={formOpen}
        item={editItem}
        maxOrden={maxOrden}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />

      {/* Toast */}
      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={toastErr ? 'error' : 'success'} onClose={() => setToast('')}>
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
}
