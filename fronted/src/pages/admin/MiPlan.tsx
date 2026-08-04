/**
 * MiPlan — plan actual del grupo, consumo vs. límites, estado de suscripción y
 * checkout de mejora de plan (Wompi: Nequi tokenizado / PSE puntual).
 *
 * El consumo/plan se lee de GET /planes/mi-plan (todo miembro) y el estado de
 * suscripción de GET /suscripciones/estado (owner/admin; si 403, se ocultan las
 * acciones de cobro). En modo sin llaves (dev) el cobro se simula.
 */

import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Chip, Divider, LinearProgress, Typography,
  List, ListItem, ListItemIcon, ListItemText, Button, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  ToggleButton, ToggleButtonGroup, CircularProgress,
} from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import { usePlanStore } from '../../store/planStore';
import { planesService, formatoCOP, esIlimitado, type Plan } from '../../services/planes.service';
import { suscripcionService, type EstadoSuscripcion, type MetodoPago } from '../../services/suscripcion.service';

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

/** Banner del estado de la suscripción (vencida / pendiente / activa / simulado). */
function BannerSuscripcion({ estado }: { estado: EstadoSuscripcion }) {
  const sub = estado.suscripcion;
  if (!estado.cobro_real) {
    return (
      <Alert severity="info" variant="outlined" sx={{ mb: 3 }}>
        Modo de prueba: el cobro está simulado (sin pasarela configurada). Al "Mejorar" el plan se
        activa al instante para que puedas probar el flujo.
      </Alert>
    );
  }
  if (!sub) return null;
  if (sub.estado === 'vencida') {
    return <Alert severity="warning" sx={{ mb: 3 }}>Tu suscripción venció y volviste al plan Gratis. Vuelve a activar un plan cuando quieras.</Alert>;
  }
  if (sub.estado === 'pendiente_pago') {
    return <Alert severity="warning" sx={{ mb: 3 }}>Tu pago está pendiente. Completa el pago para mantener tu plan.</Alert>;
  }
  if (sub.estado === 'activa' && sub.proximo_cobro) {
    return <Alert severity="success" variant="outlined" sx={{ mb: 3 }}>Suscripción activa. Próximo cobro: {new Date(sub.proximo_cobro).toLocaleDateString('es-CO')}.</Alert>;
  }
  return null;
}

/** Modal de checkout: elige método y confirma la mejora de plan. */
function CheckoutModal({ plan, onClose, onHecho }: { plan: Plan; onClose: () => void; onHecho: (msg: string) => void }) {
  const [metodo, setMetodo] = useState<MetodoPago>('nequi');
  const [celular, setCelular] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmar = async () => {
    setError(null);
    if (metodo === 'nequi' && !/^3\d{9}$/.test(celular)) {
      setError('Ingresa un número de celular Nequi válido (10 dígitos).');
      return;
    }
    setCargando(true);
    try {
      const datos = metodo === 'nequi' ? { phone_number: celular } : {};
      const res = await suscripcionService.checkout(plan.codigo, metodo, datos);
      if (res.url_redireccion) {
        window.location.href = res.url_redireccion; // PSE: redirección al banco
        return;
      }
      if (res.estado === 'aprobada') onHecho(`¡Listo! Tu plan ${plan.nombre} quedó activo.`);
      else onHecho('Tu pago quedó en proceso. Te avisaremos cuando se confirme.');
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'No se pudo iniciar el pago. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Dialog open onClose={cargando ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Mejorar a {plan.nombre} — {formatoCOP(plan.precio_mensual_cop)}/mes</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Elige cómo quieres pagar tu suscripción mensual.
        </Typography>
        <ToggleButtonGroup
          exclusive fullWidth value={metodo} onChange={(_, v) => v && setMetodo(v)} sx={{ mb: 2 }}
        >
          <ToggleButton value="nequi">Nequi (cobro automático)</ToggleButton>
          <ToggleButton value="pse">PSE (pago manual)</ToggleButton>
        </ToggleButtonGroup>

        {metodo === 'nequi' && (
          <TextField
            fullWidth label="Celular Nequi" placeholder="3001234567" value={celular}
            onChange={(e) => setCelular(e.target.value.replace(/\D/g, '').slice(0, 10))}
            inputProps={{ inputMode: 'numeric' }}
          />
        )}
        {metodo === 'pse' && (
          <Alert severity="info" variant="outlined">
            Te llevaremos al portal de tu banco para completar el pago del período. PSE no permite
            cobro automático; cada mes deberás renovar manualmente.
          </Alert>
        )}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={cargando}>Cancelar</Button>
        <Button variant="contained" onClick={confirmar} disabled={cargando}
          startIcon={cargando ? <CircularProgress size={16} /> : undefined}>
          {cargando ? 'Procesando…' : 'Pagar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function MiPlan() {
  const { planYUso, loading, loadMiPlan, reloadMiPlan } = usePlanStore();
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [estadoSub, setEstadoSub] = useState<EstadoSuscripcion | null>(null);
  const [puedeGestionar, setPuedeGestionar] = useState(false);
  const [planEnCheckout, setPlanEnCheckout] = useState<Plan | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargarEstado = () =>
    suscripcionService.estado()
      .then((e) => { setEstadoSub(e); setPuedeGestionar(true); })
      .catch(() => { setPuedeGestionar(false); }); // 403 = no es owner/admin

  useEffect(() => { loadMiPlan(); }, [loadMiPlan]);
  useEffect(() => { planesService.listar().then(setPlanes).catch(() => {}); }, []);
  useEffect(() => { cargarEstado(); }, []);

  const alHecho = (msg: string) => {
    setPlanEnCheckout(null);
    setAviso(msg);
    reloadMiPlan();
    cargarEstado();
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
      <Typography variant="h4" fontWeight={800} gutterBottom>Mi plan</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Revisa tu consumo, gestiona tu suscripción y descubre lo que incluye cada plan.
      </Typography>

      {loading && <LinearProgress sx={{ mb: 3 }} />}
      {aviso && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setAviso(null)}>{aviso}</Alert>}
      {estadoSub && <BannerSuscripcion estado={estadoSub} />}

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
          const esGratis = plan.precio_mensual_cop === 0;
          return (
            <Card key={plan.codigo} variant={esActual ? 'elevation' : 'outlined'} elevation={esActual ? 6 : 0}
              sx={{ borderColor: esActual ? 'primary.main' : 'divider', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="overline" color="text.secondary">{plan.nombre}</Typography>
                  {esActual && <Chip label="Tu plan" size="small" color="primary" />}
                </Box>
                <Typography variant="h4" fontWeight={800} sx={{ my: 1 }}>
                  {esGratis ? 'Gratis' : formatoCOP(plan.precio_mensual_cop)}
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
                  fullWidth variant={esActual ? 'outlined' : 'contained'}
                  disabled={esActual || esGratis || !puedeGestionar}
                  sx={{ mt: 2, fontWeight: 700 }}
                  onClick={() => setPlanEnCheckout(plan)}
                >
                  {esActual ? 'Plan actual' : esGratis ? 'Plan de entrada' : 'Mejorar'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      {!puedeGestionar && (
        <Alert severity="info" variant="outlined">
          Solo el propietario o un administrador del negocio puede cambiar el plan.
        </Alert>
      )}

      {planEnCheckout && (
        <CheckoutModal plan={planEnCheckout} onClose={() => setPlanEnCheckout(null)} onHecho={alHecho} />
      )}
    </Box>
  );
}
