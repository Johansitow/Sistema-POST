/**
 * ResetPasswordDialog — reseteo de contraseña de un empleado.
 *
 * Estaba definido inline dentro de Usuarios.tsx; se extrajo para que el listado
 * y la ficha del empleado usen exactamente el mismo diálogo y las mismas
 * validaciones.
 */

import { useEffect, useState } from 'react';
import {
  Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, IconButton, InputAdornment, TextField, Typography,
} from '@mui/material';
import { LockReset, Visibility, VisibilityOff } from '@mui/icons-material';
import { VALIDATION } from '../../utils/constants';

interface ResetPasswordDialogProps {
  open: boolean;
  nombre?: string;
  onClose: () => void;
  /** Debe lanzar si falla: el diálogo muestra el error y no se cierra. */
  onConfirm: (password: string) => Promise<void>;
}

export function ResetPasswordDialog({ open, nombre, onClose, onConfirm }: ResetPasswordDialogProps) {
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');

  useEffect(() => {
    if (open) { setPassword(''); setError(''); setShowPassword(false); }
  }, [open]);

  const handleSubmit = async () => {
    if (password.length < VALIDATION.PASSWORD_MIN_LENGTH) {
      setError(`Mínimo ${VALIDATION.PASSWORD_MIN_LENGTH} caracteres`);
      return;
    }
    setLoading(true);
    try {
      await onConfirm(password);
      onClose();
    } catch (err) {
      const data = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
      setError(data?.error ?? data?.message ?? 'Error al resetear la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LockReset fontSize="small" /> Resetear contraseña
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        {nombre && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Empleado: <strong>{nombre}</strong>
          </Typography>
        )}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField
          fullWidth autoFocus label="Nueva contraseña"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={e => { setPassword(e.target.value); setError(''); }}
          onKeyDown={e => { if (e.key === 'Enter' && !loading) handleSubmit(); }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShowPassword(s => !s)} edge="end">
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button variant="contained" color="warning" onClick={handleSubmit} disabled={loading}>
          {loading ? <CircularProgress size={20} /> : 'Resetear'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
