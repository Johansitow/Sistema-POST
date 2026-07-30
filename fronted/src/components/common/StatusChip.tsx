/**
 * StatusChip — chip de estado reutilizable
 *
 * Reemplaza el patrón repetido en tablas de Usuarios, Inventario, etc.:
 * <Chip label={u.estado} color={estadoColor(u.estado)} variant="outlined" />
 *
 * Usos:
 *
 * Estado de entidad (usuario, producto):
 * <StatusChip estado="activo" />
 * <StatusChip estado="inactivo" />
 * <StatusChip estado="eliminado" />
 *
 * Estado de orden (con código del backend):
 * <StatusChip estado="ENTREGADA" type="orden" />
 *
 * Tamaño pequeño para tablas densas:
 * <StatusChip estado="activo" size="small" />
 */

import { Chip } from '@mui/material';
import type { ChipProps } from '@mui/material';
import { colorMuiEstado, definirEstado } from '../../theme/estados';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type EstadoEntidad = 'activo' | 'inactivo' | 'eliminado';
type EstadoOrden   =
  | 'PENDIENTE' | 'CONFIRMADA' | 'EN_PROCESO'
  | 'LISTA'     | 'ENTREGADA'  | 'CANCELADA';

interface StatusChipProps {
  estado:   EstadoEntidad | EstadoOrden | string;
  type?:    'entidad' | 'orden';
  size?:    ChipProps['size'];
  variant?: ChipProps['variant'];
}

// ─── Componente ───────────────────────────────────────────────────────────────
//
// Los dos mapas que vivían aquí (ENTIDAD_CONFIG y ORDEN_CONFIG) se movieron a
// theme/estados.ts, donde también están los que usaban Órdenes, Cocina y
// Facturas. Antes "Pendiente" se definía cinco veces y se desincronizaban.

export function StatusChip({
  estado,
  type    = 'entidad',
  size    = 'small',
  variant = 'outlined',
}: StatusChipProps) {
  const dominio = type === 'orden' ? 'orden' : 'entidad';

  return (
    <Chip
      label={definirEstado(estado, dominio).label}
      color={colorMuiEstado(estado, dominio)}
      size={size}
      variant={variant}
    />
  );
}
