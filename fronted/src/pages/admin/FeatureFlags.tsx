/**
 * Página: Gestión de Feature Flags
 * Permite activar/desactivar funcionalidades del sistema sin tocar código.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, FormControlLabel, IconButton, InputLabel,
  MenuItem, Paper, Select, Snackbar, Switch, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField,
  Tooltip, Typography, Divider,
} from '@mui/material';
import {
  Add, Delete, Edit, Flag, Refresh, Close, ToggleOn, ToggleOff,
} from '@mui/icons-material';
import {
  featureFlagsService,
  type FeatureFlag,
  type CreateFeatureFlagDto,
} from '../../services/feature-flags.service';
import { useFeatureFlagStore } from '../../store/featureFlagStore';
import { LoadingScreen, EmptyState, ConfirmDialog } from '../../components/common';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SCOPE_LABELS: Record<string, string> = {
  global:   'Global',
  contexto: 'Por contexto',
};

const SCOPE_COLORS: Record<string, 'primary' | 'secondary'> = {
  global:   'primary',
  contexto: 'secondary',
};

// ─── Dialog crear / editar ────────────────────────────────────────────────────

interface FormDialogProps {
  open:    boolean;
  flag:    FeatureFlag | null;
  onClose: () => void;
  onSave:  () => void;
}

function FormDialog({ open, flag, onClose, onSave }: FormDialogProps) {
  const isEdit = !!flag;
  const [form, setForm] = useState<CreateFeatureFlagDto>({
    nombre: '', descripcion: '', habilitado: false, scope: 'global',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (open) {
      setError('');
      setForm(
        flag
          ? { nombre: flag.nombre, descripcion: flag.descripcion ?? '',
              habilitado: flag.habilitado, scope: flag.scope as any }
          : { nombre: '', descripcion: '', habilitado: false, scope: 'global' }
      );
    }
  }, [open, flag]);

  const handleSubmit = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    if (!/^[a-z_]+$/.test(form.nombre)) {
      setError('Solo letras minúsculas y guiones bajos (ej: variantes_productos)');
      return;
    }
    setLoading(true);
    try {
      if (isEdit && flag) {
        await featureFlagsService.actualizar(flag.id, form);
      } else {
        await featureFlagsService.crear(form);
      }
      onSave();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Flag color="primary" />
        {isEdit ? 'Editar Feature Flag' : 'Nuevo Feature Flag'}
        <IconButton onClick={onClose} sx={{ ml: 'auto' }} size="small">
          <Close />
        </IconButton>
      </DialogTitle>
      <Divider />

      <DialogContent sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

        <TextField
          label="Nombre del flag"
          value={form.nombre}
          onChange={e => setForm(p => ({ ...p, nombre: e.target.value.toLowerCase().replace(/[^a-z_]/g, '') }))}
          disabled={isEdit}
          fullWidth
          helperText="Solo letras minúsculas y guiones bajos — ej: variantes_productos"
          placeholder="variantes_productos"
          inputProps={{ style: { fontFamily: 'monospace' } }}
        />

        <TextField
          label="Descripción"
          value={form.descripcion}
          onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
          fullWidth
          multiline
          rows={2}
          placeholder="¿Qué funcionalidad controla este flag?"
        />

        <FormControl fullWidth>
          <InputLabel>Alcance</InputLabel>
          <Select
            value={form.scope}
            label="Alcance"
            onChange={e => setForm(p => ({ ...p, scope: e.target.value as any }))}
          >
            <MenuItem value="global">Global — aplica a todo el sistema</MenuItem>
            <MenuItem value="contexto">Por contexto — se activa por restaurante u otro criterio</MenuItem>
          </Select>
        </FormControl>

        <FormControlLabel
          control={
            <Switch
              checked={form.habilitado}
              onChange={e => setForm(p => ({ ...p, habilitado: e.target.checked }))}
              color="success"
            />
          }
          label={
            <Box>
              <Typography variant="body2" fontWeight={600}>
                {form.habilitado ? 'Habilitado' : 'Deshabilitado'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {form.habilitado
                  ? 'La funcionalidad estará activa al guardar'
                  : 'La funcionalidad estará oculta hasta que se active'}
              </Typography>
            </Box>
          }
        />
      </DialogContent>

      <Divider />
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          {loading ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear Flag'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function FeatureFlags() {
  const [flags,      setFlags]      = useState<FeatureFlag[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editFlag,   setEditFlag]   = useState<FeatureFlag | null>(null);
  const [toast,      setToast]      = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [toggling,   setToggling]   = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FeatureFlag | null>(null);

  const { loadFlags } = useFeatureFlagStore();

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    try {
      const data = await featureFlagsService.listar();
      setFlags(data);
    } catch {
      setToast({ msg: 'Error al cargar los feature flags', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFlags(); }, [fetchFlags]);

  const handleToggle = async (flag: FeatureFlag) => {
    setToggling(flag.id);
    try {
      await featureFlagsService.actualizar(flag.id, { habilitado: !flag.habilitado });
      await fetchFlags();
      await loadFlags(); // sincronizar el store global
      setToast({
        msg: `"${flag.nombre}" ${!flag.habilitado ? 'habilitado' : 'deshabilitado'}`,
        type: 'success',
      });
    } catch {
      setToast({ msg: 'Error al cambiar el estado', type: 'error' });
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async (flag: FeatureFlag) => {
    try {
      await featureFlagsService.eliminar(flag.id);
      await fetchFlags();
      await loadFlags();
      setToast({ msg: `Flag "${flag.nombre}" eliminado`, type: 'success' });
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.error || 'Error al eliminar', type: 'error' });
    }
  };

  const handleSave = async () => {
    await fetchFlags();
    await loadFlags();
    setToast({ msg: editFlag ? 'Flag actualizado' : 'Flag creado correctamente', type: 'success' });
  };

  const openCreate = () => { setEditFlag(null); setDialogOpen(true); };
  const openEdit   = (flag: FeatureFlag) => { setEditFlag(flag); setDialogOpen(true); };

  const enabledCount  = flags.filter(f => f.habilitado).length;
  const disabledCount = flags.length - enabledCount;

  return (
    <Box>
      {/* Encabezado */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Flag color="primary" /> Feature Flags
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Activa o desactiva funcionalidades del sistema sin modificar código
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Recargar">
            <IconButton onClick={fetchFlags} disabled={loading}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
            Nuevo Flag
          </Button>
        </Box>
      </Box>

      {/* Estadísticas */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {[
          { label: 'Total',         value: flags.length,   color: '#1976d2' },
          { label: 'Habilitados',   value: enabledCount,   color: '#2e7d32' },
          { label: 'Deshabilitados',value: disabledCount,  color: '#9e9e9e' },
        ].map(stat => (
          <Card key={stat.label} sx={{ minWidth: 130, flex: '1 1 130px' }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="h4" fontWeight={800} sx={{ color: stat.color }}>
                {stat.value}
              </Typography>
              <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Tabla */}
      {loading ? (
        <LoadingScreen variant="inline" message="Cargando feature flags..." />
      ) : flags.length === 0 ? (
        <Paper sx={{ borderRadius: 2 }}>
          <EmptyState
            message="No hay feature flags creados"
            description="Crea el primero para empezar a controlar funcionalidades"
            icon={<Flag sx={{ fontSize: 48, color: 'text.disabled' }} />}
            actionLabel="Crear primer flag"
            onAction={openCreate}
          />
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell width={60} align="center"><strong>Estado</strong></TableCell>
                <TableCell><strong>Nombre</strong></TableCell>
                <TableCell><strong>Descripción</strong></TableCell>
                <TableCell width={120} align="center"><strong>Alcance</strong></TableCell>
                <TableCell width={100} align="center"><strong>Acciones</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {flags.map(flag => (
                <TableRow
                  key={flag.id}
                  hover
                  sx={{
                    opacity: flag.habilitado ? 1 : 0.6,
                    transition: 'opacity 0.2s',
                    '&:last-child td': { border: 0 },
                  }}
                >
                  {/* Toggle */}
                  <TableCell align="center">
                    <Tooltip title={flag.habilitado ? 'Deshabilitar' : 'Habilitar'}>
                      <span>
                        <IconButton
                          onClick={() => handleToggle(flag)}
                          disabled={toggling === flag.id}
                          size="small"
                          color={flag.habilitado ? 'success' : 'default'}
                        >
                          {toggling === flag.id
                            ? <CircularProgress size={20} />
                            : flag.habilitado
                              ? <ToggleOn sx={{ fontSize: 28 }} />
                              : <ToggleOff sx={{ fontSize: 28 }} />
                          }
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>

                  {/* Nombre */}
                  <TableCell>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                    >
                      {flag.nombre}
                    </Typography>
                    <Chip
                      label={flag.habilitado ? 'Activo' : 'Inactivo'}
                      size="small"
                      color={flag.habilitado ? 'success' : 'default'}
                      variant="outlined"
                      sx={{ mt: 0.5, height: 18, fontSize: '0.65rem' }}
                    />
                  </TableCell>

                  {/* Descripción */}
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {flag.descripcion || <em style={{ opacity: 0.5 }}>Sin descripción</em>}
                    </Typography>
                  </TableCell>

                  {/* Scope */}
                  <TableCell align="center">
                    <Chip
                      label={SCOPE_LABELS[flag.scope] ?? flag.scope}
                      size="small"
                      color={SCOPE_COLORS[flag.scope] ?? 'default'}
                      variant="filled"
                    />
                  </TableCell>

                  {/* Acciones */}
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => openEdit(flag)}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar">
                        <IconButton size="small" color="error" onClick={() => setConfirmDelete(flag)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Sección de ayuda */}
      <Paper sx={{ mt: 3, p: 2.5, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.100' }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          ¿Cómo usar los flags en el código?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Importa el hook <code style={{ background: '#eee', padding: '1px 6px', borderRadius: 4 }}>useFeatureFlag</code> en cualquier componente:
        </Typography>
        <Box
          component="pre"
          sx={{
            bgcolor: '#1e1e1e', color: '#d4d4d4', p: 2, borderRadius: 1,
            fontSize: '0.78rem', overflowX: 'auto', m: 0,
          }}
        >
{`import { useFeatureFlag } from '../../store/featureFlagStore';

function MiComponente() {
  const activo = useFeatureFlag('nombre_del_flag');
  return activo ? <NuevaFuncionalidad /> : null;
}`}
        </Box>
      </Paper>

      {/* Dialog */}
      <FormDialog
        open={dialogOpen}
        flag={editFlag}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />

      {/* Toast */}
      <Snackbar
        open={!!toast}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast?.type} onClose={() => setToast(null)} variant="filled">
          {toast?.msg}
        </Alert>
      </Snackbar>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Eliminar feature flag"
        message={`¿Eliminar el flag "${confirmDelete?.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        confirmColor="error"
        onConfirm={async () => { if (confirmDelete) await handleDelete(confirmDelete); }}
        onClose={() => setConfirmDelete(null)}
      />
    </Box>
  );
}
