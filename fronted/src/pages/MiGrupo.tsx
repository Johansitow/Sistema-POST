/**
 * MiGrupo — panel de administración del grupo para su owner/admin.
 *
 * El "ancla" de administración compartida entre sucursales: el dueño del
 * grupo ve todas sus sedes, edita sus datos básicos y gestiona qué usuarios
 * (miembros del grupo) acceden a cada una. No requiere superadmin.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl,
  FormControlLabel, IconButton, InputLabel, List, ListItem,
  ListItemAvatar, ListItemText, MenuItem, Select, Switch, TextField,
  Tooltip, Typography,
} from '@mui/material';
import {
  Business, Edit, Delete, PersonAdd, Groups, StoreMallDirectory,
} from '@mui/icons-material';
import {
  miGrupoService, type MiGrupoResumen, type SedeMiGrupo,
  type MiembroGrupo, type UsuarioDeSede, type SedeUpdatePayload,
} from '../services/mi-grupo.service';
import { useUIStore } from '../store/uiStore';

const ROL_LABEL: Record<string, string> = {
  owner:      'Dueño',
  admin:      'Admin del grupo',
  superadmin: 'Superadmin',
};

export default function MiGrupo() {
  const { showToast } = useUIStore();

  const [resumen,  setResumen]  = useState<MiGrupoResumen | null>(null);
  const [miembros, setMiembros] = useState<MiembroGrupo[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [sinAcceso, setSinAcceso] = useState(false);

  // Dialog de edición de sede
  const [sedeEdit, setSedeEdit] = useState<SedeMiGrupo | null>(null);
  const [form, setForm] = useState<SedeUpdatePayload>({});
  const [guardando, setGuardando] = useState(false);

  // Dialog de usuarios por sede
  const [sedeUsuarios, setSedeUsuarios] = useState<SedeMiGrupo | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioDeSede[]>([]);
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [nuevoUsuario, setNuevoUsuario] = useState<number | ''>('');

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [res, miem] = await Promise.all([
        miGrupoService.getResumen(),
        miGrupoService.getMiembros(),
      ]);
      setResumen(res);
      setMiembros(miem);
      setSinAcceso(false);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 403) setSinAcceso(true);
      else showToast('No se pudo cargar la información del grupo', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Edición de sede ────────────────────────────────────────────────────────

  const abrirEdicion = (sede: SedeMiGrupo) => {
    setSedeEdit(sede);
    setForm({
      nombre:    sede.nombre,
      direccion: sede.direccion ?? '',
      ciudad:    sede.ciudad ?? '',
      telefono:  sede.telefono ?? '',
      email:     sede.email ?? '',
      activo:    sede.activo,
    });
  };

  const guardarSede = async () => {
    if (!sedeEdit) return;
    setGuardando(true);
    try {
      await miGrupoService.actualizarSede(sedeEdit.id, form);
      showToast(`Sede ${form.nombre ?? sedeEdit.nombre} actualizada`, 'success');
      setSedeEdit(null);
      await cargar();
    } catch {
      showToast('No se pudo actualizar la sede', 'error');
    } finally {
      setGuardando(false);
    }
  };

  // ── Usuarios por sede ──────────────────────────────────────────────────────

  const abrirUsuarios = async (sede: SedeMiGrupo) => {
    setSedeUsuarios(sede);
    setNuevoUsuario('');
    setUsuariosLoading(true);
    try {
      setUsuarios(await miGrupoService.getUsuariosDeSede(sede.id));
    } catch {
      showToast('No se pudieron cargar los usuarios de la sede', 'error');
      setUsuarios([]);
    } finally {
      setUsuariosLoading(false);
    }
  };

  const vincularUsuario = async () => {
    if (!sedeUsuarios || nuevoUsuario === '') return;
    try {
      await miGrupoService.asignarUsuario(sedeUsuarios.id, nuevoUsuario);
      showToast('Usuario vinculado. Debe volver a iniciar sesión para ver la sede.', 'success');
      setNuevoUsuario('');
      setUsuarios(await miGrupoService.getUsuariosDeSede(sedeUsuarios.id));
    } catch {
      showToast('No se pudo vincular el usuario', 'error');
    }
  };

  const desvincularUsuario = async (idUsuario: number) => {
    if (!sedeUsuarios) return;
    try {
      await miGrupoService.removerUsuario(sedeUsuarios.id, idUsuario);
      showToast('Usuario desvinculado de la sede', 'success');
      setUsuarios(await miGrupoService.getUsuariosDeSede(sedeUsuarios.id));
    } catch {
      showToast('No se pudo desvincular el usuario', 'error');
    }
  };

  // Miembros del grupo que aún no están vinculados a la sede abierta
  const candidatos = miembros.filter(
    m => !usuarios.some(u => u.id_usuario === m.id_usuario)
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  if (sinAcceso) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        Este panel es para el dueño o admin del grupo de restaurantes.
        Pide al superadmin que te asigne como owner/admin del grupo.
      </Alert>
    );
  }

  if (!resumen) return null;

  return (
    <Box>
      {/* Encabezado del grupo */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Avatar src={resumen.grupo.logo_url ?? undefined} sx={{ width: 56, height: 56 }}>
          <Groups />
        </Avatar>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h5" fontWeight={800}>{resumen.grupo.nombre}</Typography>
          <Typography variant="body2" color="text.secondary">
            Administración del grupo — sus sucursales operan de forma independiente
          </Typography>
        </Box>
        <Chip label={ROL_LABEL[resumen.rol_en_grupo] ?? resumen.rol_en_grupo} color="primary" variant="outlined" />
        <Chip label={`Plan ${resumen.grupo.plan} · máx ${resumen.grupo.plan_max_restaurantes} sedes`} size="small" />
      </Box>

      {/* Sedes */}
      <Box sx={{
        display: 'grid', gap: 2,
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
      }}>
        {resumen.restaurantes.map(sede => (
          <Card key={sede.id} variant="outlined" sx={{ height: '100%', opacity: sede.activo ? 1 : 0.6 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                  {sede.logo_url ? (
                    <Avatar src={sede.logo_url} sx={{ width: 40, height: 40 }} />
                  ) : (
                    <Avatar sx={{ width: 40, height: 40 }}><StoreMallDirectory /></Avatar>
                  )}
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography fontWeight={700} noWrap>{sede.nombre}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {sede.ciudad || 'Sin ciudad'}{sede.direccion ? ` · ${sede.direccion}` : ''}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
                  {sede.es_default && <Chip label="default" size="small" />}
                  <Chip
                    label={sede.activo ? 'Activa' : 'Inactiva'}
                    size="small"
                    color={sede.activo ? 'success' : 'default'}
                  />
                  <Chip
                    icon={<Business fontSize="small" />}
                    label={`${sede._count?.usuarios ?? 0} usuarios`}
                    size="small"
                    variant="outlined"
                  />
                </Box>
                <Divider sx={{ mb: 1.5 }} />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" startIcon={<Edit />} onClick={() => abrirEdicion(sede)}>
                    Editar
                  </Button>
                  <Button size="small" startIcon={<PersonAdd />} onClick={() => abrirUsuarios(sede)}>
                    Usuarios
                  </Button>
                </Box>
              </CardContent>
          </Card>
        ))}
      </Box>

      {/* Miembros del grupo */}
      <Typography variant="h6" fontWeight={700} sx={{ mt: 4, mb: 1 }}>
        Miembros del grupo
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Solo los miembros del grupo pueden vincularse a las sedes. Para agregar
        miembros nuevos contacta al superadmin.
      </Typography>
      <Card variant="outlined">
        <List dense>
          {miembros.map(m => (
            <ListItem key={m.id}>
              <ListItemAvatar>
                <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem' }}>
                  {m.usuario.nombre_completo.slice(0, 2).toUpperCase()}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={m.usuario.nombre_completo}
                secondary={m.usuario.email}
              />
              <Chip label={ROL_LABEL[m.rol_en_grupo] ?? m.rol_en_grupo} size="small" variant="outlined" />
            </ListItem>
          ))}
          {miembros.length === 0 && (
            <ListItem><ListItemText primary="Sin miembros registrados" /></ListItem>
          )}
        </List>
      </Card>

      {/* Dialog: editar sede */}
      <Dialog open={Boolean(sedeEdit)} onClose={() => setSedeEdit(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Editar sede — {sedeEdit?.nombre}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '10px !important' }}>
          <TextField label="Nombre" value={form.nombre ?? ''} size="small"
            onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          <TextField label="Dirección" value={form.direccion ?? ''} size="small"
            onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
          <TextField label="Ciudad" value={form.ciudad ?? ''} size="small"
            onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))} />
          <TextField label="Teléfono" value={form.telefono ?? ''} size="small"
            onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
          <TextField label="Email" value={form.email ?? ''} size="small" type="email"
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <FormControlLabel
            control={
              <Switch
                checked={form.activo ?? true}
                disabled={sedeEdit?.es_default}
                onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))}
              />
            }
            label={sedeEdit?.es_default ? 'Activa (la sede default no se puede desactivar)' : 'Activa'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSedeEdit(null)}>Cancelar</Button>
          <Button variant="contained" onClick={guardarSede} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: usuarios de la sede */}
      <Dialog open={Boolean(sedeUsuarios)} onClose={() => setSedeUsuarios(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Usuarios — {sedeUsuarios?.nombre}</DialogTitle>
        <DialogContent>
          {usuariosLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={28} /></Box>
          ) : (
            <>
              <List dense>
                {usuarios.map(u => (
                  <ListItem
                    key={u.id}
                    secondaryAction={
                      <Tooltip title="Quitar de la sede">
                        <IconButton edge="end" size="small" onClick={() => desvincularUsuario(u.id_usuario)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ width: 30, height: 30, fontSize: '0.75rem', bgcolor: u.usuario.rol?.color ?? undefined }}>
                        {u.usuario.nombre_completo.slice(0, 2).toUpperCase()}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText primary={u.usuario.nombre_completo} secondary={u.usuario.rol?.nombre} />
                  </ListItem>
                ))}
                {usuarios.length === 0 && (
                  <ListItem><ListItemText primary="Ningún usuario vinculado a esta sede" /></ListItem>
                )}
              </List>
              <Divider sx={{ my: 1.5 }} />
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <FormControl size="small" fullWidth>
                  <InputLabel id="nuevo-usuario-label">Vincular miembro del grupo</InputLabel>
                  <Select
                    labelId="nuevo-usuario-label"
                    label="Vincular miembro del grupo"
                    value={nuevoUsuario}
                    onChange={e => setNuevoUsuario(e.target.value as number)}
                  >
                    {candidatos.map(m => (
                      <MenuItem key={m.id_usuario} value={m.id_usuario}>
                        {m.usuario.nombre_completo} ({ROL_LABEL[m.rol_en_grupo] ?? m.rol_en_grupo})
                      </MenuItem>
                    ))}
                    {candidatos.length === 0 && (
                      <MenuItem disabled value="">Todos los miembros ya están vinculados</MenuItem>
                    )}
                  </Select>
                </FormControl>
                <Button variant="contained" onClick={vincularUsuario} disabled={nuevoUsuario === ''}>
                  Vincular
                </Button>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSedeUsuarios(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
