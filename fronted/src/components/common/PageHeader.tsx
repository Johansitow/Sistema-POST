/**
 * PageHeader — encabezado reutilizable para todas las páginas
 *
 * Reemplaza el bloque repetido en cada página:
 * <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
 *   <Typography variant="h5">Título</Typography>
 *   <Button>Acción</Button>
 * </Box>
 *
 * Uso básico:
 * <PageHeader
 *   title="Gestión de Usuarios"
 *   subtitle="Administra los usuarios y sus permisos"
 * />
 *
 * Con botón de acción:
 * <PageHeader
 *   title="Gestión de Usuarios"
 *   subtitle="Administra los usuarios y sus permisos"
 *   action={{ label: 'Nuevo Usuario', icon: <Add />, onClick: handleOpen }}
 * />
 *
 * Con botón personalizado:
 * <PageHeader
 *   title="Reportes"
 *   subtitle="Análisis de ventas"
 *   actionNode={<ButtonGroup>...</ButtonGroup>}
 * />
 */

import { Box, Button, Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface PageHeaderAction {
  label:   string;
  icon?:   ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

interface PageHeaderProps {
  title:       string;
  subtitle?:   string;
  /** Botón de acción estándar (ej: "Nuevo Usuario") */
  action?:     PageHeaderAction;
  /** Nodo personalizado si necesitas algo más complejo que un botón */
  actionNode?: ReactNode;
  /** Margen inferior — default: 3 */
  mb?:         number;
}

export function PageHeader({
  title,
  subtitle,
  action,
  actionNode,
  mb = 3,
}: PageHeaderProps) {
  return (
    <Box
      sx={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        mb,
      }}
    >
      {/* Título y subtítulo */}
      <Box>
        <Typography variant="h5" fontWeight={700}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>

      {/* Botón de acción estándar */}
      {action && (
        <Button
          variant="contained"
          startIcon={action.icon}
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.label}
        </Button>
      )}

      {/* Nodo personalizado (tiene precedencia sobre action) */}
      {actionNode && !action && actionNode}
    </Box>
  );
}
