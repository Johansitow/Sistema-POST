import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert, Autocomplete, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  IconButton, List, ListItem, ListItemSecondaryAction, ListItemText,
  MenuItem, Select, TextField, Tooltip, Typography,
} from '@mui/material';
import { Add, AccountTree, Check, Close, Delete, Edit, ManageAccounts, People } from '@mui/icons-material';
import {
  grupoNegocioService,
  type GrupoNegocio, type GrupoMiembro, type CreateGrupoDto,
} from '../../services/grupo-negocio.service';
import { usuariosService } from '../../services/usuarios.service';
import { LoadingScreen, EmptyState } from '../../components/common';

const PLAN_LABELS: Record<string, string> = {
  starter:    'Starter',
  pro:        'Pro',
  enterprise: 'Enterprise',
};

const PLAN_COLORS: Record<string, 'default' | 'primary' | 'secondary'> = {
  starter:    'default',
  pro:        'primary',
  enterprise: 'secondary',
};

// ── Form dialog ──────────────────────────────────────────────────────────────

const EMPTY: CreateGrupoDto = { nombre: '', nit: '', plan: 'starter' };

function GrupoForm({ open, item, onClose, onSaved }: {
  open: boolean;
  item: GrupoNegocio | null;
  onClose: () => void;
  onSaved: (g: GrupoNegocio) => void;
}) {
  const isEdit = !!item;
  const [form, setForm]       = useState<CreateGrupoDto>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(item
      ? { nombre: item.nombre, nit: item.nit ?? '', plan: item.plan }
      : { ...EMPTY });
  }, [open, item]);

  const set = (k: keyof CreateGrupoDto) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setLoading(true);
    try {
      const g = isEdit
        ? await grupoNegocioService.actualizar(item!.id, form)
        : await grupoNegocioService.crear(form);
      onSaved(g);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isEdit ? <Edit fontSize="small" /> : <Add fontSize="small" />}
          <Typography fontWeight={700}>{isEdit ? 'Editar grupo' : 'Nuevo grupo de negocio'}</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField fullWidth label="Nombre *" value={form.nombre} onChange={set('nombre')} />
        <TextField fullWidth label="NIT / RUT" value={form.nit} onChange={set('nit')} />
        <TextField
          fullWidth select label="Plan"
          value={form.plan} onChange={set('plan')}
          SelectProps={{ native: true }}
        >
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </TextField>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading} startIcon={loading ? <CircularProgress size={16} /> : <Check />}>
          {isEdit ? 'Guardar' : 'Crear'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Dialog: gestión de miembros ───────────────────────────────────────────────

const ROL_LABELS: Record<string, string> = {
  owner:    'Propietario',
  admin:    'Administrador',
  operador: 'Operador',
};

interface UsuarioBasico { id: number; nombre_completo: string; usuario: string; }

function MiembrosDialog({ grupo, onClose }: { grupo: GrupoNegocio; onClose: () => void }) {
  const [miembros, setMiembros]   = useState<GrupoMiembro[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [usuarios, setUsuarios]   = useState<UsuarioBasico[]>([]);
  const [selUsuario, setSelUsuario] = useState<UsuarioBasico | null>(null);
  const [rolNuevo, setRolNuevo]   = useState<'owner' | 'admin' | 'operador'>('operador');
  const [saving, setSaving]       = useState(false);

  const cargarMiembros = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await grupoNegocioService.listarMiembros(grupo.id);
      setMiembros(res);
    } catch {
      setError('Error al cargar miembros');
    } finally {
      setLoading(false);
    }
  }, [grupo.id]);

  useEffect(() => {
    cargarMiembros();
    usuariosService.listar({ limit: 200 }).then((r: any) => {
      setUsuarios((r.data ?? []).map((u: any) => ({
        id: u.id,
        nombre_completo: u.nombre_completo,
        usuario: u.usuario,
      })));
    }).catch(() => {});
  }, [cargarMiembros]);

  const handleAsignar = async () => {
    if (!selUsuario) return;
    setSaving(true);
    setError('');
    try {
      const nuevo = await grupoNegocioService.asignarMiembro(grupo.id, selUsuario.id, rolNuevo);
      setMiembros(prev => [...prev, nuevo]);
      setSelUsuario(null);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al asignar miembro');
    } finally {
      setSaving(false);
    }
  };

  const handleRemover = async (idUsuario: number) => {
    try {
      await grupoNegocioService.removerMiembro(grupo.id, idUsuario);
      setMiembros(prev => prev.filter(m => m.usuario.id !== idUsuario));
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al remover miembro');
    }
  };

  // Excluir de las opciones a los que ya son miembros
  const miembroIds = new Set(miembros.map(m => m.usuario.id));
  const opciones   = usuarios.filter(u => !miembroIds.has(u.id));

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ManageAccounts fontSize="small" />
          <Typography fontWeight={700}>Miembros — {grupo.nombre}</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

        {/* Agregar miembro */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <Autocomplete
            sx={{ flex: 2 }}
            options={opciones}
            value={selUsuario}
            onChange={(_e, v) => setSelUsuario(v)}
            getOptionLabel={u => `${u.nombre_completo} (@${u.usuario})`}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={params => (
              <TextField {...params} size="small" label="Agregar usuario" />
            )}
            noOptionsText="Sin usuarios disponibles"
          />
          <Select
            size="small"
            value={rolNuevo}
            onChange={e => setRolNuevo(e.target.value as typeof rolNuevo)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="operador">Operador</MenuItem>
            <MenuItem value="admin">Administrador</MenuItem>
            <MenuItem value="owner">Propietario</MenuItem>
          </Select>
          <Button
            variant="contained" size="small"
            disabled={!selUsuario || saving}
            startIcon={saving ? <CircularProgress size={14} /> : <Add />}
            onClick={handleAsignar}
            sx={{ mt: 0.3, height: 40 }}
          >
            Agregar
          </Button>
        </Box>

        {/* Lista de miembros */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        ) : miembros.length === 0 ? (
          <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
            Este grupo no tiene miembros asignados.
          </Typography>
        ) : (
          <List dense disablePadding>
            {miembros.map(m => (
              <ListItem key={m.usuario.id} divider>
                <ListItemText
                  primary={m.usuario.nombre_completo}
                  secondary={`@${m.usuario.usuario} · ${ROL_LABELS[m.rol_en_grupo] ?? m.rol_en_grupo}`}
                />
                <ListItemSecondaryAction>
                  <Tooltip title="Remover del grupo">
                    <IconButton
                      size="small"
                      onClick={() => handleRemover(m.usuario.id)}
                      color="error"
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function GruposNegocio() {
  const [grupos, setGrupos]         = useState<GrupoNegocio[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [dialog, setDialog]         = useState<{ open: boolean; item: GrupoNegocio | null }>({ open: false, item: null });
  const [miembrosGrupo, setMiembrosGrupo] = useState<GrupoNegocio | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await grupoNegocioService.listar();
      setGrupos(res.data);
    } catch {
      setError('Error al cargar los grupos de negocio');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleSaved = (g: GrupoNegocio) => {
    setGrupos(prev => {
      const idx = prev.findIndex(x => x.id === g.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = g; return next; }
      return [g, ...prev];
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AccountTree color="primary" />
          <Box>
            <Typography variant="h5" fontWeight={700}>Grupos de Negocio</Typography>
            <Typography variant="body2" color="text.secondary">Gestión multi-restaurante SaaS</Typography>
          </Box>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setDialog({ open: true, item: null })}>
          Nuevo grupo
        </Button>
      </Box>

      {/* Error */}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Loading */}
      {loading && <LoadingScreen variant="inline" message="Cargando grupos de negocio..." />}

      {/* Lista */}
      {!loading && grupos.length === 0 && (
        <EmptyState
          message="No hay grupos de negocio registrados"
          icon={<AccountTree sx={{ fontSize: 48, color: 'text.disabled' }} />}
        />
      )}

      {!loading && grupos.map(g => (
        <Card key={g.id} variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography variant="h6" fontWeight={700}>{g.nombre}</Typography>
                  <Chip
                    size="small"
                    label={PLAN_LABELS[g.plan] ?? g.plan}
                    color={PLAN_COLORS[g.plan] ?? 'default'}
                  />
                  {!g.activo && <Chip size="small" label="Inactivo" color="error" />}
                </Box>
                {g.nit && (
                  <Typography variant="body2" color="text.secondary">NIT: {g.nit}</Typography>
                )}
                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <AccountTree fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {g._count.restaurantes} restaurante{g._count.restaurantes !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <People fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {g._count.usuarios} miembro{g._count.usuarios !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Tooltip title="Gestionar miembros">
                  <IconButton size="small" onClick={() => setMiembrosGrupo(g)}>
                    <ManageAccounts fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Editar">
                  <IconButton size="small" onClick={() => setDialog({ open: true, item: g })}>
                    <Edit fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Restaurantes del grupo */}
            {g.restaurantes.length > 0 && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <List dense disablePadding>
                  {g.restaurantes.map(r => (
                    <ListItem key={r.id} disableGutters>
                      <ListItemText
                        primary={r.nombre}
                        secondary={[r.tipo_tenant, r.ciudad].filter(Boolean).join(' · ') || undefined}
                      />
                      {r.es_default && <Chip size="small" label="Default" variant="outlined" />}
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Dialog crear/editar grupo */}
      <GrupoForm
        open={dialog.open}
        item={dialog.item}
        onClose={() => setDialog({ open: false, item: null })}
        onSaved={handleSaved}
      />

      {/* Dialog gestión de miembros */}
      {miembrosGrupo && (
        <MiembrosDialog
          grupo={miembrosGrupo}
          onClose={() => setMiembrosGrupo(null)}
        />
      )}
    </Box>
  );
}
