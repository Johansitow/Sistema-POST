/**
 * RequireRestaurante — guard de contexto de restaurante.
 *
 * Muestra un mensaje de bloqueo si no hay restaurante activo seleccionado.
 * Usar como wrapper en rutas que operan datos aislados por restaurante
 * (inventario, órdenes, caja, lotes, recetas, listas de compras).
 *
 * Rutas que NO deben usar este guard:
 *   - /reportes     → tiene vista de grupo como alternativa
 *   - /clientes     → scoped por grupo, no por restaurante
 *   - /admin/*      → gestión global
 *   - /ordenes-grupo → opera a nivel grupo
 */

import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { StorefrontOutlined } from '@mui/icons-material';
import { useRestauranteStore } from '../../store/restauranteStore';

interface Props {
  children: ReactNode;
}

export function RequireRestaurante({ children }: Props) {
  const { activo, restaurantes } = useRestauranteStore();

  if (activo) return <>{children}</>;

  return (
    <Box
      sx={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        minHeight:      '60vh',
        gap:            2,
        p:              4,
        textAlign:      'center',
      }}
    >
      <StorefrontOutlined sx={{ fontSize: 72, color: 'text.disabled' }} />

      <Typography variant="h6" fontWeight={700} color="text.secondary">
        Selecciona un restaurante para continuar
      </Typography>

      <Typography variant="body2" color="text.disabled" maxWidth={400}>
        Este módulo opera datos aislados por restaurante (inventario, órdenes, caja, etc.).
        Elige un restaurante activo desde la barra superior.
      </Typography>

      {restaurantes.length === 0 && (
        <Box
          sx={{
            mt:           1,
            px:           2,
            py:           1,
            bgcolor:      'warning.lighter',
            borderRadius: 2,
            border:       '1px solid',
            borderColor:  'warning.light',
          }}
        >
          <Typography variant="caption" color="warning.dark" fontWeight={600}>
            No tienes restaurantes asignados. Contacta al administrador del sistema.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
