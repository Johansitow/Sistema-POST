/**
 * ModuloBloqueado — pantalla de upsell cuando el plan del grupo no incluye un módulo.
 * Reemplaza el contenido del módulo (no redirige) e invita a mejorar de plan.
 */

import { Box, Card, CardContent, Typography, Button, Stack } from '@mui/material';
import { LockOutlined, ArrowUpward } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import type { ModuloPlan } from '../../services/planes.service';

const ETIQUETA: Record<ModuloPlan, string> = {
  recetas:        'Recetas y rentabilidad',
  proveedores:    'Proveedores',
  listas_compras: 'Listas de compras',
  clientes:       'Clientes y fidelización',
  nomina:         'Nómina',
  documentos:     'Documentos laborales',
};

/** Plan comercial mínimo que desbloquea el módulo (espeja moduloMinimoPlan del backend). */
const PLAN_REQUERIDO: Record<ModuloPlan, string> = {
  recetas:        'Pro',
  proveedores:    'Pro',
  listas_compras: 'Pro',
  clientes:       'Pro',
  nomina:         'Negocio',
  documentos:     'Negocio',
};

export default function ModuloBloqueado({ modulo }: { modulo: ModuloPlan }) {
  const navigate = useNavigate();
  const nombre = ETIQUETA[modulo] ?? 'Esta función';
  const plan   = PLAN_REQUERIDO[modulo] ?? 'un plan superior';

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', p: 2 }}>
      <Card sx={{ maxWidth: 460, width: '100%', textAlign: 'center' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{
            width: 64, height: 64, borderRadius: '50%', mx: 'auto', mb: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: 'action.hover',
          }}>
            <LockOutlined sx={{ fontSize: 32 }} color="action" />
          </Box>
          <Typography variant="h6" fontWeight={800} gutterBottom>
            {nombre} es del plan {plan}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Mejora tu plan para desbloquear este módulo y seguir haciendo crecer tu negocio.
          </Typography>
          <Stack direction="row" spacing={1} justifyContent="center">
            <Button variant="outlined" onClick={() => navigate('/dashboard')}>
              Volver al inicio
            </Button>
            <Button variant="contained" startIcon={<ArrowUpward />} onClick={() => navigate('/admin/mi-plan')}>
              Mejorar a {plan}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
