/**
 * FichaHeader — cabecera ejecutiva de la ficha del empleado.
 *
 * Identidad + estado laboral + antigüedad + acciones rápidas. Es lo que hace
 * que la pantalla se lea como una ficha de personal y no como una fila de una
 * tabla de usuarios.
 */

import {
  Avatar, Box, Button, Chip, Divider, Paper, Stack, Tooltip, Typography,
} from '@mui/material';
import {
  ArrowBack, Badge as BadgeIcon, Business, LockReset, PersonAdd, PersonOff, Shield,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import type { Usuario } from '../../types';
import { getInitials } from '../../utils/format';
import {
  ESTADO_LABORAL_COLOR, ESTADO_LABORAL_LABEL, TIPO_CONTRATO_LABEL,
  calcularAntiguedad, etiqueta,
} from '../../utils/empleado';

interface FichaHeaderProps {
  empleado: Usuario;
  /** Deshabilita las acciones destructivas sobre el superadmin. */
  puedeGestionar: boolean;
  onResetPassword: () => void;
  onToggleEstado: () => void;
}

export function FichaHeader({
  empleado, puedeGestionar, onResetPassword, onToggleEstado,
}: FichaHeaderProps) {
  const navigate = useNavigate();

  const estadoLaboral = empleado.estado_laboral ?? 'activo';
  // Para un empleado retirado la antigüedad se congela en su fecha de retiro
  const antiguedad = calcularAntiguedad(empleado.fecha_ingreso, empleado.fecha_retiro);
  const activo     = empleado.estado === 'activo';

  return (
    <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
      <Button
        startIcon={<ArrowBack />}
        size="small"
        onClick={() => navigate('/admin/usuarios')}
        sx={{ mb: 2 }}
      >
        Volver al listado
      </Button>

      <Box sx={{
        display: 'flex', gap: 3, alignItems: 'flex-start',
        flexDirection: { xs: 'column', sm: 'row' },
      }}>
        <Avatar
          src={empleado.foto_url ?? undefined}
          sx={{
            width: 88, height: 88, fontSize: '2rem', fontWeight: 700,
            bgcolor: empleado.es_super_admin ? 'warning.main' : (empleado.rol.color || 'primary.main'),
          }}
        >
          {empleado.es_super_admin ? <Shield fontSize="large" /> : getInitials(empleado.nombre_completo)}
        </Avatar>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="h5" fontWeight={700}>{empleado.nombre_completo}</Typography>
            {empleado.codigo_empleado && (
              <Chip
                icon={<BadgeIcon sx={{ fontSize: '14px !important' }} />}
                label={empleado.codigo_empleado}
                size="small"
                variant="outlined"
                sx={{ fontWeight: 700, fontFamily: 'monospace' }}
              />
            )}
          </Stack>

          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.25 }}>
            {empleado.cargo || 'Sin cargo asignado'}
            {empleado.restaurante_base && (
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
                <Business sx={{ fontSize: 14 }} />
                {empleado.restaurante_base.nombre}
              </Box>
            )}
          </Typography>

          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
            <Chip
              label={ESTADO_LABORAL_LABEL[estadoLaboral]}
              color={ESTADO_LABORAL_COLOR[estadoLaboral]}
              size="small"
              sx={{ fontWeight: 700 }}
            />
            <Chip label={empleado.rol.nombre} size="small" variant="outlined"
              sx={{ borderColor: empleado.rol.color || undefined, color: empleado.rol.color || undefined }} />
            {empleado.tipo_contrato && (
              <Chip label={etiqueta(TIPO_CONTRATO_LABEL, empleado.tipo_contrato)} size="small" variant="outlined" />
            )}
            {antiguedad && (
              <Chip label={`Antigüedad: ${antiguedad.texto}`} size="small" variant="outlined" />
            )}
            {!activo && (
              <Chip label="Cuenta desactivada" size="small" color="default" variant="outlined" />
            )}
          </Stack>
        </Box>

        <Stack spacing={1} sx={{ minWidth: 190 }}>
          <Tooltip title={puedeGestionar ? '' : 'El super admin no puede ser modificado'}>
            <span>
              <Button
                fullWidth variant="outlined" size="small"
                startIcon={<LockReset />} disabled={!puedeGestionar}
                onClick={onResetPassword}
              >
                Resetear contraseña
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={puedeGestionar ? '' : 'El super admin no puede ser desactivado'}>
            <span>
              <Button
                fullWidth variant="outlined" size="small"
                color={activo ? 'error' : 'success'}
                startIcon={activo ? <PersonOff /> : <PersonAdd />}
                disabled={!puedeGestionar}
                onClick={onToggleEstado}
              >
                {activo ? 'Desactivar acceso' : 'Activar acceso'}
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Box>

      {empleado.estado_laboral === 'retirado' && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="body2" color="text.secondary">
            Retirado el{' '}
            <strong>
              {empleado.fecha_retiro
                ? new Date(empleado.fecha_retiro).toLocaleDateString('es-CO')
                : 'fecha no registrada'}
            </strong>
            {empleado.motivo_retiro && ` — ${empleado.motivo_retiro}`}
          </Typography>
        </>
      )}
    </Paper>
  );
}
