/**
 * MiPlan — plan actual del grupo, consumo vs. límites y la escalera de planes.
 *
 * En esta fase el botón "Mejorar" solo informa (el cobro con Wompi llega en la
 * Fase B). El consumo se lee de GET /planes/mi-plan; la escalera de GET /planes.
 */

import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Chip, Divider, LinearProgress, Typography,
  List, ListItem, ListItemIcon, ListItemText, Button, Alert,
} from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import { usePlanStore } from '../../store/planStore';
import { planesService, formatoCOP, esIlimitado, type Plan } from '../../services/planes.service';

/** Barra de consumo de un recurso; ilimitado se muestra sin barra. */
function Medidor({ etiqueta, actual, max }: { etiqueta: string; actual: number; max: number }) {
  const ilimitado = esIlimitado(max);
  const pct = ilimitado ? 0 : Math.min(100, Math.round((actual / max) * 100));
  const alTope = !ilimitado && actual >= max;
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2">{etiqueta}</Typography>
        <Typography variant="body2" color={alTope ? 'error' : 'text.secondary'} fontWeight={600}>
          {actual}{ilimitado ? '' : ` / ${max}`}
        </Typography>
      </Box>
      {ilimitado
        ? <Chip label="Ilimitado" size="small" color="success" variant="outlined" />
        : <LinearProgress variant="determinate" value={pct} color={alTope ? 'error' : 'primary'}
            sx={{ height: 8, borderRadius: 4 }} />}
    </Box>
  );
}

export default function MiPlan() {
  const { planYUso, loading, loadMiPlan } = usePlanStore();
  const [planes, setPlanes] = useState<Plan[]>([]);

  useEffect(() => { loadMiPlan(); }, [loadMiPlan]);
  useEffect(() => { planesService.listar().then(setPlanes).catch(() => {}); }, []);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
      <Typography variant="h4" fontWeight={800} gutterBottom>Mi plan</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Revisa tu consumo y descubre lo que incluye cada plan.
      </Typography>

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      {/* ── Plan actual + consumo ── */}
      {planYUso && (
        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="h6" fontWeight={700}>Plan {planYUso.nombre}</Typography>
              <Chip
                label={planYUso.precio_mensual_cop === 0 ? 'Gratis' : `${formatoCOP(planYUso.precio_mensual_cop)}/mes`}
                color="primary" size="small"
              />
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Medidor etiqueta="Sedes" actual={planYUso.uso.sedes} max={planYUso.limites.max_sedes} />
            <Medidor etiqueta="Usuarios" actual={planYUso.uso.usuarios} max={planYUso.limites.max_usuarios} />
            <Medidor etiqueta="Productos" actual={planYUso.uso.productos} max={planYUso.limites.max_productos} />
          </CardContent>
        </Card>
      )}

      {/* ── Escalera de planes ── */}
      <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Planes disponibles</Typography>
      <Box sx={{
        display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3, mb: 3,
      }}>
        {planes.map(plan => {
          const esActual = planYUso?.plan === plan.codigo;
          return (
            <Card key={plan.codigo} variant={esActual ? 'elevation' : 'outlined'} elevation={esActual ? 6 : 0}
              sx={{ borderColor: esActual ? 'primary.main' : 'divider', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="overline" color="text.secondary">{plan.nombre}</Typography>
                  {esActual && <Chip label="Tu plan" size="small" color="primary" />}
                </Box>
                <Typography variant="h4" fontWeight={800} sx={{ my: 1 }}>
                  {plan.precio_mensual_cop === 0 ? 'Gratis' : formatoCOP(plan.precio_mensual_cop)}
                </Typography>
                <List dense sx={{ flexGrow: 1 }}>
                  {plan.modulos.map((m, i) => (
                    <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
                      <ListItemIcon sx={{ minWidth: 30 }}><CheckCircle color="primary" fontSize="small" /></ListItemIcon>
                      <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={m} />
                    </ListItem>
                  ))}
                </List>
                <Button
                  fullWidth variant={esActual ? 'outlined' : 'contained'} disabled={esActual}
                  sx={{ mt: 2, fontWeight: 700 }}
                  onClick={() => { /* Fase B: checkout con Wompi */ }}
                >
                  {esActual ? 'Plan actual' : 'Mejorar (próximamente)'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      <Alert severity="info" variant="outlined">
        El pago en línea (PSE y tarjeta) estará disponible muy pronto. Por ahora, para cambiar de
        plan escríbenos y lo activamos manualmente.
      </Alert>
    </Box>
  );
}
