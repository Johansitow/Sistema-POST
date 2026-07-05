/**
 * TablaDesgloseRentabilidad
 *
 * Muestra el desglose de costos por ingrediente usando precios de ProveedorProducto.
 * Visible solo cuando el flag `rentabilidad_recetas` está activo.
 */

import {
  Alert, Box, Chip, Divider, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import { TrendingDown, TrendingUp, Warning } from '@mui/icons-material';

export interface DesgloseIngrediente {
  ingrediente:    string;
  cantidad:       number;
  unidad:         string;
  precio_unitario: number | null;
  subtotal:       number;
}

export interface DesgloseRentabilidad {
  desglose:           DesgloseIngrediente[];
  costo_total:        number;
  merma_porcentaje:   number;
  merma_costo:        number;
  costo_con_merma:    number;
  precio_venta:       number | null;
  margen_porcentaje:  number | null;
  advertencias:       { ingrediente: string; mensaje: string }[];
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

const UNIDAD_LABEL: Record<string, string> = {
  kilogramo: 'kg', gramo: 'g', litro: 'L', mililitro: 'mL',
  unidad: 'und', porcion: 'porción', taza: 'taza', cucharada: 'cda',
  rama: 'rama', pizca: 'pizca', porcion_aprox: 'porción aprox.',
};
const fmtU = (u: string) => UNIDAD_LABEL[u] ?? u;

interface Props {
  desglose: DesgloseRentabilidad;
}

export default function TablaDesgloseRentabilidad({ desglose }: Props) {
  const margen = desglose.margen_porcentaje;
  const margenColor = margen == null ? 'text.secondary'
    : margen >= 40  ? '#10b981'
    : margen >= 0   ? '#f59e0b'
    : '#ef4444';

  return (
    <Box>
      {/* Advertencias de proveedores faltantes */}
      {desglose.advertencias.length > 0 && (
        <Alert severity="warning" icon={<Warning fontSize="small" />} sx={{ mb: 2, borderRadius: 1.5, py: 0.5 }}>
          {desglose.advertencias.map(adv => (
            <Typography key={adv.ingrediente} variant="caption" display="block">
              <strong>{adv.ingrediente}:</strong> {adv.mensaje}
            </Typography>
          ))}
        </Alert>
      )}

      {/* Tabla de ingredientes con precios de proveedor */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell sx={{ fontWeight: 700 }}>Ingrediente</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Cantidad</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Precio proveedor</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Subtotal</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {desglose.desglose.map((item, idx) => (
              <TableRow key={idx} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>{item.ingrediente}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">{item.cantidad} {fmtU(item.unidad)}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" color={item.precio_unitario == null ? 'text.disabled' : 'text.primary'}>
                    {item.precio_unitario != null ? fmt(item.precio_unitario) : '—'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={700}>
                    {item.precio_unitario != null ? fmt(item.subtotal) : '—'}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Resumen de costos y margen */}
      <Box sx={{ mt: 2, px: 0.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary">Costo total ingredientes</Typography>
          <Typography variant="body2" fontWeight={600}>{fmt(desglose.costo_total)}</Typography>
        </Box>

        {desglose.merma_porcentaje > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Merma estimada ({desglose.merma_porcentaje}%)
            </Typography>
            <Typography variant="body2" color="warning.main">+{fmt(desglose.merma_costo)}</Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2" fontWeight={700}>Costo con merma</Typography>
          <Typography variant="body2" fontWeight={700}>{fmt(desglose.costo_con_merma)}</Typography>
        </Box>

        <Divider sx={{ my: 1 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary">Precio de venta</Typography>
          <Typography variant="body2" fontWeight={600}>
            {desglose.precio_venta != null ? fmt(desglose.precio_venta) : '—'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle2" fontWeight={700}>Margen</Typography>
          {margen != null ? (
            <Chip
              icon={margen >= 0 ? <TrendingUp fontSize="small" /> : <TrendingDown fontSize="small" />}
              label={`${margen.toFixed(1)}%`}
              size="small"
              sx={{
                bgcolor: margenColor + '20',
                color: margenColor,
                fontWeight: 700,
                '& .MuiChip-icon': { color: margenColor },
              }}
            />
          ) : (
            <Typography variant="body2" color="text.disabled">Indeterminado (sin precio de venta)</Typography>
          )}
        </Box>

        {margen != null && margen < 0 && (
          <Alert severity="error" sx={{ mt: 1.5, py: 0.5, borderRadius: 1.5 }}>
            <Typography variant="caption">
              Receta no rentable — el costo supera el precio de venta. Revisa los precios de los proveedores o el precio de venta.
            </Typography>
          </Alert>
        )}
      </Box>
    </Box>
  );
}
