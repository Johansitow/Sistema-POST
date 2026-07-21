/**
 * Perfil — portal del trabajador (/perfil).
 *
 * Antes solo mostraba el avatar, las sedes y el cambio de contraseña. Ahora es
 * el espacio donde el empleado consulta SU información laboral, SU salario y
 * corrige SUS datos de contacto sin pedírselo a administración.
 *
 * Todo lo que se ve aquí sale de rutas que toman el id del token
 * (/auth/profile, /auth/mi-nomina, /auth/mi-perfil): un empleado sin permisos
 * de administración puede usar la pantalla completa, y no hay forma de que
 * apunte a los datos de otra persona.
 */

import { useEffect, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  Divider, Paper, Stack, Tab, Table, TableBody, TableCell, TableHead,
  TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import {
  AccountBalance, Badge as BadgeIcon, Business, CheckCircleOutline,
  LockOutlined, Person, Save, Shield,
} from '@mui/icons-material';
import { PageHeader, EmptyState } from '../components/common';
import { InfoRow } from '../components/personal';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/useStore';
import { useRestauranteStore } from '../store/restauranteStore';
import { useUIStore } from '../store/uiStore';
import { formatCurrency, formatDateTime, getInitials } from '../utils/format';
import {
  ESTADO_LABORAL_COLOR, ESTADO_LABORAL_LABEL, JORNADA_LABEL, NIVEL_RIESGO_ARL_LABEL,
  TIPO_CONTRATO_LABEL, TIPO_DOCUMENTO_LABEL, TURNO_LABEL,
  calcularAntiguedad, etiqueta,
} from '../utils/empleado';
import type { PerfilUsuario, NominaEmpleado, HistorialSalario } from '../types';

const DEFAULT_ROL_COLOR = '#e53935';

const soloFecha = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('es-CO') : null;

export function Perfil() {
  const { usuario: usuarioAuth } = useAuthStore();
  const restauranteActivo = useRestauranteStore(s => s.activo);
  const { showToast } = useUIStore();

  const [tab, setTab]         = useState(0);
  const [perfil, setPerfil]   = useState<PerfilUsuario | null>(null);
  const [loading, setLoading] = useState(true);

  // Nómina propia — se carga al entrar a su pestaña, no al abrir la página
  const [nomina, setNomina]         = useState<NominaEmpleado | null>(null);
  const [historial, setHistorial]   = useState<HistorialSalario[]>([]);
  const [nominaCargada, setNominaCargada] = useState(false);

  // Formulario de datos de contacto
  const [contacto, setContacto] = useState({
    telefono: '', direccion: '',
    contacto_emergencia_nombre: '', contacto_emergencia_telefono: '',
  });
  const [guardandoContacto, setGuardandoContacto] = useState(false);

  // Formulario de cambio de contraseña
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving,          setSaving]          = useState(false);
  const [formError,       setFormError]       = useState<string | null>(null);

  const aplicarPerfil = (p: PerfilUsuario) => {
    setPerfil(p);
    setContacto({
      telefono:                     p.telefono ?? '',
      direccion:                    p.direccion ?? '',
      contacto_emergencia_nombre:   p.contacto_emergencia_nombre ?? '',
      contacto_emergencia_telefono: p.contacto_emergencia_telefono ?? '',
    });
  };

  useEffect(() => {
    let mounted = true;
    authService.getProfile()
      .then(p => { if (mounted) aplicarPerfil(p); })
      .catch(() => { /* el fallback es el usuario del JWT */ })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (tab !== 2 || nominaCargada) return;
    authService.getMiNomina()
      .then(({ nomina, historial }) => { setNomina(nomina); setHistorial(historial); })
      .catch(() => { setNomina(null); setHistorial([]); })
      .finally(() => setNominaCargada(true));
  }, [tab, nominaCargada]);

  const handleGuardarContacto = async () => {
    setGuardandoContacto(true);
    try {
      const actualizado = await authService.actualizarMiPerfil(contacto);
      aplicarPerfil(actualizado);
      showToast('Datos actualizados correctamente', 'success');
    } catch {
      showToast('No se pudieron actualizar tus datos', 'error');
    } finally {
      setGuardandoContacto(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (newPassword.length < 8) {
      setFormError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError('La confirmación no coincide con la nueva contraseña');
      return;
    }

    setSaving(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      showToast('Contraseña actualizada correctamente', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const axiosMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(axiosMsg ?? 'No se pudo cambiar la contraseña. Verifica la contraseña actual.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !perfil) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Datos base: perfil del backend, con fallback al payload del JWT
  const nombre        = perfil?.nombre_completo ?? usuarioAuth?.nombre_completo ?? '';
  const rol           = perfil?.rol ?? usuarioAuth?.rol;
  const rolColor      = rol?.color || DEFAULT_ROL_COLOR;
  const sedes         = usuarioAuth?.restaurantes ?? [];
  const estadoLaboral = perfil?.estado_laboral ?? 'activo';
  const antiguedad    = calcularAntiguedad(perfil?.fecha_ingreso, perfil?.fecha_retiro);

  return (
    <Box>
      <PageHeader title="Mi espacio" subtitle="Tu información laboral, tu nómina y tus datos de acceso" />

      {/* ── Cabecera de identidad ────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Box sx={{
          display: 'flex', gap: 3, alignItems: 'center',
          flexDirection: { xs: 'column', sm: 'row' },
          textAlign: { xs: 'center', sm: 'left' },
        }}>
          <Avatar
            src={perfil?.foto_url ?? undefined}
            sx={{ width: 80, height: 80, bgcolor: rolColor, fontSize: '1.75rem', fontWeight: 700 }}
          >
            {nombre ? getInitials(nombre) : '?'}
          </Avatar>

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap
              justifyContent={{ xs: 'center', sm: 'flex-start' }}>
              <Typography variant="h5" fontWeight={700}>{nombre}</Typography>
              {perfil?.codigo_empleado && (
                <Chip
                  icon={<BadgeIcon sx={{ fontSize: '14px !important' }} />}
                  label={perfil.codigo_empleado} size="small" variant="outlined"
                  sx={{ fontWeight: 700, fontFamily: 'monospace' }}
                />
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {perfil?.cargo || 'Sin cargo asignado'}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap
              justifyContent={{ xs: 'center', sm: 'flex-start' }}>
              <Chip
                label={ESTADO_LABORAL_LABEL[estadoLaboral]}
                color={ESTADO_LABORAL_COLOR[estadoLaboral]}
                size="small" sx={{ fontWeight: 700 }}
              />
              {rol && (
                <Chip label={rol.nombre} size="small"
                  sx={{ bgcolor: rolColor, color: '#fff', fontWeight: 600 }} />
              )}
              {(perfil?.es_super_admin ?? usuarioAuth?.es_super_admin) && (
                <Chip icon={<Shield sx={{ fontSize: '14px !important' }} />}
                  label="Super Admin" size="small" color="warning" variant="outlined" />
              )}
              {antiguedad && (
                <Chip label={`Antigüedad: ${antiguedad.texto}`} size="small" variant="outlined" />
              )}
            </Stack>
          </Box>
        </Box>
      </Paper>

      {/* ── Pestañas ─────────────────────────────────────────────────────── */}
      <Paper variant="outlined">
        <Tabs
          value={tab} onChange={(_, v) => setTab(v)}
          variant="scrollable" scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab icon={<BadgeIcon fontSize="small" />}      iconPosition="start" label="Mi información" />
          <Tab icon={<Person fontSize="small" />}         iconPosition="start" label="Mis datos de contacto" />
          <Tab icon={<AccountBalance fontSize="small" />} iconPosition="start" label="Mi nómina" />
          <Tab icon={<LockOutlined fontSize="small" />}   iconPosition="start" label="Seguridad" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* ── Mi información (solo lectura) ─────────────────────────────── */}
          {tab === 0 && (
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <Card variant="outlined" sx={{ flex: '1 1 320px' }}>
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                    Datos personales
                  </Typography>
                  <InfoRow label="Usuario"   value={perfil?.usuario ?? usuarioAuth?.usuario} mostrarVacio />
                  <InfoRow label="Email"     value={perfil?.email ?? usuarioAuth?.email} mostrarVacio />
                  <InfoRow
                    label="Documento"
                    value={perfil?.documento_identidad
                      ? `${etiqueta(TIPO_DOCUMENTO_LABEL, perfil.tipo_documento) ?? ''} ${perfil.documento_identidad}`.trim()
                      : null}
                    mostrarVacio
                  />
                  <InfoRow label="Fecha de nacimiento" value={soloFecha(perfil?.fecha_nacimiento)} mostrarVacio />
                  <InfoRow label="Dirección" value={perfil?.direccion} mostrarVacio />
                  <InfoRow label="Teléfono"  value={perfil?.telefono} mostrarVacio />
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ flex: '1 1 320px' }}>
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                    Mi vínculo laboral
                  </Typography>
                  <InfoRow label="Cargo"            value={perfil?.cargo} mostrarVacio />
                  <InfoRow label="Fecha de ingreso" value={soloFecha(perfil?.fecha_ingreso)} mostrarVacio />
                  <InfoRow label="Antigüedad"       value={antiguedad?.texto} mostrarVacio />
                  <InfoRow label="Tipo de contrato" value={etiqueta(TIPO_CONTRATO_LABEL, perfil?.tipo_contrato)} mostrarVacio />
                  <InfoRow label="Jornada"          value={etiqueta(JORNADA_LABEL, perfil?.jornada)} mostrarVacio />
                  <InfoRow label="Turno"            value={etiqueta(TURNO_LABEL, perfil?.turno)} mostrarVacio />
                  <InfoRow label="Sede de nómina"   value={perfil?.restaurante_base?.nombre} mostrarVacio />
                  <InfoRow label="Jefe directo"     value={perfil?.jefe_directo?.nombre_completo} mostrarVacio />
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ flex: '1 1 320px' }}>
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                    Mi seguridad social
                  </Typography>
                  <InfoRow label="EPS"                 value={perfil?.eps} mostrarVacio />
                  <InfoRow label="Fondo de pensiones"  value={perfil?.afp} mostrarVacio />
                  <InfoRow label="ARL"                 value={perfil?.arl} mostrarVacio />
                  <InfoRow label="Nivel de riesgo"     value={etiqueta(NIVEL_RIESGO_ARL_LABEL, perfil?.nivel_riesgo_arl)} mostrarVacio />
                  <InfoRow label="Fondo de cesantías"  value={perfil?.fondo_cesantias} mostrarVacio />
                  <InfoRow label="Caja de compensación" value={perfil?.caja_compensacion} mostrarVacio />
                  <Alert severity="info" sx={{ mt: 2 }}>
                    Si algún dato es incorrecto, avisa a administración: estos
                    campos solo los puede corregir el área de personal.
                  </Alert>
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ flex: '1 1 320px' }}>
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                    Sucursales con acceso
                  </Typography>
                  {sedes.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Sin sucursales asignadas. Si te asignaron una recientemente,
                      cierra sesión y vuelve a entrar para verla.
                    </Typography>
                  ) : (
                    <Stack spacing={1}>
                      {sedes.map(s => {
                        const esActiva = s.id === restauranteActivo?.id;
                        return (
                          <Box key={s.id} sx={{
                            display: 'flex', alignItems: 'center', gap: 1.5,
                            px: 1.5, py: 1, borderRadius: 2, border: '1px solid',
                            borderColor: esActiva ? 'primary.main' : 'divider',
                            bgcolor: esActiva ? 'action.selected' : 'transparent',
                          }}>
                            <Business fontSize="small" sx={{ color: esActiva ? 'primary.main' : 'text.secondary' }} />
                            <Typography variant="body2" fontWeight={esActiva ? 700 : 400} sx={{ flexGrow: 1 }}>
                              {s.nombre}
                            </Typography>
                            {esActiva && (
                              <Chip icon={<CheckCircleOutline sx={{ fontSize: 14 }} />}
                                label="Activa" size="small" color="primary"
                                sx={{ height: 22, fontSize: '0.7rem' }} />
                            )}
                          </Box>
                        );
                      })}
                      <Typography variant="caption" color="text.secondary">
                        Puedes cambiar de sucursal desde el selector en la barra superior.
                      </Typography>
                    </Stack>
                  )}
                  <Divider sx={{ my: 2 }} />
                  <InfoRow
                    label="Último acceso"
                    value={perfil?.ultimo_acceso ? formatDateTime(perfil.ultimo_acceso) : 'Nunca'}
                    mostrarVacio
                  />
                </CardContent>
              </Card>
            </Box>
          )}

          {/* ── Mis datos de contacto (editable) ──────────────────────────── */}
          {tab === 1 && (
            <Box sx={{ maxWidth: 560 }}>
              <Alert severity="info" sx={{ mb: 2.5 }}>
                Estos son los únicos datos que puedes modificar tú. El cargo, el
                contrato y el salario los gestiona administración.
              </Alert>

              <Stack spacing={2}>
                <TextField
                  label="Teléfono" size="small" fullWidth
                  value={contacto.telefono}
                  onChange={e => setContacto(c => ({ ...c, telefono: e.target.value }))}
                />
                <TextField
                  label="Dirección" size="small" fullWidth
                  value={contacto.direccion}
                  onChange={e => setContacto(c => ({ ...c, direccion: e.target.value }))}
                />

                <Divider textAlign="left">
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    CONTACTO DE EMERGENCIA
                  </Typography>
                </Divider>

                <TextField
                  label="Nombre" size="small" fullWidth
                  value={contacto.contacto_emergencia_nombre}
                  onChange={e => setContacto(c => ({ ...c, contacto_emergencia_nombre: e.target.value }))}
                />
                <TextField
                  label="Teléfono de emergencia" size="small" fullWidth
                  value={contacto.contacto_emergencia_telefono}
                  onChange={e => setContacto(c => ({ ...c, contacto_emergencia_telefono: e.target.value }))}
                />

                <Box>
                  <Button
                    variant="contained"
                    startIcon={guardandoContacto ? <CircularProgress size={16} color="inherit" /> : <Save />}
                    onClick={handleGuardarContacto}
                    disabled={guardandoContacto}
                  >
                    Guardar mis datos
                  </Button>
                </Box>
              </Stack>
            </Box>
          )}

          {/* ── Mi nómina ─────────────────────────────────────────────────── */}
          {tab === 2 && (
            !nominaCargada ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
              </Box>
            ) : !nomina ? (
              <EmptyState
                message="Aún no tienes nómina registrada"
                description="Cuando administración cargue tu salario, lo verás aquí junto con su historial."
              />
            ) : (
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <Card variant="outlined" sx={{ flex: '1 1 320px' }}>
                  <CardContent>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                      Mi salario
                    </Typography>
                    <Typography variant="h4" fontWeight={800} color="success.main" sx={{ my: 1 }}>
                      {formatCurrency(Number(nomina.salario_base))}
                    </Typography>
                    <InfoRow
                      label="Frecuencia de pago"
                      value={nomina.tipo_pago === 'mensual' ? 'Mensual'
                        : nomina.tipo_pago === 'quincenal' ? 'Quincenal' : 'Semanal'}
                      mostrarVacio
                    />
                    <Divider sx={{ my: 1.5 }} />
                    <InfoRow label="Banco" value={nomina.banco} mostrarVacio />
                    <InfoRow
                      label="Tipo de cuenta"
                      value={nomina.tipo_cuenta === 'ahorros' ? 'Ahorros'
                        : nomina.tipo_cuenta === 'corriente' ? 'Corriente' : null}
                      mostrarVacio
                    />
                    <InfoRow label="Número de cuenta" value={nomina.numero_cuenta} mostrarVacio />
                    <Alert severity="info" sx={{ mt: 2 }}>
                      ¿Cambiaste de cuenta bancaria? Avísale a administración
                      para que la actualice antes del siguiente pago.
                    </Alert>
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ flex: '1 1 380px' }}>
                  <CardContent>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                      Historial de mi salario
                    </Typography>
                    {historial.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        Sin cambios registrados todavía.
                      </Typography>
                    ) : (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Desde</TableCell>
                            <TableCell align="right">Salario</TableCell>
                            <TableCell>Motivo</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {historial.map(h => (
                            <TableRow key={h.id}>
                              <TableCell>
                                {new Date(h.vigencia_desde).toLocaleDateString('es-CO')}
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" fontWeight={700}>
                                  {formatCurrency(Number(h.salario_nuevo))}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption">{h.motivo || '—'}</Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </Box>
            )
          )}

          {/* ── Seguridad ─────────────────────────────────────────────────── */}
          {tab === 3 && (
            <Box component="form" onSubmit={handleChangePassword}>
              <Stack spacing={2} sx={{ maxWidth: 420 }}>
                <Typography variant="subtitle2" fontWeight={700}>Cambiar contraseña</Typography>
                {formError && <Alert severity="error">{formError}</Alert>}
                <TextField
                  label="Contraseña actual" type="password" size="small" required
                  value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <TextField
                  label="Nueva contraseña" type="password" size="small" required
                  value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  helperText="Mínimo 8 caracteres"
                  autoComplete="new-password"
                />
                <TextField
                  label="Confirmar nueva contraseña" type="password" size="small" required
                  value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <Box>
                  <Button type="submit" variant="contained" disabled={saving}>
                    {saving ? 'Guardando…' : 'Actualizar contraseña'}
                  </Button>
                </Box>
              </Stack>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
