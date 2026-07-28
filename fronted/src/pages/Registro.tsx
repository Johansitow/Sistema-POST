/**
 * Registro — página PÚBLICA de alta self-serve (embudo gratis).
 *
 * Crea el negocio en plan Gratis vía POST /auth/registro, que devuelve la sesión
 * ya iniciada; se guarda en el authStore y se envía al usuario al onboarding.
 * El usuario escribe su propia contraseña (el sistema nunca la maneja en claro).
 */

import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  Box, Paper, TextField, Button, Typography, Alert, Divider,
  Checkbox, FormControlLabel, InputAdornment, IconButton, CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Visibility, VisibilityOff, StorefrontOutlined, PersonOutline,
  MailOutline, LockOutlined, AccountCircleOutlined,
} from '@mui/icons-material';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/useStore';
import { useRestauranteStore } from '../store/restauranteStore';
import { useBrandingStore } from '../store/brandingStore';

export function Registro() {
  const navigate = useNavigate();
  const theme = useTheme();

  const { setAuth, isAuthenticated, accessToken } = useAuthStore();
  const { initFromToken } = useRestauranteStore();
  const { nombreSistema } = useBrandingStore();

  const [form, setForm] = useState({
    nombre_negocio: '', nombre_completo: '', email: '', usuario: '', password: '',
  });
  const [aceptaHabeas, setAceptaHabeas] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guard inverso: si ya hay sesión válida, no tiene sentido volver a registrarse.
  if (isAuthenticated && accessToken) return <Navigate to="/dashboard" replace />;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.nombre_negocio || !form.nombre_completo || !form.email || !form.usuario || !form.password) {
      setError('Completa todos los campos para continuar.');
      return;
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (!aceptaHabeas) {
      setError('Debes aceptar el tratamiento de datos para crear tu cuenta.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await authService.registrar({ ...form, acepta_habeas_data: true });
      setAuth(data.user, data.tokens.accessToken, data.tokens.refreshToken);
      if (data.user.restaurantes?.length) initFromToken(data.user.restaurantes);
      navigate('/onboarding', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'No pudimos crear tu cuenta. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
        py: 4,
      }}
    >
      <Paper
        elevation={24}
        sx={{
          p: { xs: 3, sm: 5 }, width: '100%', maxWidth: 460, mx: 2, borderRadius: 3,
          background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)',
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box
            sx={{
              width: 64, height: 64, borderRadius: '50%',
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2,
            }}
          >
            <StorefrontOutlined sx={{ fontSize: 32, color: 'white' }} />
          </Box>
          <Typography variant="h5" fontWeight={800}>Crea tu cuenta gratis</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Empieza a usar {nombreSistema} en minutos.
          </Typography>
        </Box>

        <Divider sx={{ mb: 3, opacity: 0.3 }} />

        <Box component="form" onSubmit={handleSubmit}>
          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

          <TextField
            fullWidth label="Nombre del negocio" name="nombre_negocio"
            value={form.nombre_negocio} onChange={handleChange} disabled={loading} autoFocus sx={{ mb: 2 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><StorefrontOutlined color="action" /></InputAdornment> }}
          />
          <TextField
            fullWidth label="Tu nombre" name="nombre_completo"
            value={form.nombre_completo} onChange={handleChange} disabled={loading} sx={{ mb: 2 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><PersonOutline color="action" /></InputAdornment> }}
          />
          <TextField
            fullWidth label="Correo" name="email" type="email" autoComplete="email"
            value={form.email} onChange={handleChange} disabled={loading} sx={{ mb: 2 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><MailOutline color="action" /></InputAdornment> }}
          />
          <TextField
            fullWidth label="Usuario" name="usuario" autoComplete="username"
            value={form.usuario} onChange={handleChange} disabled={loading} sx={{ mb: 2 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><AccountCircleOutlined color="action" /></InputAdornment> }}
          />
          <TextField
            fullWidth label="Contraseña" name="password" autoComplete="new-password"
            type={showPassword ? 'text' : 'password'}
            value={form.password} onChange={handleChange} disabled={loading} sx={{ mb: 1 }}
            helperText="Mínimo 8 caracteres"
            InputProps={{
              startAdornment: <InputAdornment position="start"><LockOutlined color="action" /></InputAdornment>,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <FormControlLabel
            sx={{ mb: 2, alignItems: 'flex-start' }}
            control={
              <Checkbox
                checked={aceptaHabeas} onChange={e => { setAceptaHabeas(e.target.checked); if (error) setError(null); }}
                disabled={loading} size="small"
              />
            }
            label={
              <Typography variant="caption" color="text.secondary">
                Autorizo el tratamiento de mis datos personales conforme a la Ley 1581 de 2012
                (Habeas Data) para operar el servicio.
              </Typography>
            }
          />

          <Button
            type="submit" fullWidth variant="contained" size="large" disabled={loading}
            sx={{ py: 1.5, borderRadius: 2, fontWeight: 700 }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Crear cuenta gratis'}
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 3 }}>
          ¿Ya tienes cuenta?{' '}
          <Button variant="text" size="small" onClick={() => navigate('/login')}>Inicia sesión</Button>
        </Typography>
      </Paper>
    </Box>
  );
}
