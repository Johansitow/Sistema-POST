/**
 * OlvidePassword — solicita el correo de restablecimiento (`/olvide-password`).
 *
 * Muestra SIEMPRE un mensaje genérico tras enviar (exista o no el correo), para no
 * revelar qué cuentas están registradas. Incluye captcha en producción.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, TextField, Button, Typography, Alert, InputAdornment, CircularProgress,
} from '@mui/material';
import { MailOutline } from '@mui/icons-material';
import { authService } from '../services/auth.service';
import { Captcha } from '../components/common/Captcha';

export function OlvidePassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('Ingresa tu correo.'); return; }
    setLoading(true);
    setError(null);
    try {
      await authService.solicitarReset(email, captchaToken);
      setEnviado(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'No pudimos procesar la solicitud. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)', p: 2,
    }}>
      <Paper elevation={24} sx={{ p: { xs: 4, sm: 5 }, maxWidth: 440, width: '100%', borderRadius: 3 }}>
        <Typography variant="h5" fontWeight={800} gutterBottom>Recuperar contraseña</Typography>

        {enviado ? (
          <>
            <Alert severity="success" sx={{ my: 2 }}>
              Si el correo está registrado, te enviamos las instrucciones para restablecer tu
              contraseña. Revisa tu bandeja (y la carpeta de spam).
            </Alert>
            <Button fullWidth variant="contained" onClick={() => navigate('/login')}>Volver a iniciar sesión</Button>
          </>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Escribe tu correo y te enviaremos un enlace para crear una nueva contraseña.
            </Typography>
            <Box component="form" onSubmit={handleSubmit}>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <TextField
                fullWidth label="Correo" type="email" autoComplete="email" autoFocus
                value={email} onChange={e => { setEmail(e.target.value); if (error) setError(null); }}
                disabled={loading} sx={{ mb: 2 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><MailOutline color="action" /></InputAdornment> }}
              />
              <Captcha onToken={setCaptchaToken} />
              <Button type="submit" fullWidth variant="contained" size="large" disabled={loading} sx={{ mt: 1, py: 1.3, fontWeight: 700 }}>
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Enviar enlace'}
              </Button>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 3 }}>
              <Button variant="text" size="small" onClick={() => navigate('/login')}>Volver</Button>
            </Typography>
          </>
        )}
      </Paper>
    </Box>
  );
}
