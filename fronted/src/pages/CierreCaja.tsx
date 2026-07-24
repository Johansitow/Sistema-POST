import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid as Grid, Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, IconButton, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, FormControl,
  InputLabel, Chip, Tooltip, LinearProgress, Alert, Stack,
} from '@mui/material';
import {
  PointOfSale, Add, Edit, PlayArrow, Done, Close,
  CheckCircle, Warning, HourglassEmpty, AccessTime, ErrorOutline,
} from '@mui/icons-material';
import {
  cierreCajaService, turnoCajaService, type CierreCaja, type TurnoCaja,
} from '../services/servicios-operacion';
import { useRestauranteActivo } from '../store/restauranteStore';
import { colorEstado, definirEstado } from '../theme/estados';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// Los cuatro hex sueltos que había aquí (#f59e0b, #6366f1, #10b981, #ef4444)
// vienen ahora de theme/estados.ts, dominio 'caja'. Lo propio de esta pantalla
// es solo el ícono.
const ESTADO_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pendiente:      { ...definirEstado('pendiente',      'caja'), color: colorEstado('pendiente',      'caja'), icon: <HourglassEmpty fontSize="small" /> },
  en_proceso:     { ...definirEstado('en_proceso',     'caja'), color: colorEstado('en_proceso',     'caja'), icon: <AccessTime     fontSize="small" /> },
  completado:     { ...definirEstado('completado',     'caja'), color: colorEstado('completado',     'caja'), icon: <CheckCircle    fontSize="small" /> },
  con_diferencia: { ...definirEstado('con_diferencia', 'caja'), color: colorEstado('con_diferencia', 'caja'), icon: <Warning        fontSize="small" /> },
};

const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

function EstadoChip({ estado }: { estado: string }) {
  const cfg = ESTADO_CFG[estado] || { label: estado, color: colorEstado(undefined, 'caja'), icon: null };
  return (
    <Chip
      icon={cfg.icon as any} label={cfg.label} size="small"
      sx={{ bgcolor: cfg.color + '20', color: cfg.color, fontWeight: 700, '& .MuiChip-icon': { color: cfg.color } }}
    />
  );
}

// ─── Modal: Turno ─────────────────────────────────────────────────────────────

function TurnoModal({ open, turno, onClose, onSaved }: {
  open: boolean; turno: TurnoCaja | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ nombre: '', hora_apertura: '07:00', hora_cierre: '15:00', dias_semana: [] as number[] });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(turno
      ? { nombre: turno.nombre, hora_apertura: turno.hora_apertura, hora_cierre: turno.hora_cierre, dias_semana: turno.dias_semana || [] }
      : { nombre: '', hora_apertura: '07:00', hora_cierre: '15:00', dias_semana: [] }
    );
  }, [open, turno]);

  const toggleDia = (d: number) =>
    setForm(p => ({ ...p, dias_semana: p.dias_semana.includes(d) ? p.dias_semana.filter(x => x !== d) : [...p.dias_semana, d].sort() }));

  const handleSave = async () => {
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return; }
    setSaving(true);
    try {
      const payload = { ...form, dias_semana: form.dias_semana.length ? form.dias_semana : undefined };
      if (turno) await turnoCajaService.update(turno.id, payload);
      else       await turnoCajaService.create(payload as any);
      onSaved(); onClose();
    } catch (e: any) { setError(e.response?.data?.error || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {turno ? 'Editar turno' : 'Nuevo turno de caja'}
        <IconButton onClick={onClose}><Close /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2}>
          <TextField label="Nombre del turno *" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} fullWidth size="small" />
          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <TextField label="Hora apertura" type="time" value={form.hora_apertura} onChange={e => setForm(p => ({ ...p, hora_apertura: e.target.value }))} fullWidth size="small" InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField label="Hora cierre" type="time" value={form.hora_cierre} onChange={e => setForm(p => ({ ...p, hora_cierre: e.target.value }))} fullWidth size="small" InputLabelProps={{ shrink: true }} />
            </Grid>
          </Grid>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>DÍAS ACTIVOS (vacío = todos los días)</Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
              {DIAS.map((dia, idx) => (
                <Chip key={idx} label={dia} size="small" onClick={() => toggleDia(idx)}
                  color={form.dias_semana.includes(idx) ? 'primary' : 'default'}
                  variant={form.dias_semana.includes(idx) ? 'filled' : 'outlined'}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Modal: Iniciar Cierre ────────────────────────────────────────────────────

function IniciarModal({ open, turnos, onClose, onIniciado }: {
  open: boolean; turnos: TurnoCaja[]; onClose: () => void; onIniciado: () => void;
}) {
  const [form, setForm] = useState({ id_turno: '', fecha_apertura: new Date().toISOString().slice(0, 16), monto_inicial: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [ordenes, setOrdenes] = useState<any[]>([]);

  useEffect(() => { if (open) { setError(''); setOrdenes([]); } }, [open]);

  const handleIniciar = async () => {
    if (!form.monto_inicial) { setError('El monto inicial es requerido'); return; }
    setLoading(true); setError(''); setOrdenes([]);
    try {
      await cierreCajaService.iniciar({
        id_turno:      form.id_turno ? Number(form.id_turno) : undefined,
        fecha_apertura: new Date(form.fecha_apertura).toISOString(),
        monto_inicial:  Number(form.monto_inicial),
      });
      onIniciado(); onClose();
    } catch (e: any) {
      if (e.response?.status === 409) {
        setOrdenes(e.response.data.detalle || []);
        setError(e.response.data.error);
      } else {
        setError(e.response?.data?.error || 'Error al iniciar cierre');
      }
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Iniciar cierre de caja
        <IconButton onClick={onClose}><Close /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {ordenes.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2, borderColor: 'error.light', borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} color="error" sx={{ mb: 1 }}>
              <ErrorOutline fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
              Órdenes abiertas — ciérralas primero:
            </Typography>
            {ordenes.map((o: any) => (
              <Box key={o.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                <Typography variant="body2" fontWeight={600}>{o.numero_orden}</Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Chip label={o.estado?.nombre} size="small" variant="outlined" />
                  <Typography variant="body2">{fmt(o.total)}</Typography>
                </Box>
              </Box>
            ))}
          </Paper>
        )}
        <Stack spacing={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Turno (opcional)</InputLabel>
            <Select value={form.id_turno} label="Turno (opcional)" onChange={e => setForm(p => ({ ...p, id_turno: e.target.value }))}>
              <MenuItem value="">— Sin turno —</MenuItem>
              {turnos.map(t => <MenuItem key={t.id} value={t.id}>{t.nombre} ({t.hora_apertura} – {t.hora_cierre})</MenuItem>)}
            </Select>
          </FormControl>
          <TextField
            label="Fecha y hora de apertura del período" type="datetime-local" fullWidth size="small"
            value={form.fecha_apertura} onChange={e => setForm(p => ({ ...p, fecha_apertura: e.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Monto inicial en caja *" type="number" fullWidth size="small"
            value={form.monto_inicial} onChange={e => setForm(p => ({ ...p, monto_inicial: e.target.value }))}
            helperText="Efectivo físico con el que se abrió la caja"
            InputProps={{ startAdornment: <Typography sx={{ mr: 1, color: 'text.secondary' }}>$</Typography> }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleIniciar} disabled={loading}>
          {loading ? 'Verificando órdenes...' : 'Iniciar cierre'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Modal: Confirmar Cierre ──────────────────────────────────────────────────

function ConfirmarModal({ open, cierre, onClose, onConfirmado }: {
  open: boolean; cierre: CierreCaja | null; onClose: () => void; onConfirmado: () => void;
}) {
  const [form, setForm] = useState({ monto_final: '', justificacion: '', observaciones: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => { if (open) { setForm({ monto_final: '', justificacion: '', observaciones: '' }); setError(''); } }, [open]);

  if (!cierre) return null;

  const diferencia           = form.monto_final ? Number(form.monto_final) - cierre.total_ventas : 0;
  const requiereJustificacion = Math.abs(diferencia) > 5000;

  const handleConfirmar = async () => {
    if (!form.monto_final) { setError('El monto final es requerido'); return; }
    if (requiereJustificacion && !form.justificacion.trim()) { setError('Se requiere justificación por la diferencia detectada'); return; }
    setSaving(true);
    try {
      await cierreCajaService.confirmar(cierre.id, {
        monto_final:   Number(form.monto_final),
        justificacion: form.justificacion || undefined,
        observaciones: form.observaciones || undefined,
      });
      onConfirmado(); onClose();
    } catch (e: any) { setError(e.response?.data?.error || 'Error al confirmar'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Confirmar cierre — {cierre.numero_cierre}
        <IconButton onClick={onClose}><Close /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Resumen del sistema */}
        <Paper sx={{ p: 2, mb: 2.5, bgcolor: 'grey.50', borderRadius: 2 }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary">TOTALES REGISTRADOS EN EL SISTEMA</Typography>
          <Grid container spacing={0.5} sx={{ mt: 1 }}>
            <Grid size={{ xs: 7 }}><Typography variant="body2" color="text.secondary">Total ventas del período</Typography></Grid>
            <Grid size={{ xs: 5 }}><Typography variant="body2" fontWeight={800} textAlign="right">{fmt(cierre.total_ventas)}</Typography></Grid>
            {cierre.totales_por_metodo && Object.entries(cierre.totales_por_metodo).map(([m, v]) => (
              <>
                <Grid size={{ xs: 7 }} key={m + 'l'}><Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>↳ {m}</Typography></Grid>
                <Grid size={{ xs: 5 }} key={m + 'v'}><Typography variant="body2" textAlign="right">{fmt(v as number)}</Typography></Grid>
              </>
            ))}
          </Grid>
        </Paper>

        <Stack spacing={2}>
          <TextField
            label="Monto físico en caja al cerrar *" type="number" fullWidth size="small"
            value={form.monto_final} onChange={e => setForm(p => ({ ...p, monto_final: e.target.value }))}
            InputProps={{ startAdornment: <Typography sx={{ mr: 1, color: 'text.secondary' }}>$</Typography> }}
          />

          {/* Diferencia en tiempo real */}
          {form.monto_final && (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: requiereJustificacion ? 'error.main' : 'success.main' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" fontWeight={600}>Diferencia</Typography>
                <Typography variant="h6" fontWeight={800} color={diferencia === 0 ? 'success.main' : diferencia > 0 ? 'info.main' : 'error.main'}>
                  {diferencia >= 0 ? '+' : ''}{fmt(diferencia)}
                </Typography>
              </Box>
              {diferencia !== 0 && (
                <Typography variant="caption" color="text.secondary">
                  {diferencia > 0 ? '↑ Sobrante en caja' : '↓ Faltante en caja'}
                  {requiereJustificacion ? ' — requiere justificación' : ''}
                </Typography>
              )}
            </Paper>
          )}

          {requiereJustificacion && (
            <TextField
              label="Justificación de la diferencia *" multiline rows={3} fullWidth size="small"
              value={form.justificacion} onChange={e => setForm(p => ({ ...p, justificacion: e.target.value }))}
              error={!form.justificacion.trim()}
              helperText="Obligatorio cuando la diferencia supera $5.000"
            />
          )}
          <TextField
            label="Observaciones (opcional)" multiline rows={2} fullWidth size="small"
            value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" color="success" startIcon={<Done />} onClick={handleConfirmar} disabled={saving}>
          {saving ? 'Confirmando...' : 'Confirmar cierre'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function CierreCaja() {
  const idRestaurante               = useRestauranteActivo();
  const [turnos, setTurnos]         = useState<TurnoCaja[]>([]);
  const [cierres, setCierres]       = useState<CierreCaja[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modalTurno, setModalTurno] = useState(false);
  const [turnoEdit, setTurnoEdit]   = useState<TurnoCaja | null>(null);
  const [modalInic, setModalInic]   = useState(false);
  const [modalConf, setModalConf]   = useState(false);
  const [cierreConf, setCierreConf] = useState<CierreCaja | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, c] = await Promise.all([
        turnoCajaService.getAll(),
        cierreCajaService.getAll({ limit: 30, id_restaurante: idRestaurante }),
      ]);
      setTurnos(t);
      setCierres(c.data);
    } finally { setLoading(false); }
  }, [idRestaurante]);

  useEffect(() => { load(); }, [load]);

  const enProceso = cierres.find(c => c.estado === 'en_proceso');

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ p: 1.5, borderRadius: 2, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex' }}>
            <PointOfSale sx={{ color: 'white', fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={800}>Cierre de Caja</Typography>
            <Typography variant="body2" color="text.secondary">Gestión de turnos y cierres diarios</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {enProceso ? (
            <Button variant="contained" color="warning" startIcon={<Done />} onClick={() => { setCierreConf(enProceso); setModalConf(true); }}>
              Confirmar cierre activo
            </Button>
          ) : (
            <Button variant="contained" startIcon={<PlayArrow />} onClick={() => setModalInic(true)}>
              Iniciar cierre
            </Button>
          )}
        </Box>
      </Box>

      {enProceso && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          Hay un cierre en proceso ({enProceso.numero_cierre}). Confírmalo antes de continuar.
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Turnos */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'grey.50' }}>
              <Typography variant="subtitle1" fontWeight={700}>Turnos programados</Typography>
              <Button size="small" startIcon={<Add />} onClick={() => { setTurnoEdit(null); setModalTurno(true); }}>Nuevo</Button>
            </Box>
            {loading ? <LinearProgress /> : turnos.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <AccessTime sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
                <Typography color="text.secondary" variant="body2">No hay turnos configurados</Typography>
              </Box>
            ) : turnos.map(turno => (
              <Box key={turno.id} sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2" fontWeight={700}>{turno.nombre}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {turno.hora_apertura} – {turno.hora_cierre}
                    {turno.dias_semana?.length ? ` · ${turno.dias_semana.map((d: number) => DIAS[d]).join(', ')}` : ' · Todos los días'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                  <Chip label={turno.activo ? 'Activo' : 'Inactivo'} size="small" color={turno.activo ? 'success' : 'default'} />
                  <IconButton size="small" onClick={() => { setTurnoEdit(turno); setModalTurno(true); }}><Edit fontSize="small" /></IconButton>
                </Box>
              </Box>
            ))}
          </Paper>
        </Grid>

        {/* Historial */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'grey.50' }}>
              <Typography variant="subtitle1" fontWeight={700}>Historial de cierres</Typography>
            </Box>
            {loading ? <LinearProgress /> : (
              <TableContainer sx={{ maxHeight: 520 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Número</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Fecha cierre</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Total ventas</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Diferencia</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Estado</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cierres.map(c => (
                      <TableRow key={c.id} hover>
                        <TableCell><Typography variant="body2" fontFamily="monospace" fontWeight={700}>{c.numero_cierre}</Typography></TableCell>
                        <TableCell><Typography variant="body2">{new Date(c.fecha_cierre).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Typography></TableCell>
                        <TableCell><Typography variant="body2" fontWeight={700}>{fmt(c.total_ventas)}</Typography></TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={700} color={c.diferencia === 0 ? 'success.main' : c.diferencia > 0 ? 'info.main' : 'error.main'}>
                            {c.diferencia >= 0 ? '+' : ''}{fmt(c.diferencia)}
                          </Typography>
                        </TableCell>
                        <TableCell><EstadoChip estado={c.estado} /></TableCell>
                        <TableCell>
                          {c.estado === 'en_proceso' && (
                            <Tooltip title="Confirmar cierre">
                              <IconButton size="small" color="warning" onClick={() => { setCierreConf(c); setModalConf(true); }}>
                                <Done fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {cierres.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">No hay cierres registrados</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>
      </Grid>

      <TurnoModal open={modalTurno} turno={turnoEdit} onClose={() => setModalTurno(false)} onSaved={load} />
      <IniciarModal open={modalInic} turnos={turnos} onClose={() => setModalInic(false)} onIniciado={load} />
      <ConfirmarModal open={modalConf} cierre={cierreConf} onClose={() => setModalConf(false)} onConfirmado={load} />
    </Box>
  );
}

export default CierreCaja;
