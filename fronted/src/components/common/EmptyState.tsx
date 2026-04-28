/**
 * EmptyState — mensaje cuando no hay datos en una tabla o lista
 *
 * Uso en tablas:
 * <TableRow>
 *   <TableCell colSpan={6}>
 *     <EmptyState message="No se encontraron usuarios" />
 *   </TableCell>
 * </TableRow>
 *
 * Con acción para crear el primer item:
 * <EmptyState
 *   message="No hay productos registrados"
 *   actionLabel="Crear primer producto"
 *   onAction={() => setOpenForm(true)}
 * />
 *
 * Con ícono personalizado:
 * <EmptyState
 *   message="No hay órdenes hoy"
 *   icon={<ShoppingCart sx={{ fontSize: 48, color: 'text.disabled' }} />}
 * />
 */

import { Box, Button, Typography } from '@mui/material';
import { Inbox } from '@mui/icons-material';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  message:      string;
  description?: string;
  icon?:        ReactNode;
  actionLabel?: string;
  onAction?:    () => void;
}

export function EmptyState({
  message,
  description,
  icon,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <Box
      sx={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        py:             6,
        gap:            1.5,
        color:          'text.secondary',
      }}
    >
      {/* Ícono — default: bandeja de entrada */}
      {icon ?? (
        <Inbox sx={{ fontSize: 48, color: 'text.disabled' }} />
      )}

      {/* Mensaje principal */}
      <Typography variant="body1" fontWeight={500} color="text.secondary">
        {message}
      </Typography>

      {/* Descripción opcional */}
      {description && (
        <Typography variant="body2" color="text.disabled" textAlign="center">
          {description}
        </Typography>
      )}

      {/* Botón de acción opcional */}
      {actionLabel && onAction && (
        <Button
          variant="outlined"
          size="small"
          onClick={onAction}
          sx={{ mt: 1 }}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}
