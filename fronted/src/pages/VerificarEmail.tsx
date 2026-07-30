/**
 * VerificarEmail — destino del enlace del correo de verificación (`/verificar-email?token=`).
 *
 * Al montar consume el token contra el backend. Si hay sesión activa, refleja el
 * estado verificado en el store (para que el banner desaparezca sin re-login).
 * Página pública: funciona con o sin sesión (el usuario podría abrir el enlace en
 * otro navegador).
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Paper, Typography, Button, CircularProgress } from '@mui/material';
import { CheckCircleOutline, ErrorOutline } from '@mui/icons-material';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/useStore';
import { useBrandingStore } from '../store/brandingStore';

type Estado = 'cargando' | 'ok' | 'error';

export function VerificarEmail() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { nombreSistema } = useBrandingStore();
  const { isAuthenticated, setEmailVerificado } = useAuthStore();

  const [estado, setEstado] = useState<Estado>('cargando');
  const [mensaje, setMensaje] = useState('');
  const yaCorrio = useRef(false); // evita doble ejecución en StrictMode

  useEffect(() => {
    if (yaCorrio.current) return;
    yaCorrio.current = true;

    const token = params.get('token') ?? '';
    if (!token) {
      setEstado('error');
      setMensaje('El enlace no es válido: falta el token.');
      return;
    }

    authService.verificarEmail(token)
      .then(res => {
        setEstado('ok');
        setMensaje(res.message);
        if (isAuthenticated) setEmailVerificado(true);
      })
      .catch(err => {
        setEstado('error');
        setMensaje(err.response?.data?.error || 'El enlace es inválido o ya expiró.');
      });
  }, [params, isAuthenticated, setEmailVerificado]);

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)', p: 2,
    }}>
      <Paper elevation={24} sx={{ p: { xs: 4, sm: 5 }, maxWidth: 440, width: '100%', borderRadius: 3, textAlign: 'center' }}>
        {estado === 'cargando' && (
          <>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography variant="h6">Verificando tu correo…</Typography>
          </>
        )}
        {estado === 'ok' && (
          <>
            <CheckCircleOutline color="success" sx={{ fontSize: 56, mb: 1 }} />
            <Typography variant="h5" fontWeight={800} gutterBottom>¡Correo verificado!</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {mensaje} Ya puedes usar {nombreSistema} sin restricciones.
            </Typography>
            <Button variant="contained" fullWidth onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}>
              {isAuthenticated ? 'Ir al panel' : 'Iniciar sesión'}
            </Button>
          </>
        )}
        {estado === 'error' && (
          <>
            <ErrorOutline color="error" sx={{ fontSize: 56, mb: 1 }} />
            <Typography variant="h5" fontWeight={800} gutterBottom>No pudimos verificar</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{mensaje}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Puedes pedir un enlace nuevo desde el banner de tu panel.
            </Typography>
            <Button variant="outlined" fullWidth onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}>
              {isAuthenticated ? 'Ir al panel' : 'Iniciar sesión'}
            </Button>
          </>
        )}
      </Paper>
    </Box>
  );
}
