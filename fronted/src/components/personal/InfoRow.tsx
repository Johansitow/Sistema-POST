/**
 * InfoRow — fila etiqueta/valor para mostrar datos de solo lectura.
 *
 * Estaba definida inline en Perfil.tsx; se extrajo aquí para que la ficha del
 * empleado y el portal del trabajador muestren los datos exactamente igual.
 */

import { Box, Typography } from '@mui/material';

interface InfoRowProps {
  label: string;
  value?: string | number | null;
  /** Muestra la fila con un guion cuando no hay dato, en vez de ocultarla. */
  mostrarVacio?: boolean;
}

export function InfoRow({ label, value, mostrarVacio = false }: InfoRowProps) {
  const vacio = value === null || value === undefined || value === '';
  if (vacio && !mostrarVacio) return null;

  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.75 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography
        variant="body2"
        fontWeight={vacio ? 400 : 600}
        color={vacio ? 'text.disabled' : 'text.primary'}
        sx={{ textAlign: 'right' }}
      >
        {vacio ? '—' : value}
      </Typography>
    </Box>
  );
}
