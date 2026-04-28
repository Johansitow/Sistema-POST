/**
 * Página de Login - Cocina Oculta POS
 *
 * Flujo:
 * 1. Usuario ingresa credenciales
 * 2. authService.login() hace POST /auth/login
 * 3. Backend responde { user: UsuarioAuth, tokens: { accessToken, refreshToken } }
 * 4. setAuth() guarda user y tokens en Zustand + localStorage
 * 5. Redirige al dashboard (o a la ruta que intentaba acceder antes)
 */

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Paper, TextField, Button, Typography, Alert,
  InputAdornment, IconButton, CircularProgress, Divider,
} from '@mui/material';
import {
  Visibility, VisibilityOff, RestaurantMenu, LockOutlined, PersonOutline,
} from '@mui/icons-material';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/useStore';
import { useRestauranteStore } from '../store/restauranteStore';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const { setAuth }       = useAuthStore();
  const { initFromToken } = useRestauranteStore();

  const [form, setForm]               = useState({ usuario: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // Si el usuario fue redirigido al login desde una ruta protegida,
  // después del login lo mandamos de vuelta a esa ruta
  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError(null); // limpiar error al escribir
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.usuario || !form.password) {
      setError('Por favor ingresa usuario y contraseña');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // authService.login devuelve: { user: UsuarioAuth, tokens: AuthTokens }
      // donde tokens = { accessToken, refreshToken, expiresIn }
      const data = await authService.login(form);

      // Guardar en Zustand + localStorage para persistir la sesión
      // setAuth(user, accessToken, refreshToken) — orden importante
      setAuth(data.user, data.tokens.accessToken, data.tokens.refreshToken);

      // Inicializar el selector de restaurante con la lista del JWT
      if (data.user.restaurantes?.length) {
        initFromToken(data.user.restaurantes);
      }

      navigate(from, { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al iniciar sesión. Verifica tus credenciales.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
        position: 'relative',
        overflow: 'hidden',
        // Decoración de fondo — círculo rojo arriba derecha
        '&::before': {
          content: '""',
          position: 'absolute',
          width: '600px', height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(229,57,53,0.15) 0%, transparent 70%)',
          top: '-200px', right: '-100px',
        },
        // Decoración de fondo — círculo naranja abajo izquierda
        '&::after': {
          content: '""',
          position: 'absolute',
          width: '400px', height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,152,0,0.1) 0%, transparent 70%)',
          bottom: '-100px', left: '-100px',
        },
      }}
    >
      <Paper
        elevation={24}
        sx={{
          p: { xs: 4, sm: 5 },
          width: '100%',
          maxWidth: 420,
          mx: 2,
          borderRadius: 3,
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.3)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* ── Logo y título ── */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            sx={{
              width: 72, height: 72,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #e53935, #ff6f00)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              mx: 'auto', mb: 2,
              boxShadow: '0 8px 24px rgba(229,57,53,0.4)',
            }}
          >
            <RestaurantMenu sx={{ fontSize: 36, color: 'white' }} />
          </Box>
          <Typography
            variant="h4" fontWeight={800}
            sx={{
              background: 'linear-gradient(135deg, #1a1a2e, #e53935)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.5px',
            }}
          >
            Cocina Oculta
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Sistema POS — Panel de Control
          </Typography>
        </Box>

        <Divider sx={{ mb: 3, opacity: 0.3 }} />

        {/* ── Formulario ── */}
        <Box component="form" onSubmit={handleSubmit}>

          {/* Error de credenciales o de red */}
          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            label="Usuario o Email"
            name="usuario"
            value={form.usuario}
            onChange={handleChange}
            autoComplete="username"
            autoFocus
            disabled={loading}
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonOutline color="action" />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            fullWidth
            label="Contraseña"
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={handleChange}
            autoComplete="current-password"
            disabled={loading}
            sx={{ mb: 3 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlined color="action" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end" size="small"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            sx={{
              py: 1.5,
              borderRadius: 2,
              fontSize: '1rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #e53935, #c62828)',
              boxShadow: '0 4px 16px rgba(229,57,53,0.4)',
              '&:hover': {
                background: 'linear-gradient(135deg, #ef5350, #e53935)',
                boxShadow: '0 6px 20px rgba(229,57,53,0.5)',
                transform: 'translateY(-1px)',
              },
              transition: 'all 0.2s ease',
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Iniciar Sesión'}
          </Button>
        </Box>

        <Typography
          variant="caption" color="text.disabled"
          sx={{ display: 'block', textAlign: 'center', mt: 3 }}
        >
          © {new Date().getFullYear()} Cocina Oculta · Todos los derechos reservados
        </Typography>
      </Paper>
    </Box>
  );
}