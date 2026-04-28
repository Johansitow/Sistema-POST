/**
 * GlobalSnackbar — Notificaciones toast centralizadas.
 *
 * Montar UNA VEZ en App.tsx. Las páginas lo accionan mediante:
 *
 *   // Dentro de un componente React:
 *   const { showToast } = useUIStore();
 *   showToast('Guardado', 'success');
 *
 *   // Fuera de React (servicios, interceptors):
 *   import { toast } from '../../store/uiStore';
 *   toast.error('Error al guardar');
 */

import { Alert, Snackbar } from '@mui/material';
import { useUIStore } from '../../store/uiStore';

export function GlobalSnackbar() {
  const { toast, closeToast } = useUIStore();

  return (
    <Snackbar
      open={toast.open}
      autoHideDuration={toast.duration}
      onClose={closeToast}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      {/* Alert necesita ser hijo directo de Snackbar para que el `in` prop funcione */}
      <Alert
        onClose={closeToast}
        severity={toast.severity}
        variant="filled"
        sx={{ width: '100%', minWidth: 280, boxShadow: 4 }}
      >
        {toast.message}
      </Alert>
    </Snackbar>
  );
}
