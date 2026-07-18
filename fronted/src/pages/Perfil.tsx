/**
 * Perfil — página "Mi perfil" (/perfil).
 *
 * Muestra la información del usuario autenticado (GET /auth/profile),
 * las sedes a las que tiene acceso (del JWT) y permite cambiar la contraseña.
 * No requiere sede activa: es información del usuario, no de un restaurante.
 */

import { useEffect, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  Divider, Grid, Stack, TextField, Typography,
} from '@mui/material';
import { Business, CheckCircleOutline, LockOutlined } from '@mui/icons-material';
import { PageHeader } from '../components/common';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/useStore';
import { useRestauranteStore } from '../store/restauranteStore';
import { useUIStore } from '../store/uiStore';
import { formatDateTime, getInitials } from '../utils/format';
import type { PerfilUsuario } from '../types';

const DEFAULT_ROL_COLOR = '#e53935';

// ── Sub-componente: fila etiqueta/valor ──────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.75 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600} sx={{ textAlign: 'right' }}>{value}</Typography>
    </Box>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────

export function Perfil() {
  const { usuario: usuarioAuth } = useAuthStore();
  const restauranteActivo = useRestauranteStore(s => s.activo);
  const { showToast } = useUIStore();

  const [perfil,  setPerfil]  = useState<PerfilUsuario | null>(null);
  const [loading, setLoading] = useState(true);

  // Formulario de cambio de contraseña
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving,          setSaving]          = useState(false);
  const [formError,       setFormError]       = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    authService.getProfile()
      .then(p => { if (mounted) setPerfil(p); })
      .catch(() => { /* el fallback es el usuario del JWT */ })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

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
  const nombre   = perfil?.nombre_completo ?? usuarioAuth?.nombre_completo ?? '';
  const rol      = perfil?.rol ?? usuarioAuth?.rol;
  const rolColor = rol?.color || DEFAULT_ROL_COLOR;
  const sedes    = usuarioAuth?.restaurantes ?? [];

  return (
    <Box>
      <PageHeader title="Mi perfil" subtitle="Tu información personal y de acceso" />

      <Grid container spacing={3}>
        {/* ── Columna izquierda: identidad + sedes ── */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card>
            <CardContent>
              <Stack alignItems="center" spacing={1.5} sx={{ py: 2 }}>
                <Avatar sx={{ width: 72, height: 72, bgcolor: rolColor, fontSize: '1.5rem', fontWeight: 700 }}>
                  {nombre ? getInitials(nombre) : '?'}
                </Avatar>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" fontWeight={700}>{nombre}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {perfil?.email ?? usuarioAuth?.email}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  {rol && <Chip label={rol.nombre} size="small" sx={{ bgcolor: rolColor, color: '#fff', fontWeight: 600 }} />}
                  {(perfil?.es_super_admin ?? usuarioAuth?.es_super_admin) && (
                    <Chip label="Super Admin" size="small" color="warning" variant="outlined" />
                  )}
                </Stack>
              </Stack>

              <Divider sx={{ my: 1.5 }} />

              <InfoRow label="Usuario"          value={perfil?.usuario ?? usuarioAuth?.usuario} />
              <InfoRow label="Teléfono"         value={perfil?.telefono} />
              <InfoRow label="Documento"        value={perfil?.documento_identidad} />
              <InfoRow label="Cargo"            value={perfil?.cargo} />
              <InfoRow label="Turno"            value={perfil?.turno} />
              <InfoRow label="Estado"           value={perfil?.estado} />
              <InfoRow label="Último acceso"    value={perfil?.ultimo_acceso ? formatDateTime(perfil.ultimo_acceso) : undefined} />
            </CardContent>
          </Card>

          {/* Sedes asignadas */}
          <Card sx={{ mt: 3 }}>
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
                      <Box
                        key={s.id}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1.5,
                          px: 1.5, py: 1, borderRadius: 2, border: '1px solid',
                          borderColor: esActiva ? 'primary.main' : 'divider',
                          bgcolor: esActiva ? 'action.selected' : 'transparent',
                        }}
                      >
                        <Business fontSize="small" sx={{ color: esActiva ? 'primary.main' : 'text.secondary' }} />
                        <Typography variant="body2" fontWeight={esActiva ? 700 : 400} sx={{ flexGrow: 1 }}>
                          {s.nombre}
                        </Typography>
                        {esActiva && (
                          <Chip
                            icon={<CheckCircleOutline sx={{ fontSize: 14 }} />}
                            label="Activa" size="small" color="primary"
                            sx={{ height: 22, fontSize: '0.7rem' }}
                          />
                        )}
                      </Box>
                    );
                  })}
                  <Typography variant="caption" color="text.secondary">
                    Puedes cambiar de sucursal desde el selector en la barra superior.
                  </Typography>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Columna derecha: cambio de contraseña ── */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <LockOutlined fontSize="small" color="action" />
                <Typography variant="subtitle2" fontWeight={700}>Cambiar contraseña</Typography>
              </Stack>

              <Box component="form" onSubmit={handleChangePassword}>
                <Stack spacing={2} sx={{ maxWidth: 420 }}>
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
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
