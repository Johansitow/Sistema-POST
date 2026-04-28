/**
 * Skeletons — Componentes shimmer para estados de carga.
 *
 * Uso:
 *   <TableSkeleton rows={5} cols={4} />      // tabla vacía con shimmer
 *   <CardSkeleton count={4} />                // tarjetas de stats del dashboard
 *   <FormSkeleton fields={3} />               // formulario con inputs apilados
 *   <ListSkeleton rows={6} />                 // lista de ítems (avatar + texto)
 *
 * Todos los componentes usan `Skeleton` de MUI con animación "wave".
 */

import { Box, Card, CardContent, Skeleton, Stack, Grid as Grid } from '@mui/material';

// ── TableSkeleton ─────────────────────────────────────────────────────────────

interface TableSkeletonProps {
  /** Número de filas de datos a simular (sin contar el header) */
  rows?: number;
  /** Número de columnas */
  cols?: number;
  /** Mostrar fila de cabecera */
  showHeader?: boolean;
}

export function TableSkeleton({ rows = 5, cols = 4, showHeader = true }: TableSkeletonProps) {
  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      {showHeader && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 2,
            px: 2,
            py: 1.5,
            bgcolor: 'grey.50',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} variant="text" width="60%" height={20} animation="wave" />
          ))}
        </Box>
      )}

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <Box
          key={rowIdx}
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 2,
            px: 2,
            py: 1.25,
            borderBottom: '1px solid',
            borderColor: 'divider',
            '&:last-child': { borderBottom: 'none' },
          }}
        >
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton
              key={colIdx}
              variant="text"
              width={colIdx === 0 ? '80%' : `${40 + Math.random() * 40}%`}
              height={22}
              animation="wave"
            />
          ))}
        </Box>
      ))}
    </Box>
  );
}

// ── CardSkeleton ──────────────────────────────────────────────────────────────

interface CardSkeletonProps {
  /** Número de tarjetas a mostrar en una fila responsive */
  count?: number;
}

export function CardSkeleton({ count = 4 }: CardSkeletonProps) {
  return (
    <Grid container spacing={3}>
      {Array.from({ length: count }).map((_, i) => (
        <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
            <CardContent sx={{ p: 2.5 }}>
              {/* Icon placeholder */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Skeleton variant="rounded" width={44} height={44} animation="wave" />
                <Skeleton variant="rounded" width={60} height={22} animation="wave" />
              </Box>
              {/* Value */}
              <Skeleton variant="text" width="50%" height={36} animation="wave" />
              {/* Label */}
              <Skeleton variant="text" width="70%" height={20} animation="wave" sx={{ mt: 0.5 }} />
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

// ── FormSkeleton ──────────────────────────────────────────────────────────────

interface FormSkeletonProps {
  /** Número de campos de formulario a simular */
  fields?: number;
}

export function FormSkeleton({ fields = 4 }: FormSkeletonProps) {
  return (
    <Stack spacing={3} sx={{ width: '100%' }}>
      {Array.from({ length: fields }).map((_, i) => (
        <Box key={i}>
          <Skeleton variant="text" width="30%" height={18} animation="wave" sx={{ mb: 0.75 }} />
          <Skeleton variant="rounded" width="100%" height={56} animation="wave" />
        </Box>
      ))}
      {/* Button placeholder */}
      <Box sx={{ display: 'flex', gap: 2, pt: 1 }}>
        <Skeleton variant="rounded" width={120} height={40} animation="wave" />
        <Skeleton variant="rounded" width={100} height={40} animation="wave" />
      </Box>
    </Stack>
  );
}

// ── ListSkeleton ──────────────────────────────────────────────────────────────

interface ListSkeletonProps {
  /** Número de ítems de lista */
  rows?: number;
  /** Mostrar avatar circular a la izquierda */
  showAvatar?: boolean;
}

export function ListSkeleton({ rows = 5, showAvatar = true }: ListSkeletonProps) {
  return (
    <Stack spacing={0} divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />}>
      {Array.from({ length: rows }).map((_, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.5 }}>
          {showAvatar && (
            <Skeleton variant="circular" width={40} height={40} animation="wave" />
          )}
          <Box sx={{ flexGrow: 1 }}>
            <Skeleton variant="text" width="50%" height={20} animation="wave" />
            <Skeleton variant="text" width="35%" height={16} animation="wave" sx={{ mt: 0.5 }} />
          </Box>
          <Skeleton variant="rounded" width={70} height={28} animation="wave" />
        </Box>
      ))}
    </Stack>
  );
}
