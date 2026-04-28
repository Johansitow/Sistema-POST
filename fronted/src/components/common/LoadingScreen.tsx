/**
 * LoadingScreen — pantalla de carga para estados de espera
 *
 * Tres variantes según el contexto:
 *
 * Página completa (ruta cargando):
 * <LoadingScreen />
 * <LoadingScreen message="Cargando usuarios..." />
 *
 * Dentro de una card o sección:
 * <LoadingScreen variant="inline" />
 *
 * Fila de tabla (colSpan necesario):
 * <TableRow>
 *   <TableCell colSpan={6}>
 *     <LoadingScreen variant="table" />
 *   </TableCell>
 * </TableRow>
 */

import { Box, CircularProgress, Typography } from '@mui/material';

interface LoadingScreenProps {
  message?:  string;
  variant?:  'page' | 'inline' | 'table';
}

export function LoadingScreen({
  message = 'Cargando...',
  variant = 'page',
}: LoadingScreenProps) {

  // ── Variante tabla: compacta, centrada, sin fondo ──
  if (variant === 'table') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  // ── Variante inline: dentro de cards o secciones ──
  if (variant === 'inline') {
    return (
      <Box
        sx={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            2,
          py:             6,
        }}
      >
        <CircularProgress size={28} />
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      </Box>
    );
  }

  // ── Variante página: ocupa toda la pantalla ──
  return (
    <Box
      sx={{
        minHeight:      '100vh',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            2,
        bgcolor:        'background.default',
      }}
    >
      <CircularProgress size={48} color="primary" />
      <Typography variant="body1" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
}
