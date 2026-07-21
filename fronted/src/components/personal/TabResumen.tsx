/**
 * TabResumen — KPIs y alertas del empleado.
 *
 * Solo muestra métricas que el sistema puede sustentar con datos reales:
 * órdenes atendidas, ventas generadas y cierres de caja. No hay modelo de
 * asistencia, así que no se reportan horas trabajadas ni ausencias.
 */

import { Alert, Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import {
  AccessTime, Cake, PointOfSale, ReceiptLong, Warning,
} from '@mui/icons-material';
import type { ReactNode } from 'react';
import type { Usuario, ResumenEmpleado } from '../../types';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { calcularAntiguedad, construirAlertas } from '../../utils/empleado';
import { InfoRow } from './InfoRow';

interface KpiCardProps {
  icon:    ReactNode;
  label:   string;
  valor:   string;
  detalle?: string;
  color?:  string;
}

function KpiCard({ icon, label, valor, detalle, color = 'primary.main' }: KpiCardProps) {
  return (
    <Card variant="outlined" sx={{ flex: '1 1 190px', minWidth: 190 }}>
      <CardContent sx={{ py: '16px !important' }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ color, mb: 0.5 }}>
          {icon}
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            {label}
          </Typography>
        </Stack>
        <Typography variant="h5" fontWeight={800} sx={{ color }}>{valor}</Typography>
        {detalle && (
          <Typography variant="caption" color="text.secondary">{detalle}</Typography>
        )}
      </CardContent>
    </Card>
  );
}

interface TabResumenProps {
  empleado: Usuario;
  resumen:  ResumenEmpleado | null;
}

export function TabResumen({ empleado, resumen }: TabResumenProps) {
  const alertas    = construirAlertas(empleado);
  const antiguedad = calcularAntiguedad(empleado.fecha_ingreso, empleado.fecha_retiro);

  // Una diferencia acumulada distinta de cero en caja es señal de revisión,
  // sea sobrante o faltante.
  const hayDescuadre = !!resumen && resumen.cierres_con_diferencia > 0;

  return (
    <Box>
      {alertas.length > 0 && (
        <Stack spacing={1} sx={{ mb: 3 }}>
          {alertas.map((a, i) => (
            <Alert key={i} severity={a.severidad} icon={a.mensaje.startsWith('🎂') ? <Cake /> : undefined}>
              {a.mensaje}
            </Alert>
          ))}
        </Stack>
      )}

      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
        Actividad de los últimos {resumen?.periodo_dias ?? 30} días
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <KpiCard
          icon={<ReceiptLong fontSize="small" />}
          label="Órdenes atendidas"
          valor={resumen ? String(resumen.ordenes_atendidas) : '—'}
          detalle="Solo órdenes entregadas"
        />
        <KpiCard
          icon={<PointOfSale fontSize="small" />}
          label="Ventas generadas"
          valor={resumen ? formatCurrency(resumen.ventas_generadas) : '—'}
          color="success.main"
        />
        <KpiCard
          icon={<AccessTime fontSize="small" />}
          label="Cierres de caja"
          valor={resumen ? String(resumen.cierres_caja) : '—'}
          detalle={
            resumen
              ? `${resumen.cierres_con_diferencia} con diferencia`
              : undefined
          }
          color={hayDescuadre ? 'warning.main' : 'primary.main'}
        />
        <KpiCard
          icon={<Warning fontSize="small" />}
          label="Diferencia acumulada"
          valor={resumen ? formatCurrency(resumen.diferencia_acumulada) : '—'}
          detalle="Sobrantes menos faltantes"
          color={hayDescuadre ? 'warning.main' : 'text.secondary'}
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <Card variant="outlined" sx={{ flex: '1 1 320px' }}>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Vínculo laboral
            </Typography>
            <InfoRow
              label="Fecha de ingreso"
              value={empleado.fecha_ingreso
                ? new Date(empleado.fecha_ingreso).toLocaleDateString('es-CO')
                : null}
              mostrarVacio
            />
            <InfoRow label="Antigüedad" value={antiguedad?.texto} mostrarVacio />
            <InfoRow label="Jefe directo" value={empleado.jefe_directo?.nombre_completo} mostrarVacio />
            <InfoRow label="Sede de nómina" value={empleado.restaurante_base?.nombre} mostrarVacio />
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ flex: '1 1 320px' }}>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Actividad en el sistema
            </Typography>
            <InfoRow
              label="Último acceso"
              value={empleado.ultimo_acceso ? formatDateTime(empleado.ultimo_acceso) : 'Nunca'}
              mostrarVacio
            />
            <InfoRow
              label="Última orden registrada"
              value={resumen?.ultima_actividad ? formatDateTime(resumen.ultima_actividad) : 'Sin órdenes'}
              mostrarVacio
            />
            <Box sx={{ mt: 1.5 }}>
              <Chip
                size="small"
                label={empleado.estado === 'activo' ? 'Cuenta activa' : 'Cuenta desactivada'}
                color={empleado.estado === 'activo' ? 'success' : 'default'}
                variant="outlined"
              />
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
