/**
 * RestablecerPassword — fija la nueva contraseña con el token del correo
 * (`/restablecer-password?token=`). Valida la política de contraseña en vivo y la
 * confirmación. Página pública.
 */

import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Paper, TextField, Button, Typography, Alert, InputAdornment, IconButton,
  CircularProgress, List, ListItem, ListItemIcon, ListItemText,
} from '@mui/material';
import {
  LockOutlined, Visibility, VisibilityOff, CheckCircle, RadioButtonUnchecked,
} from '@mui/icons-material';
import { authService } from '../services/auth.service';

/** Debe coincidir con passwordFuerte del backend. */
const reglasPassword = (pwd: string) => [
  { ok: pwd.length >= 8, label: 'Al menos 8 caracteres' },
  { ok: /[A-Z]/.test(pwd), label: 'Una mayúscula' },
  { ok: /[a-z]/.test(pwd), label: 'Una minúscula' },
  { ok: /[0-9]/.test(pwd), label: 'Un número' },
];

export function RestablecerPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reglas = useMemo(() => reglasPassword(password), [password]);
  const passwordOk = reglas.every(r => r.ok);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) { setError('El enlace no es válido: falta el token.'); return; }
    if (!passwordOk) { setError('La contraseña no cumple los requisitos.'); return; }
    if (password !== confirmar) { setError('Las contraseñas no coinciden.'); return; }

    setLoading(true);
    setError(null);
    try {
      await authService.confirmarReset(token, password);
      setListo(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'El enlace es inválido o ya expiró. Solicita uno nuevo.');
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
        <Typography variant="h5" fontWeight={800} gutterBottom>Nueva contraseña</Typography>

        {listo ? (
          <>
            <Alert severity="success" sx={{ my: 2 }}>Tu contraseña se actualizó. Ya puedes iniciar sesión.</Alert>
            <Button fullWidth variant="contained" onClick={() => navigate('/login')}>Iniciar sesión</Button>
          </>
        ) : (
          <Box component="form" onSubmit={handleSubmit}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <TextField
              fullWidth label="Nueva contraseña" type={show ? 'text' : 'password'} autoComplete="new-password" autoFocus
              value={password} onChange={e => { setPassword(e.target.value); if (error) setError(null); }}
              disabled={loading} sx={{ mb: 1 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><LockOutlined color="action" /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShow(!show)} edge="end" size="small">
                      {show ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {password.length > 0 && (
              <List dense disablePadding sx={{ mb: 1 }}>
                {reglas.map((r, i) => (
                  <ListItem key={i} disableGutters sx={{ py: 0 }}>
                    <ListItemIcon sx={{ minWidth: 26 }}>
                      {r.ok
                        ? <CheckCircle color="success" sx={{ fontSize: 16 }} />
                        : <RadioButtonUnchecked color="disabled" sx={{ fontSize: 16 }} />}
                    </ListItemIcon>
                    <ListItemText
                      primaryTypographyProps={{ variant: 'caption', color: r.ok ? 'success.main' : 'text.secondary' }}
                      primary={r.label}
                    />
                  </ListItem>
                ))}
              </List>
            )}

            <TextField
              fullWidth label="Confirmar contraseña" type={show ? 'text' : 'password'} autoComplete="new-password"
              value={confirmar} onChange={e => { setConfirmar(e.target.value); if (error) setError(null); }}
              disabled={loading} sx={{ mb: 2 }}
              error={confirmar.length > 0 && confirmar !== password}
              helperText={confirmar.length > 0 && confirmar !== password ? 'Las contraseñas no coinciden' : ' '}
              InputProps={{ startAdornment: <InputAdornment position="start"><LockOutlined color="action" /></InputAdornment> }}
            />

            <Button type="submit" fullWidth variant="contained" size="large" disabled={loading} sx={{ py: 1.3, fontWeight: 700 }}>
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Cambiar contraseña'}
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
