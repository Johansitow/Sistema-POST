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

// ─── Mapas de color y label ───────────────────────────────────────────────────

const ENTIDAD_CONFIG: Record<string, { color: ChipProps['color']; label: string }> = {
  activo:    { color: 'success', label: 'Activo' },
  inactivo:  { color: 'default', label: 'Inactivo' },
  eliminado: { color: 'error',   label: 'Eliminado' },
};

const ORDEN_CONFIG: Record<string, { color: ChipProps['color']; label: string }> = {
  PENDIENTE:  { color: 'warning', label: 'Pendiente' },
  CONFIRMADA: { color: 'info',    label: 'Confirmada' },
  EN_PROCESO: { color: 'primary', label: 'En proceso' },
  LISTA:      { color: 'success', label: 'Lista' },
  ENTREGADA:  { color: 'success', label: 'Entregada' },
  CANCELADA:  { color: 'error',   label: 'Cancelada' },
};

// ─── Componente ───────────────────────────────────────────────────────────────

export function StatusChip({
  estado,
  type    = 'entidad',
  size    = 'small',
  variant = 'outlined',
}: StatusChipProps) {
  const config =
    type === 'orden'
      ? ORDEN_CONFIG[estado]  ?? { color: 'default' as const, label: estado }
      : ENTIDAD_CONFIG[estado] ?? { color: 'default' as const, label: estado };

  return (
    <Chip
      label={config.label}
      color={config.color}
      size={size}
      variant={variant}
    />
  );
}
