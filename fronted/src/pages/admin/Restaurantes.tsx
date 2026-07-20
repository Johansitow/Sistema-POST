import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Alert, Autocomplete, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  FormControl, FormHelperText, Grid, IconButton, InputLabel,
  List, ListItem, ListItemAvatar, ListItemText, MenuItem, Select, Step, StepLabel, Stepper,
  Snackbar, Switch, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  Add, Business, Check, Close, Edit, People, PersonAdd, PersonRemove,
  PowerSettingsNew, Star, StarBorder, Link as LinkIcon, LinkOff,
  LocationOn, Phone, Email, Store, CheckCircle, Cancel,
} from '@mui/icons-material';
import {
  restaurantesService,
  type Restaurante, type TipoTenant,
  type UsuarioAsignado, type UsuarioItem,
} from '../../services/restaurantes.service';
import { grupoNegocioService, type GrupoNegocio } from '../../services/grupo-negocio.service';
import { useAuthStore } from '../../store/useStore';
import { LoadingScreen, EmptyState } from '../../components/common';

const FieldRow = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ display: 'flex', gap: 2 }}>{children}</Box>
);

const TENANT_LABELS: Record<TipoTenant, { label: string; desc: string; color: 'default' | 'primary' | 'warning' }> = {
  compartido: { label: 'Compartido', desc: 'Mismo negocio — comparte usuarios y sesión', color: 'primary' },
  aislado:    { label: 'Aislado',    desc: 'Tenant independiente — datos completamente separados', color: 'warning' },
};

// ─── Formulario de datos del restaurante (reutilizado en wizard y edición) ───

interface RestauranteFields {
  nombre: string; nit: string; descripcion: string; logo_url: string;
  direccion: string; ciudad: string; telefono: string; email: string;
  es_default: boolean;
}

const EMPTY_FIELDS: RestauranteFields = {
  nombre: '', nit: '', descripcion: '', logo_url: '',
  direccion: '', ciudad: '', telefono: '', email: '', es_default: false,
};

function RestauranteFieldsForm({ fields, onChange, ocultarDefault = false }: {
  fields: RestauranteFields;
  onChange: (f: Partial<RestauranteFields>) => void;
  /** Los admins de grupo no controlan es_default (el backend lo ignora igualmente) */
  ocultarDefault?: boolean;
}) {
  const set = (k: keyof RestauranteFields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ [k]: e.target.value });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <FieldRow>
        <TextField fullWidth label="Nombre *" value={fields.nombre} onChange={set('nombre')} />
        <TextField fullWidth label="NIT / RUT" value={fields.nit} onChange={set('nit')} />
      </FieldRow>
      <TextField fullWidth label="Descripción" multiline rows={2} value={fields.descripcion} onChange={set('descripcion')} />
      <FieldRow>
        <TextField fullWidth label="Dirección" value={fields.direccion} onChange={set('direccion')} />
        <TextField fullWidth label="Ciudad" value={fields.ciudad} onChange={set('ciudad')} />
      </FieldRow>
      <FieldRow>
        <TextField fullWidth label="Teléfono" value={fields.telefono} onChange={set('telefono')} />
        <TextField fullWidth label="Email" type="email" value={fields.email} onChange={set('email')} />
      </FieldRow>
      <TextField fullWidth label="URL del logo" placeholder="https://..." value={fields.logo_url} onChange={set('logo_url')} />
      {!ocultarDefault && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Switch checked={fields.es_default} onChange={e => onChange({ es_default: e.target.checked })} />
          <Typography variant="body2">Restaurante por defecto</Typography>
        </Box>
      )}
    </Box>
  );
}

// ─── Wizard de creación (pasos 0 y 1) ────────────────────────────────────────

function CrearRestauranteWizard({ open, onClose, onSaved }: {
  open: boolean; onClose: () => void; onSaved: (r: Restaurante) => void;
}) {
  // Superadmin: wizard completo (elegir tipo de tenant + grupo).
  // Admin de grupo: solo el formulario — el backend fuerza SU grupo y valida
  // el límite de sedes del plan (no puede elegir grupo ni tipo de tenant).
  const { isSuperAdmin } = useAuthStore();
  const esSA = isSuperAdmin();

  // Paso 0: decisión  |  Paso 1: formulario
  const [step,         setStep]         = useState<0 | 1>(0);
  const [tipoTenant,   setTipoTenant]   = useState<TipoTenant | null>(null);

  // Compartido: seleccionar grupo existente
  const [grupos,       setGrupos]       = useState<GrupoNegocio[]>([]);
  const [grupoSel,     setGrupoSel]     = useState<GrupoNegocio | null>(null);
  const [loadingGrp,   setLoadingGrp]   = useState(false);

  // Aislado: datos del nuevo grupo
  const [grupoNombre,  setGrupoNombre]  = useState('');
  const [grupoPlan,    setGrupoPlan]    = useState('starter');

  // Datos del restaurante
  const [fields,       setFields]       = useState<RestauranteFields>(EMPTY_FIELDS);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

  // Reset al abrir — un admin de grupo entra directo al formulario
  useEffect(() => {
    if (!open) return;
    setStep(esSA ? 0 : 1);
    setTipoTenant(null);
    setGrupoSel(null);
    setGrupoNombre('');
    setGrupoPlan('starter');
    setFields(EMPTY_FIELDS);
    setError('');
  }, [open]);

  // Cargar grupos cuando el usuario elige "compartido"
  const handleElegirTipo = async (tipo: TipoTenant) => {
    setTipoTenant(tipo);
    setError('');
    if (tipo === 'compartido') {
      setLoadingGrp(true);
      try {
        const res = await grupoNegocioService.listar({ activo: true, limit: 200 });
        setGrupos(res.data);
      } catch {
        setError('No se pudieron cargar los grupos de negocio');
      } finally {
        setLoadingGrp(false);
      }
    }
    setStep(1);
  };

  const handleSave = async () => {
    if (!fields.nombre.trim()) { setError('El nombre del restaurante es obligatorio'); return; }

    if (esSA && tipoTenant === 'compartido' && !grupoSel) {
      setError('Selecciona el grupo de negocio al que pertenece este restaurante');
      return;
    }
    if (esSA && tipoTenant === 'aislado' && !grupoNombre.trim()) {
      setError('El nombre del negocio es obligatorio');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const base = {
        ...fields,
        nit:         fields.nit       || undefined,
        descripcion: fields.descripcion || undefined,
        logo_url:    fields.logo_url   || undefined,
        direccion:   fields.direccion  || undefined,
        ciudad:      fields.ciudad     || undefined,
        telefono:    fields.telefono   || undefined,
        email:       fields.email      || undefined,
      };

      let r: Restaurante;
      if (esSA) {
        let id_grupo: number;
        if (tipoTenant === 'aislado') {
          // Crear el grupo de negocio independiente primero
          const nuevoGrupo = await grupoNegocioService.crear({ nombre: grupoNombre.trim(), plan: grupoPlan });
          id_grupo = nuevoGrupo.id;
        } else {
          id_grupo = grupoSel!.id;
        }
        r = await restaurantesService.crear({ ...base, id_grupo, tipo_tenant: tipoTenant! });
      } else {
        // Admin de grupo: sin id_grupo ni tipo_tenant — el backend fuerza su grupo
        r = await restaurantesService.crear(base as Parameters<typeof restaurantesService.crear>[0]);
      }
      onSaved(r);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear el restaurante');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Add fontSize="small" />
          <Typography fontWeight={700}>Nuevo restaurante</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
      </DialogTitle>
      <Divider />

      {/* Stepper indicador — solo aplica al flujo del superadmin */}
      {esSA && (
        <Box sx={{ px: 3, pt: 2 }}>
          <Stepper activeStep={step} alternativeLabel>
            <Step><StepLabel>Tipo de negocio</StepLabel></Step>
            <Step><StepLabel>Datos del restaurante</StepLabel></Step>
          </Stepper>
        </Box>
      )}

      <DialogContent sx={{ pt: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* ── Paso 0: Decisión A/B ─────────────────────────────────────── */}
        {step === 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
              ¿Este restaurante forma parte de un negocio ya registrado en el sistema?
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>

              {/* Opción A — Compartido */}
              <Card
                variant="outlined"
                onClick={() => handleElegirTipo('compartido')}
                sx={{
                  flex: 1, cursor: 'pointer', transition: 'all 0.15s',
                  '&:hover': { borderColor: 'primary.main', boxShadow: 2 },
                  p: 1,
                }}
              >
                <CardContent sx={{ textAlign: 'center' }}>
                  <LinkIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                  <Typography fontWeight={700} gutterBottom>Sí, mismo negocio</Typography>
                  <Chip label="Compartido" color="primary" size="small" sx={{ mb: 1.5 }} />
                  <Typography variant="caption" color="text.secondary" display="block">
                    Comparte usuarios, sesión y catálogo de productos con otros restaurantes del grupo.
                    Inventario y caja son siempre independientes.
                  </Typography>
                </CardContent>
              </Card>

              {/* Opción B — Aislado */}
              <Card
                variant="outlined"
                onClick={() => handleElegirTipo('aislado')}
                sx={{
                  flex: 1, cursor: 'pointer', transition: 'all 0.15s',
                  '&:hover': { borderColor: 'warning.main', boxShadow: 2 },
                  p: 1,
                }}
              >
                <CardContent sx={{ textAlign: 'center' }}>
                  <LinkOff sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                  <Typography fontWeight={700} gutterBottom>No, es independiente</Typography>
                  <Chip label="Aislado" color="warning" size="small" sx={{ mb: 1.5 }} />
                  <Typography variant="caption" color="text.secondary" display="block">
                    Datos completamente separados. No comparte usuarios, productos ni configuración.
                    Funciona como un tenant SaaS independiente.
                  </Typography>
                </CardContent>
              </Card>

            </Box>
          </Box>
        )}

        {/* ── Paso 1: Formulario ────────────────────────────────────────── */}
        {step === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

            {/* Contexto de grupo */}
            {tipoTenant === 'compartido' && (
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LinkIcon fontSize="small" color="primary" /> Grupo de negocio existente
                </Typography>
                {loadingGrp ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}><CircularProgress size={24} /></Box>
                ) : (
                  <Autocomplete
                    options={grupos}
                    value={grupoSel}
                    onChange={(_, v) => setGrupoSel(v)}
                    getOptionLabel={g => g.nombre}
                    isOptionEqualToValue={(a, b) => a.id === b.id}
                    renderOption={(props, g) => (
                      <Box component="li" {...props}>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{g.nombre}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {g._count.restaurantes} restaurante{g._count.restaurantes !== 1 ? 's' : ''} · Plan {g.plan}
                            {g.nit ? ` · NIT ${g.nit}` : ''}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                    renderInput={params => (
                      <TextField {...params} label="Grupo de negocio *" placeholder="Buscar grupo..." />
                    )}
                    noOptionsText="No hay grupos disponibles"
                  />
                )}
                <FormHelperText>
                  Este restaurante heredará los usuarios y el catálogo del grupo seleccionado.
                </FormHelperText>
              </Box>
            )}

            {tipoTenant === 'aislado' && (
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LinkOff fontSize="small" color="warning" /> Nuevo negocio independiente
                </Typography>
                <Alert severity="info" sx={{ mb: 1.5 }} icon={false}>
                  Se creará un grupo de negocio exclusivo para este restaurante. No compartirá nada con otros.
                </Alert>
                <FieldRow>
                  <TextField
                    fullWidth label="Nombre del negocio *"
                    placeholder="ej. Franquicia XYZ S.A.S."
                    value={grupoNombre}
                    onChange={e => setGrupoNombre(e.target.value)}
                  />
                  <FormControl fullWidth>
                    <InputLabel>Plan</InputLabel>
                    <Select value={grupoPlan} label="Plan" onChange={e => setGrupoPlan(e.target.value)}>
                      <MenuItem value="starter">Starter</MenuItem>
                      <MenuItem value="pro">Pro</MenuItem>
                      <MenuItem value="enterprise">Enterprise</MenuItem>
                    </Select>
                  </FormControl>
                </FieldRow>
              </Box>
            )}

            <Divider />
            <Typography variant="subtitle2" fontWeight={700}>Datos del restaurante</Typography>
            <RestauranteFieldsForm
              fields={fields}
              onChange={f => setFields(p => ({ ...p, ...f }))}
              ocultarDefault={!esSA}
            />
          </Box>
        )}
      </DialogContent>

      <Divider />
      <DialogActions sx={{ px: 3, py: 1.5, justifyContent: 'space-between' }}>
        <Button
          onClick={() => (step === 0 || !esSA) ? onClose() : setStep(0)}
          startIcon={<Close fontSize="small" />}
          disabled={loading}
        >
          {(step === 0 || !esSA) ? 'Cancelar' : 'Volver'}
        </Button>
        {step === 1 && (
          <Button variant="contained" onClick={handleSave} disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Check />}>
            Crear restaurante
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ─── Formulario de edición (sin wizard — el tipo no cambia post-creación) ────

function EditarRestauranteForm({ open, item, onClose, onSaved }: {
  open: boolean; item: Restaurante; onClose: () => void; onSaved: (r: Restaurante) => void;
}) {
  const [fields,  setFields]  = useState<RestauranteFields>(EMPTY_FIELDS);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setFields({
      nombre:      item.nombre,
      nit:         item.nit         || '',
      descripcion: item.descripcion || '',
      logo_url:    item.logo_url    || '',
      direccion:   item.direccion   || '',
      ciudad:      item.ciudad      || '',
      telefono:    item.telefono    || '',
      email:       item.email       || '',
      es_default:  item.es_default,
    });
  }, [open, item]);

  const handleSave = async () => {
    if (!fields.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setLoading(true);
    try {
      const r = await restaurantesService.actualizar(item.id, {
        ...fields,
        nit:         fields.nit         || undefined,
        descripcion: fields.descripcion || undefined,
        logo_url:    fields.logo_url    || undefined,
        direccion:   fields.direccion   || undefined,
        ciudad:      fields.ciudad      || undefined,
        telefono:    fields.telefono    || undefined,
        email:       fields.email       || undefined,
      });
      onSaved(r);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Edit fontSize="small" />
          <Typography fontWeight={700}>Editar restaurante</Typography>
          <Chip
            size="small"
            label={TENANT_LABELS[item.tipo_tenant ?? 'compartido']?.label}
            color={TENANT_LABELS[item.tipo_tenant ?? 'compartido']?.color ?? 'default'}
            variant="outlined"
          />
        </Box>
        <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Alert severity="info" sx={{ mb: 2 }} icon={false}>
          El tipo de tenant (<strong>{TENANT_LABELS[item.tipo_tenant ?? 'compartido']?.label}</strong>) no puede modificarse después de la creación.
        </Alert>
        <RestauranteFieldsForm
          fields={fields}
          onChange={f => setFields(p => ({ ...p, ...f }))}
          ocultarDefault={!useAuthStore.getState().isSuperAdmin()}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} startIcon={<Close />} disabled={loading}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading}>
          {loading ? <CircularProgress size={20} /> : 'Guardar cambios'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function UsuariosDialog({ restaurante, onClose }: { restaurante: Restaurante | null; onClose: () => void }) {
  const open = !!restaurante;
  const [asignados, setAsignados]   = useState<UsuarioAsignado[]>([]);
  const [usuarios,  setUsuarios]    = useState<UsuarioItem[]>([]);
  const [selected,  setSelected]    = useState<UsuarioItem | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [saving,    setSaving]      = useState<number | null>(null);
  const [adding,    setAdding]      = useState(false);
  const [error,     setError]       = useState('');
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load assigned users when dialog opens
  useEffect(() => {
    if (!restaurante) return;
    setAsignados([]);
    setSelected(null);
    setError('');
    setLoadingList(true);
    restaurantesService.listarUsuarios(restaurante.id)
      .then(setAsignados)
      .catch(() => setError('No se pudieron cargar los usuarios'))
      .finally(() => setLoadingList(false));
  }, [restaurante]);

  // Debounced user search for autocomplete
  const handleSearch = (q: string) => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(async () => {
      try {
        const list = await restaurantesService.buscarUsuarios(q || undefined);
        // Exclude already-assigned users
        const assignedIds = new Set(asignados.map(a => a.id_usuario));
        setUsuarios(list.filter(u => !assignedIds.has(u.id)));
      } catch {}
    }, 300);
  };

  const handleAsignar = async () => {
    if (!restaurante || !selected) return;
    setAdding(true);
    setError('');
    try {
      const nuevo = await restaurantesService.asignarUsuario(restaurante.id, selected.id);
      setAsignados(prev => [...prev, nuevo]);
      setSelected(null);
      setUsuarios([]);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al asignar usuario');
    } finally {
      setAdding(false);
    }
  };

  const handleRemover = async (userId: number) => {
    if (!restaurante) return;
    setSaving(userId);
    setError('');
    try {
      await restaurantesService.removerUsuario(restaurante.id, userId);
      setAsignados(prev => prev.filter(a => a.id_usuario !== userId));
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al remover usuario');
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <People fontSize="small" />
          <Typography fontWeight={700}>
            Usuarios — {restaurante?.nombre}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
      </DialogTitle>
      <Divider />

      <DialogContent sx={{ pt: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Add user row */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Autocomplete
            sx={{ flex: 1 }}
            options={usuarios}
            value={selected}
            onChange={(_, v) => setSelected(v)}
            onInputChange={(_, v) => handleSearch(v)}
            getOptionLabel={u => `${u.nombre_completo} (@${u.usuario})`}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={params => (
              <TextField {...params} size="small" label="Buscar usuario" placeholder="Nombre o @usuario" />
            )}
            noOptionsText="Sin resultados"
            filterOptions={x => x}
          />
          <Button
            variant="contained"
            startIcon={adding ? <CircularProgress size={16} color="inherit" /> : <PersonAdd />}
            disabled={!selected || adding}
            onClick={handleAsignar}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Asignar
          </Button>
        </Box>

        <Divider sx={{ mb: 1 }} />
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Usuarios asignados ({asignados.length})
        </Typography>

        {loadingList ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress /></Box>
        ) : asignados.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            No hay usuarios asignados a este restaurante.
          </Typography>
        ) : (
          <List dense disablePadding>
            {asignados.map(a => (
              <ListItem
                key={a.id_usuario}
                secondaryAction={
                  <Tooltip title="Remover acceso">
                    <IconButton
                      edge="end"
                      size="small"
                      color="error"
                      disabled={saving === a.id_usuario}
                      onClick={() => handleRemover(a.id_usuario)}
                    >
                      {saving === a.id_usuario
                        ? <CircularProgress size={16} />
                        : <PersonRemove fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemAvatar>
                  <Avatar sx={{ width: 32, height: 32, fontSize: '0.85rem', bgcolor: 'primary.main' }}>
                    {a.usuario.nombre_completo.charAt(0).toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={a.usuario.nombre_completo}
                  secondary={`@${a.usuario.usuario} · ${a.usuario.email}`}
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} startIcon={<Close />}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}

export function Restaurantes() {
  const [items, setItems]               = useState<Restaurante[]>([]);
  const [loading, setLoading]           = useState(true);
  const [wizardOpen, setWizardOpen]     = useState(false);
  const [editItem, setEditItem]         = useState<Restaurante | null>(null);
  const [usersRestaurante, setUsersRestaurante] = useState<Restaurante | null>(null);
  const [toast, setToast]               = useState('');
  const [toastErr, setToastErr]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await restaurantesService.listarTodos()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (r: Restaurante, esNuevo = false) => {
    setItems(prev => {
      const idx = prev.findIndex(x => x.id === r.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = r; return n; }
      return [r, ...prev];
    });
    setToast(esNuevo ? 'Restaurante creado exitosamente' : 'Restaurante actualizado');
    setToastErr(false);
  };

  const handleToggle = async (r: Restaurante) => {
    try {
      const updated = await restaurantesService.toggleActivo(r.id);
      setItems(prev => prev.map(x => x.id === updated.id ? updated : x));
      setToast('Estado actualizado');
      setToastErr(false);
    } catch (err: any) {
      setToast(err.response?.data?.error || 'Error al cambiar estado');
      setToastErr(true);
    }
  };

  const handleSetDefault = async (r: Restaurante) => {
    try {
      const upd = await restaurantesService.actualizar(r.id, { es_default: true });
      setItems(prev => prev.map(x => x.id === upd.id ? upd : { ...x, es_default: false }));
      setToast('Restaurante marcado como default');
      setToastErr(false);
    } catch (e: any) {
      setToast(e.response?.data?.error || 'Error');
      setToastErr(true);
    }
  };

  const stats = [
    { label: 'Total',     value: items.length,                        color: '#1976d2', bg: '#e3f2fd', Icon: Store         },
    { label: 'Activos',   value: items.filter(r => r.activo).length,  color: '#2e7d32', bg: '#e8f5e9', Icon: CheckCircle   },
    { label: 'Inactivos', value: items.filter(r => !r.activo).length, color: '#757575', bg: '#f5f5f5', Icon: Cancel        },
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 44, height: 44 }}>
            <Store />
          </Avatar>
          <Box>
            <Typography variant="h5" fontWeight={800} lineHeight={1.2}>Restaurantes</Typography>
            <Typography variant="body2" color="text.secondary">
              Gestión multi-sede — órdenes y caja independientes por restaurante
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setWizardOpen(true)}
          sx={{ borderRadius: 2, fontWeight: 700, px: 2.5, boxShadow: 2 }}
        >
          Nuevo restaurante
        </Button>
      </Box>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        {stats.map(s => (
          <Card key={s.label} sx={{
            minWidth: 130, borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            border: '1px solid', borderColor: 'divider',
          }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: '14px !important', px: 2 }}>
              <Avatar sx={{ bgcolor: s.bg, width: 40, height: 40 }}>
                <s.Icon sx={{ color: s.color, fontSize: 20 }} />
              </Avatar>
              <Box>
                <Typography variant="h5" fontWeight={800} color={s.color} lineHeight={1}>{s.value}</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={500}>{s.label}</Typography>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      {loading ? (
        <LoadingScreen variant="inline" message="Cargando restaurantes..." />
      ) : items.length === 0 ? (
        <Card sx={{ borderRadius: 3, border: '2px dashed', borderColor: 'divider' }}>
          <EmptyState
            message="No hay restaurantes registrados"
            description="Crea tu primer restaurante para empezar a gestionar tu negocio."
            icon={
              <Avatar sx={{ width: 72, height: 72, bgcolor: 'grey.100' }}>
                <Business sx={{ fontSize: 40, color: 'text.disabled' }} />
              </Avatar>
            }
            actionLabel="Crear primer restaurante"
            onAction={() => setWizardOpen(true)}
          />
        </Card>
      ) : (
        <Grid container spacing={2.5}>
          {items.map(r => {
            const tenantInfo = TENANT_LABELS[r.tipo_tenant ?? 'compartido'];
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={r.id}>
                <Card sx={{
                  height: '100%', borderRadius: 2.5, display: 'flex', flexDirection: 'column',
                  opacity: r.activo ? 1 : 0.7,
                  border: r.es_default ? '2px solid' : '1px solid',
                  borderColor: r.es_default ? 'primary.main' : 'divider',
                  boxShadow: r.es_default
                    ? '0 4px 16px rgba(25,118,210,0.15)'
                    : '0 1px 4px rgba(0,0,0,0.07)',
                  transition: 'box-shadow 0.2s, transform 0.15s',
                  '&:hover': {
                    boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
                    transform: 'translateY(-2px)',
                  },
                }}>
                  {/* Accent bar + header */}
                  <Box sx={{
                    height: 5, borderRadius: '10px 10px 0 0',
                    bgcolor: r.activo ? 'primary.main' : 'grey.300',
                  }} />

                  <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', pt: 2, pb: 1 }}>
                    {/* Top row: avatar + name + chips */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
                      <Avatar
                        src={r.logo_url || undefined}
                        sx={{
                          bgcolor: 'primary.main', width: 48, height: 48,
                          boxShadow: '0 2px 8px rgba(25,118,210,0.25)',
                          flexShrink: 0,
                        }}
                      >
                        <Business />
                      </Avatar>

                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                          <Typography fontWeight={800} noWrap sx={{ fontSize: '0.97rem' }}>
                            {r.nombre}
                          </Typography>
                          {r.es_default && (
                            <Tooltip title="Restaurante por defecto">
                              <Star sx={{ fontSize: 16, color: 'warning.main', flexShrink: 0 }} />
                            </Tooltip>
                          )}
                        </Box>
                        {r.nit && (
                          <Typography variant="caption" color="text.secondary">NIT: {r.nit}</Typography>
                        )}
                      </Box>

                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
                        <Chip
                          size="small"
                          label={r.activo ? 'Activo' : 'Inactivo'}
                          color={r.activo ? 'success' : 'default'}
                          sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                        />
                        <Chip
                          size="small"
                          label={tenantInfo?.label ?? r.tipo_tenant}
                          color={tenantInfo?.color ?? 'default'}
                          variant="outlined"
                          sx={{ fontSize: '0.65rem', height: 20 }}
                        />
                      </Box>
                    </Box>

                    {/* Descripción */}
                    {r.descripcion && (
                      <Typography variant="body2" color="text.secondary" sx={{
                        mb: 1.5, fontSize: '0.8rem', lineHeight: 1.4,
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {r.descripcion}
                      </Typography>
                    )}

                    {/* Info de contacto con iconos */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4, flex: 1 }}>
                      {r.ciudad && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <LocationOn sx={{ fontSize: 14, color: 'text.disabled' }} />
                          <Typography variant="caption" color="text.secondary">{r.ciudad}</Typography>
                        </Box>
                      )}
                      {r.telefono && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Phone sx={{ fontSize: 14, color: 'text.disabled' }} />
                          <Typography variant="caption" color="text.secondary">{r.telefono}</Typography>
                        </Box>
                      )}
                      {r.email && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Email sx={{ fontSize: 14, color: 'text.disabled' }} />
                          <Typography variant="caption" color="text.secondary" noWrap>{r.email}</Typography>
                        </Box>
                      )}
                    </Box>
                  </CardContent>

                  {/* Action bar */}
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 0.5,
                    px: 2, py: 1,
                    borderTop: '1px solid', borderColor: 'divider',
                    bgcolor: 'grey.50',
                    borderRadius: '0 0 10px 10px',
                  }}>
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => setEditItem(r)} sx={{ color: 'text.secondary' }}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Gestionar usuarios">
                      <IconButton size="small" color="primary" onClick={() => setUsersRestaurante(r)}>
                        <People fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={r.activo ? 'Desactivar' : 'Activar'}>
                      <IconButton size="small" color={r.activo ? 'error' : 'success'} onClick={() => handleToggle(r)}>
                        <PowerSettingsNew fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {!r.es_default && r.activo && (
                      <Tooltip title="Marcar como default">
                        <IconButton size="small" color="warning" onClick={() => handleSetDefault(r)}>
                          <StarBorder fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {r.es_default && (
                      <Tooltip title="Restaurante por defecto">
                        <Check fontSize="small" sx={{ color: 'success.main', ml: 0.25 }} />
                      </Tooltip>
                    )}
                  </Box>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Wizard de creación */}
      <CrearRestauranteWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSaved={r => handleSaved(r, true)}
      />

      {/* Formulario de edición */}
      {editItem && (
        <EditarRestauranteForm
          open={!!editItem}
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={r => handleSaved(r, false)}
        />
      )}

      <UsuariosDialog
        restaurante={usersRestaurante}
        onClose={() => setUsersRestaurante(null)}
      />

      <Snackbar open={!!toast} autoHideDuration={3500} onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={toastErr ? 'error' : 'success'} onClose={() => setToast('')}>{toast}</Alert>
      </Snackbar>
    </Box>
  );
}
