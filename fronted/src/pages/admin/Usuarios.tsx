/**
 * Página: Administración de Usuarios
 * Sin Grid de MUI — usa Box flex para compatibilidad con MUI v5 y v6
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, IconButton, InputAdornment, InputLabel,
  MenuItem, Paper, Select, Snackbar, Alert, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TablePagination, TableRow,
  TextField, Tooltip, Typography, Avatar, Divider, Tabs, Tab,
} from '@mui/material';
import {
  Add, Search, ChevronRight, LockReset, PersonOff, PersonAdd,
  ManageAccounts, Refresh, Close, Visibility, VisibilityOff,
  Badge, AccountBalance, Shield,
} from '@mui/icons-material';
import { usuariosService } from '../../services/usuarios.service';
import type {
  Usuario, NominaDto, RolBasico, EstadoGeneral,
  Turno, TipoContrato, Jornada,
} from '../../types';
import { useAuthStore } from '../../store/useStore';

// ← CAMBIO 1: importar desde utils en lugar de definir inline
import { getInitials, formatDateTime } from '../../utils/format';
import { MESSAGES, VALIDATION }        from '../../utils/constants';
import { ESTADO_LABORAL_LABEL, ESTADO_LABORAL_COLOR } from '../../utils/empleado';

// ← CAMBIO 2: importar componentes comunes
import { ConfirmDialog, LoadingScreen, EmptyState, StatusChip } from '../../components/common';
import { ResetPasswordDialog } from '../../components/personal';

// ← ELIMINADO: const getInitials = ...  (viene de utils/format.ts)
// ← ELIMINADO: const estadoColor = ...  (reemplazado por <StatusChip>)

// ─── Row helper — par de campos lado a lado ───────────────────────────────
function FieldRow({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
      {children}
    </Box>
  );
}

// ─── Tipos para el form unificado ────────────────────────────────────────────

interface UnifiedForm {
  // Tab 0 — Cuenta
  nombre_completo: string;
  email:           string;
  usuario:         string;
  password:        string;
  telefono:        string;
  id_rol:          number;
  // Tab 1 — Empleado
  documento_identidad:          string;
  fecha_nacimiento:              string;
  direccion:                     string;
  cargo:                         string;
  fecha_ingreso:                 string;
  // '' representa "sin asignar"; se convierte a undefined al guardar
  turno:                         Turno | '';
  tipo_contrato:                 TipoContrato | '';
  jornada:                       Jornada | '';
  contacto_emergencia_nombre:    string;
  contacto_emergencia_telefono:  string;
  notas:                         string;
  // Tab 2 — Nómina
  salario_base:   string;   // string para input, se convierte a number al guardar
  tipo_pago:      string;
  banco:          string;
  tipo_cuenta:    string;
  numero_cuenta:  string;
  nomina_obs:     string;
}

const FORM_EMPTY: UnifiedForm = {
  nombre_completo: '', email: '', usuario: '', password: '', telefono: '', id_rol: 0,
  documento_identidad: '', fecha_nacimiento: '', direccion: '', cargo: '',
  fecha_ingreso: '', turno: '', tipo_contrato: '', jornada: '',
  contacto_emergencia_nombre: '', contacto_emergencia_telefono: '', notas: '',
  salario_base: '', tipo_pago: 'mensual', banco: '', tipo_cuenta: '', numero_cuenta: '', nomina_obs: '',
};

// ─── Dialogo: Alta de empleado ────────────────────────────────────────────
// Solo CREA. La edición vive en la ficha del empleado (/admin/personal/:id):
// tener dos formularios que editan lo mismo garantizaba que se desincronizaran.
interface FormDialogProps {
  open: boolean;
  roles: RolBasico[];
  onClose: () => void;
  /** Recibe el id del empleado creado para poder abrir su ficha. */
  onSave: (idCreado: number) => void;
}

function FormDialog({ open, roles, onClose, onSave }: FormDialogProps) {
  const [tab, setTab]               = useState(0);
  const [form, setForm]             = useState<UnifiedForm>(FORM_EMPTY);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    if (!open) return;
    setTab(0);
    setError('');
    setForm({ ...FORM_EMPTY, id_rol: roles[0]?.id || 0 });
  }, [open, roles]);

  const set = (name: keyof UnifiedForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | any) => {
      const value = e.target.value;
      setForm(prev => ({ ...prev, [name]: name === 'id_rol' ? Number(value) : value }));
      setError('');
    };

  const handleSubmit = async () => {
    if (!form.nombre_completo || !form.email || !form.usuario || !form.id_rol) {
      setTab(0);
      setError('Completa los campos obligatorios en la pestaña Cuenta');
      return;
    }
    if (!form.password) {
      setTab(0);
      setError('La contraseña es obligatoria');
      return;
    }
    if (form.password.length < VALIDATION.PASSWORD_MIN_LENGTH) {
      setTab(0);
      setError(`La contraseña debe tener al menos ${VALIDATION.PASSWORD_MIN_LENGTH} caracteres`);
      return;
    }
    setLoading(true);
    try {
      const creado = await usuariosService.crear({
        nombre_completo: form.nombre_completo,
        email:           form.email,
        usuario:         form.usuario,
        password:        form.password,
        id_rol:          form.id_rol,
        telefono:                      form.telefono            || undefined,
        documento_identidad:           form.documento_identidad || undefined,
        fecha_nacimiento:              form.fecha_nacimiento    || undefined,
        direccion:                     form.direccion           || undefined,
        cargo:                         form.cargo               || undefined,
        fecha_ingreso:                 form.fecha_ingreso       || undefined,
        turno:                         form.turno               || undefined,
        tipo_contrato:                 form.tipo_contrato       || undefined,
        jornada:                       form.jornada             || undefined,
        contacto_emergencia_nombre:    form.contacto_emergencia_nombre   || undefined,
        contacto_emergencia_telefono:  form.contacto_emergencia_telefono || undefined,
        notas:                         form.notas               || undefined,
      });

      // La nómina es opcional al dar de alta; si se llenó, se guarda aparte
      // (el backend registra además la primera fila del historial salarial).
      if (form.salario_base) {
        const nominaData: NominaDto = {
          salario_base:  parseFloat(form.salario_base) || 0,
          tipo_pago:     form.tipo_pago as NominaDto['tipo_pago'],
          banco:         form.banco || undefined,
          tipo_cuenta:   (form.tipo_cuenta as NominaDto['tipo_cuenta']) || undefined,
          numero_cuenta: form.numero_cuenta || undefined,
          observaciones: form.nomina_obs || undefined,
        };
        await usuariosService.guardarNomina(creado.id, nominaData);
      }

      onSave(creado.id);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear el empleado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Add fontSize="small" />
          <Typography fontWeight={700}>Nuevo empleado</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
      </DialogTitle>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab icon={<ManageAccounts fontSize="small" />} iconPosition="start" label="Cuenta" />
        <Tab icon={<Badge fontSize="small" />} iconPosition="start" label="Empleado" />
        <Tab icon={<AccountBalance fontSize="small" />} iconPosition="start" label="Nómina" />
      </Tabs>

      <DialogContent sx={{ pt: 2, minHeight: 360 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* ── Tab 0: Cuenta del sistema ──────────────────────────────────── */}
        {tab === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField fullWidth label="Nombre Completo *" value={form.nombre_completo} onChange={set('nombre_completo')} />
            <FieldRow>
              <TextField fullWidth label="Email *" type="email" value={form.email} onChange={set('email')} />
              <TextField fullWidth label="Teléfono" value={form.telefono} onChange={set('telefono')} />
            </FieldRow>
            <FieldRow>
              <TextField fullWidth label="Usuario *" value={form.usuario} onChange={set('usuario')}
                helperText="Solo letras, números y _" />
              <FormControl fullWidth>
                <InputLabel>Rol *</InputLabel>
                <Select value={form.id_rol || ''} label="Rol *" onChange={set('id_rol')}>
                  {roles.map(r => (
                    <MenuItem key={r.id} value={r.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: r.color || 'grey.400' }} />
                        {r.nombre}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </FieldRow>
            <TextField fullWidth label="Contraseña *" type={showPassword ? 'text' : 'password'}
              value={form.password} onChange={set('password')}
              helperText={`Mínimo ${VALIDATION.PASSWORD_MIN_LENGTH} caracteres`}
              InputProps={{ endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(s => !s)} edge="end">
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )}}
            />
          </Box>
        )}

        {/* ── Tab 1: Datos del empleado ──────────────────────────────────── */}
        {tab === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>Datos personales</Typography>
            <FieldRow>
              <TextField fullWidth label="Documento de identidad (CC/NIT)"
                value={form.documento_identidad} onChange={set('documento_identidad')} />
              <TextField fullWidth label="Fecha de nacimiento" type="date"
                value={form.fecha_nacimiento} onChange={set('fecha_nacimiento')}
                InputLabelProps={{ shrink: true }} />
            </FieldRow>
            <TextField fullWidth label="Dirección" value={form.direccion} onChange={set('direccion')} />

            <Divider sx={{ my: 0.5 }} />
            <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>Datos laborales</Typography>
            <FieldRow>
              <TextField fullWidth label="Cargo / Puesto" placeholder="ej. Chef Principal, Mesero"
                value={form.cargo} onChange={set('cargo')} />
              <TextField fullWidth label="Fecha de ingreso" type="date"
                value={form.fecha_ingreso} onChange={set('fecha_ingreso')}
                InputLabelProps={{ shrink: true }} />
            </FieldRow>
            <FieldRow>
              <FormControl fullWidth>
                <InputLabel>Turno</InputLabel>
                <Select value={form.turno} label="Turno" onChange={set('turno')}>
                  <MenuItem value="">Sin asignar</MenuItem>
                  <MenuItem value="mañana">Mañana</MenuItem>
                  <MenuItem value="tarde">Tarde</MenuItem>
                  <MenuItem value="noche">Noche</MenuItem>
                  <MenuItem value="mixto">Mixto</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Tipo de contrato</InputLabel>
                <Select value={form.tipo_contrato} label="Tipo de contrato" onChange={set('tipo_contrato')}>
                  <MenuItem value="">Sin asignar</MenuItem>
                  <MenuItem value="indefinido">Término indefinido</MenuItem>
                  <MenuItem value="fijo">Término fijo</MenuItem>
                  <MenuItem value="obra_labor">Obra o labor</MenuItem>
                  <MenuItem value="aprendizaje">Aprendizaje</MenuItem>
                </Select>
              </FormControl>
            </FieldRow>
            {/* La jornada es independiente del tipo de contrato: "medio tiempo"
                no es un tipo de contrato sino una jornada. */}
            <FormControl fullWidth>
              <InputLabel>Jornada</InputLabel>
              <Select value={form.jornada} label="Jornada" onChange={set('jornada')}>
                <MenuItem value="">Sin asignar</MenuItem>
                <MenuItem value="completa">Tiempo completo</MenuItem>
                <MenuItem value="parcial">Medio tiempo</MenuItem>
                <MenuItem value="por_horas">Por horas</MenuItem>
              </Select>
            </FormControl>

            <Divider sx={{ my: 0.5 }} />
            <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>Contacto de emergencia</Typography>
            <FieldRow>
              <TextField fullWidth label="Nombre" value={form.contacto_emergencia_nombre}
                onChange={set('contacto_emergencia_nombre')} />
              <TextField fullWidth label="Teléfono" value={form.contacto_emergencia_telefono}
                onChange={set('contacto_emergencia_telefono')} />
            </FieldRow>

            <Divider sx={{ my: 0.5 }} />
            <TextField fullWidth label="Notas internas" multiline rows={3}
              placeholder="Observaciones del administrador (no visible para el empleado)"
              value={form.notas} onChange={set('notas')} />
          </Box>
        )}

        {/* ── Tab 2: Nómina ──────────────────────────────────────────────── */}
        {tab === 2 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="info" sx={{ mb: 1 }}>
              Opcional al dar de alta. También puedes completarla después desde
              la ficha del empleado, donde además queda el historial salarial.
            </Alert>
            <FieldRow>
              <TextField fullWidth label="Salario base" type="number"
                value={form.salario_base} onChange={set('salario_base')}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                helperText="Valor mensual bruto en COP" />
              <FormControl fullWidth>
                <InputLabel>Frecuencia de pago</InputLabel>
                <Select value={form.tipo_pago} label="Frecuencia de pago" onChange={set('tipo_pago')}>
                  <MenuItem value="mensual">Mensual</MenuItem>
                  <MenuItem value="quincenal">Quincenal</MenuItem>
                  <MenuItem value="semanal">Semanal</MenuItem>
                </Select>
              </FormControl>
            </FieldRow>

            <Divider sx={{ my: 0.5 }} />
            <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>Información bancaria</Typography>
            <TextField fullWidth label="Banco" placeholder="ej. Bancolombia, Davivienda, Nequi"
              value={form.banco} onChange={set('banco')} />
            <FieldRow>
              <FormControl fullWidth>
                <InputLabel>Tipo de cuenta</InputLabel>
                <Select value={form.tipo_cuenta} label="Tipo de cuenta" onChange={set('tipo_cuenta')}>
                  <MenuItem value="">Sin especificar</MenuItem>
                  <MenuItem value="ahorros">Ahorros</MenuItem>
                  <MenuItem value="corriente">Corriente</MenuItem>
                </Select>
              </FormControl>
              <TextField fullWidth label="Número de cuenta"
                value={form.numero_cuenta} onChange={set('numero_cuenta')} />
            </FieldRow>
            <TextField fullWidth label="Observaciones de nómina" multiline rows={2}
              value={form.nomina_obs} onChange={set('nomina_obs')} />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {tab > 0 && <Button onClick={() => setTab(t => t - 1)} variant="outlined" size="small">← Anterior</Button>}
          {tab < 2 && <Button onClick={() => setTab(t => t + 1)} variant="outlined" size="small">Siguiente →</Button>}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose} disabled={loading} startIcon={<Close />}>Cancelar</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={loading}>
            {loading ? <CircularProgress size={20} /> : 'Crear empleado'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

// ResetPasswordDialog vive en components/personal: lo comparten este listado
// y la ficha del empleado.

// ─── Página Principal ─────────────────────────────────────────────────────
export default function Usuarios() {
  const { isSuperAdmin, usuario: usuarioActual } = useAuthStore();
  const esSA = isSuperAdmin();
  const navigate = useNavigate();

  /** La ficha es la pantalla de detalle: el listado solo lleva hasta ella. */
  const irAFicha = (id: number) => navigate(`/admin/personal/${id}`);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [roles, setRoles] = useState<RolBasico[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, activos: 0, inactivos: 0 });
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState<string>('');
  const [filterRol, setFilterRol] = useState<string>('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [resetDialog, setResetDialog] = useState<{ open: boolean; usuario: Usuario | null }>({ open: false, usuario: null });

  // ← CAMBIO 6: estado para ConfirmDialog en lugar de ejecutar handleToggleEstado directamente
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; usuario: Usuario | null }>
    ({ open: false, usuario: null });

  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>
    ({ open: false, msg: '', severity: 'success' });

  const showSnack = (msg: string, severity: 'success' | 'error' = 'success') =>
    setSnack({ open: true, msg, severity });

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [result, statsData, rolesData] = await Promise.all([
        usuariosService.listar({
          page: page + 1, limit: rowsPerPage,
          search: search || undefined,
          estado: filterEstado as EstadoGeneral || undefined,
          id_rol: filterRol ? parseInt(filterRol) : undefined,
        }),
        usuariosService.estadisticas(),
        usuariosService.listarRoles(),
      ]);
      setUsuarios(result.data);
      setTotal(result.meta.total);
      setStats(statsData);
      setRoles(rolesData);
    } catch {
      showSnack('Error al cargar usuarios', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, filterEstado, filterRol]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  // ← CAMBIO 7: abre ConfirmDialog en lugar de ejecutar directamente
  const handleToggleEstadoClick = (usuario: Usuario) => {
    setConfirmDialog({ open: true, usuario });
  };

  // ← CAMBIO 8: se ejecuta cuando el usuario confirma en el ConfirmDialog
  const handleToggleEstadoConfirm = async () => {
    const u = confirmDialog.usuario;
    if (!u) return;
    const nuevoEstado = u.estado === 'activo' ? 'inactivo' : 'activo';
    await usuariosService.cambiarEstado(u.id, nuevoEstado);
    // ← CAMBIO 9: usa MESSAGES de constants en lugar de strings hardcodeados
    showSnack(nuevoEstado === 'activo' ? MESSAGES.ACTIVATED : MESSAGES.DEACTIVATED);
    cargarDatos();
  };

  return (
    <Box>
      {/* Header — sin cambios */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Personal</Typography>
          <Typography variant="body2" color="text.secondary">
            Empleados del sistema — abre una ficha para ver sus datos laborales y su nómina
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setFormOpen(true)}>
          Nuevo empleado
        </Button>
      </Box>

      {/* Stats — sin cambios */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexDirection: { xs: 'column', sm: 'row' } }}>
        {[
          { label: 'Total Usuarios', value: stats.total,     color: 'primary.main',   icon: <ManageAccounts /> },
          { label: 'Activos',        value: stats.activos,   color: 'success.main',   icon: <PersonAdd /> },
          { label: 'Inactivos',      value: stats.inactivos, color: 'text.secondary', icon: <PersonOff /> },
        ].map((s) => (
          <Card variant="outlined" key={s.label} sx={{ flex: 1 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: '12px !important' }}>
              <Box sx={{ color: s.color }}>{s.icon}</Box>
              <Box>
                <Typography variant="h5" fontWeight={700} sx={{ color: s.color }}>{s.value}</Typography>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Filtros — sin cambios */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ py: '12px !important' }}>
          <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center' }}>
            <TextField
              sx={{ flex: 2 }} size="small" placeholder="Buscar por nombre, email o usuario..."
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>,
              }}
            />
            <FormControl sx={{ flex: 1 }} size="small">
              <InputLabel>Estado</InputLabel>
              <Select value={filterEstado} label="Estado"
                onChange={(e) => { setFilterEstado(e.target.value); setPage(0); }}>
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="activo">Activo</MenuItem>
                <MenuItem value="inactivo">Inactivo</MenuItem>
              </Select>
            </FormControl>
            <FormControl sx={{ flex: 1 }} size="small">
              <InputLabel>Rol</InputLabel>
              <Select value={filterRol} label="Rol"
                onChange={(e) => { setFilterRol(e.target.value); setPage(0); }}>
                <MenuItem value="">Todos</MenuItem>
                {roles.map((r) => (
                  <MenuItem key={r.id} value={String(r.id)}>{r.nombre}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Tooltip title="Actualizar">
              <IconButton onClick={cargarDatos} disabled={loading}><Refresh /></IconButton>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Paper variant="outlined">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell>Empleado</TableCell>
                <TableCell>Cargo</TableCell>
                <TableCell>Rol</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Último Acceso</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 0, border: 0 }}>
                    {/* ← CAMBIO 10: LoadingScreen variant="table" reemplaza CircularProgress inline */}
                    <LoadingScreen variant="table" />
                  </TableCell>
                </TableRow>
              ) : usuarios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 0, border: 0 }}>
                    {/* ← CAMBIO 11: EmptyState reemplaza Typography inline */}
                    <EmptyState
                      message="No se encontraron empleados"
                      description="Intenta con otros filtros o da de alta un empleado"
                      actionLabel="Nuevo empleado"
                      onAction={() => setFormOpen(true)}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                usuarios.map((u) => (
                  <TableRow
                    key={u.id}
                    hover
                    onClick={() => irAFicha(u.id)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar
                          src={u.foto_url ?? undefined}
                          sx={{
                            width: 34, height: 34, fontSize: 13,
                            bgcolor: u.es_super_admin ? 'warning.main' : (u.rol.color || 'primary.main'),
                          }}
                        >
                          {u.es_super_admin ? <Shield fontSize="small" /> : getInitials(u.nombre_completo)}
                        </Avatar>
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Typography variant="body2" fontWeight={600}>{u.nombre_completo}</Typography>
                            {u.es_super_admin && (
                              <Chip
                                label="Super Admin"
                                size="small"
                                color="warning"
                                icon={<Shield sx={{ fontSize: '12px !important' }} />}
                                sx={{ height: 18, fontSize: 10, fontWeight: 700, '& .MuiChip-label': { px: 0.75 } }}
                              />
                            )}
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {u.codigo_empleado ? `${u.codigo_empleado} · ` : ''}@{u.usuario}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{u.cargo || '—'}</Typography>
                      <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={u.rol.nombre} size="small"
                        sx={{ bgcolor: u.rol.color ? `${u.rol.color}22` : undefined,
                          color: u.rol.color, fontWeight: 600, fontSize: 11 }} />
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5} alignItems="flex-start">
                        <StatusChip estado={u.estado} />
                        {/* El estado laboral solo se destaca cuando NO es el normal */}
                        {u.estado_laboral && u.estado_laboral !== 'activo' && (
                          <Chip
                            label={ESTADO_LABORAL_LABEL[u.estado_laboral]}
                            size="small"
                            color={ESTADO_LABORAL_COLOR[u.estado_laboral]}
                            variant="outlined"
                            sx={{ height: 18, fontSize: 10 }}
                          />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {/* ← CAMBIO 14: formatDateTime viene de utils/format.ts */}
                        {u.ultimo_acceso ? formatDateTime(u.ultimo_acceso) : 'Nunca'}
                      </Typography>
                    </TableCell>
                    {/* stopPropagation: la fila entera navega a la ficha, los
                        botones no deben arrastrar esa navegación consigo. */}
                    <TableCell align="center" onClick={e => e.stopPropagation()}>
                      <Tooltip title="Abrir ficha del empleado">
                        <IconButton size="small" color="primary" onClick={() => irAFicha(u.id)}>
                          <ChevronRight fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {/* Reset password: el SA puede resetear su propia; nadie puede resetear la del SA */}
                      <Tooltip title={
                        u.es_super_admin && (!esSA || usuarioActual?.id !== u.id)
                          ? 'Solo el super admin puede cambiar su propia contraseña'
                          : 'Resetear contraseña'
                      }>
                        <span>
                          <IconButton size="small" color="warning"
                            disabled={u.es_super_admin && (!esSA || usuarioActual?.id !== u.id)}
                            onClick={() => setResetDialog({ open: true, usuario: u })}>
                            <LockReset fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      {/* Activar/Desactivar: bloqueado siempre para el SA */}
                      <Tooltip title={u.es_super_admin ? 'El super admin no puede ser desactivado' : (u.estado === 'activo' ? 'Desactivar' : 'Activar')}>
                        <span>
                          <IconButton size="small"
                            color={u.estado === 'activo' ? 'error' : 'success'}
                            disabled={u.es_super_admin}
                            onClick={() => handleToggleEstadoClick(u)}>
                            {u.estado === 'activo' ? <PersonOff fontSize="small" /> : <PersonAdd fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div" count={total} page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[5, 10, 25, 50]}
          labelRowsPerPage="Por página:"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
        />
      </Paper>

      <FormDialog
        open={formOpen} roles={roles}
        onClose={() => setFormOpen(false)}
        onSave={(idCreado) => {
          showSnack(MESSAGES.CREATED);
          // Tras el alta se abre la ficha: es donde se completan los datos
          // laborales, la seguridad social y la nómina.
          irAFicha(idCreado);
        }}
      />
      <ResetPasswordDialog
        open={resetDialog.open}
        nombre={resetDialog.usuario?.nombre_completo}
        onClose={() => setResetDialog({ open: false, usuario: null })}
        onConfirm={async (password) => {
          await usuariosService.resetPassword(resetDialog.usuario!.id, password);
          showSnack(MESSAGES.PASSWORD_RESET);
        }}
      />

      {/* ← CAMBIO 17: ConfirmDialog de common reemplaza el toggle directo sin confirmación */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.usuario?.estado === 'activo' ? 'Desactivar usuario' : 'Activar usuario'}
        message={
          confirmDialog.usuario?.estado === 'activo'
            ? `¿Desactivar a "${confirmDialog.usuario?.nombre_completo}"? Perderá acceso al sistema.`
            : `¿Activar a "${confirmDialog.usuario?.nombre_completo}"? Recuperará acceso al sistema.`
        }
        confirmText={confirmDialog.usuario?.estado === 'activo' ? 'Desactivar' : 'Activar'}
        confirmColor={confirmDialog.usuario?.estado === 'activo' ? 'error' : 'success'}
        onConfirm={handleToggleEstadoConfirm}
        onClose={() => setConfirmDialog({ open: false, usuario: null })}
      />

      <Snackbar open={snack.open} autoHideDuration={3500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}