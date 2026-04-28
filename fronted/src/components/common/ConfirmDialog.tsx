/**
 * ConfirmDialog — diálogo de confirmación reutilizable
 *
 * Úsalo para cualquier acción destructiva o irreversible:
 * - Desactivar / activar usuario
 * - Eliminar producto
 * - Cancelar orden
 *
 * Maneja su propio estado de loading para no bloquear el componente padre.
 *
 * Uso:
 * <ConfirmDialog
 *   open={open}
 *   title="Desactivar usuario"
 *   message='¿Estás seguro? El usuario "Juan" perderá acceso al sistema.'
 *   confirmText="Desactivar"
 *   confirmColor="error"
 *   onConfirm={handleDesactivar}
 *   onClose={() => setOpen(false)}
 * />
 */

import {
  Button, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, Typography,
} from '@mui/material';
import { useState } from 'react';

interface ConfirmDialogProps {
  open:          boolean;
  title:         string;
  message:       string;
  confirmText?:  string;
  cancelText?:   string;
  /** Color del botón de confirmación */
  confirmColor?: 'error' | 'warning' | 'success' | 'primary';
  /** Función asíncrona o síncrona que se ejecuta al confirmar */
  onConfirm:     () => Promise<void> | void;
  onClose:       () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText  = 'Confirmar',
  cancelText   = 'Cancelar',
  confirmColor = 'primary',
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      // Siempre apagar loading aunque onConfirm lance un error
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle fontWeight={700}>{title}</DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        <Typography color="text.secondary">{message}</Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          {cancelText}
        </Button>
        <Button
          variant="contained"
          color={confirmColor}
          onClick={handleConfirm}
          disabled={loading}
        >
          {loading
            ? <CircularProgress size={20} color="inherit" />
            : confirmText
          }
        </Button>
      </DialogActions>
    </Dialog>
  );
}
