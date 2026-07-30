/**
 * Nomina — módulo de liquidación (/admin/nomina).
 *
 * Dos vistas en una página: el listado de periodos y, al abrir uno, su
 * detalle con prenómina, novedades y resultados.
 *
 * El flujo que impone la UI es el mismo que impone el backend:
 *   borrador → (prenómina en verde) → liquidar → aprobar (otra persona) → pagar
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, AlertTitle, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl,
  IconButton, InputAdornment, InputLabel, MenuItem, Paper, Select, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tab, Tabs,
  TextField, Tooltip, Typography,
} from '@mui/material';
import {
  Add, ArrowBack, Calculate, CheckCircle, Delete, Gavel, Paid,
  PlaylistAddCheck, Refresh, Undo, Warning,
} from '@mui/icons-material';
import {
  nominaService, ESTADO_PERIODO_COLOR, ESTADO_PERIODO_LABEL, TIPO_NOVEDAD_LABEL,
  NOVEDADES_POR_HORA, NOVEDADES_POR_DIA, NOVEDADES_POR_VALOR,
  type PeriodoNomina, type Prenomina, type NovedadNomina, type DetalleNomina,
  type CostoLaboral, type TipoNovedad,
} from '../../services/nomina.service';
import { usuariosService } from '../../services/usuarios.service';
import { restaurantesService, type Restaurante } from '../../services/restaurantes.service';
import { useUIStore } from '../../store/uiStore';
import { LoadingScreen, EmptyState, ConfirmDialog, PageHeader } from '../../components/common';
import { formatCurrency, formatDateShort } from '../../utils/format';
import type { Usuario } from '../../types';

const num = (v: string | number) => Number(v);

const mensajeError = (err: unknown, fallback: string) => {
  const d = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return d?.error ?? d?.message ?? fallback;
};

// ─── Diálogo: nuevo periodo ───────────────────────────────────────────────────

function NuevoPeriodoDialog({ open, sedes, onClose, onCreado }: {
  open: boolean; sedes: Restaurante[];
  onClose: () => void; onCreado: (p: PeriodoNomina) => void;
}) {
  const [nombre, setNombre]   = useState('');
  const [tipo, setTipo]       = useState('mensual');
  const [inicio, setInicio]   = useState('');
  const [fin, setFin]         = useState('');
  const [sede, setSede]       = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!open) return;
    const hoy = new Date();
    const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const f   = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    setInicio(iso(ini));
    setFin(iso(f));
    setNombre(ini.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
      .replace(/^\w/, c => c.toUpperCase()));
    setSede('');
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleCrear = async () => {
    setGuardando(true);
    setError('');
    try {
      // El backend deriva el grupo de la sede elegida; el frontend no
      // necesita conocer los ids de grupo.
      const periodo = await nominaService.crearPeriodo({
        nombre, tipo_periodo: tipo, fecha_inicio: inicio, fecha_fin: fin,
        id_restaurante: sede ? Number(sede) : null,
      });
      onCreado(periodo);
      onClose();
    } catch (err) {
      setError(mensajeError(err, 'No se pudo crear el periodo'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={700}>Nuevo periodo de nómina</DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2}>
          <TextField fullWidth label="Nombre del periodo" value={nombre}
            onChange={e => setNombre(e.target.value)} placeholder="ej. Julio 2026" />
          <FormControl fullWidth>
            <InputLabel>Frecuencia</InputLabel>
            <Select value={tipo} label="Frecuencia" onChange={e => setTipo(e.target.value)}>
              <MenuItem value="mensual">Mensual</MenuItem>
              <MenuItem value="quincenal">Quincenal</MenuItem>
              <MenuItem value="semanal">Semanal</MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField fullWidth type="date" label="Desde" value={inicio}
              onChange={e => setInicio(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField fullWidth type="date" label="Hasta" value={fin}
              onChange={e => setFin(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Box>
          <FormControl fullWidth>
            <InputLabel>Sede</InputLabel>
            <Select value={sede} label="Sede" onChange={e => setSede(e.target.value)}>
              <MenuItem value="">Todas las sedes del grupo</MenuItem>
              {sedes.map(s => <MenuItem key={s.id} value={String(s.id)}>{s.nombre}</MenuItem>)}
            </Select>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              Se liquidan los empleados cuya sede de nómina sea la elegida.
            </Typography>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={guardando}>Cancelar</Button>
        <Button variant="contained" onClick={handleCrear}
          disabled={guardando || !nombre || !inicio || !fin}>
          {guardando ? <CircularProgress size={20} /> : 'Crear periodo'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Diálogo: nueva novedad ───────────────────────────────────────────────────

function NuevaNovedadDialog({ open, idPeriodo, empleados, onClose, onCreada }: {
  open: boolean; idPeriodo: number; empleados: Usuario[];
  onClose: () => void; onCreada: () => void;
}) {
  const [empleado, setEmpleado] = useState('');
  const [tipo, setTipo]         = useState<TipoNovedad>('hora_extra_diurna');
  const [cantidad, setCantidad] = useState('');
  const [valor, setValor]       = useState('');
  const [obs, setObs]           = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (open) { setEmpleado(''); setCantidad(''); setValor(''); setObs(''); setError(''); }
  }, [open]);

  const porHora  = NOVEDADES_POR_HORA.includes(tipo);
  const porDia   = NOVEDADES_POR_DIA.includes(tipo);
  const porValor = NOVEDADES_POR_VALOR.includes(tipo);

  const handleCrear = async () => {
    setGuardando(true);
    setError('');
    try {
      await nominaService.crearNovedad(idPeriodo, {
        id_empleado: Number(empleado),
        tipo,
        cantidad: porValor ? undefined : Number(cantidad) || 0,
        valor:    porValor ? Number(valor) || 0 : undefined,
        observaciones: obs || undefined,
      });
      onCreada();
      onClose();
    } catch (err) {
      setError(mensajeError(err, 'No se pudo registrar la novedad'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={700}>Registrar novedad</DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2}>
          <FormControl fullWidth>
            <InputLabel>Empleado</InputLabel>
            <Select value={empleado} label="Empleado" onChange={e => setEmpleado(e.target.value)}>
              {empleados.map(e => (
                <MenuItem key={e.id} value={String(e.id)}>
                  {e.nombre_completo}{e.cargo ? ` — ${e.cargo}` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Tipo de novedad</InputLabel>
            <Select value={tipo} label="Tipo de novedad"
              onChange={e => setTipo(e.target.value as TipoNovedad)}>
              {(Object.keys(TIPO_NOVEDAD_LABEL) as TipoNovedad[]).map(t => (
                <MenuItem key={t} value={t}>{TIPO_NOVEDAD_LABEL[t]}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {porValor ? (
            <TextField
              fullWidth type="number" label="Valor" value={valor}
              onChange={e => setValor(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            />
          ) : (
            <TextField
              fullWidth type="number"
              label={porHora ? 'Cantidad de horas' : porDia ? 'Cantidad de días' : 'Cantidad'}
              value={cantidad} onChange={e => setCantidad(e.target.value)}
              helperText={porHora
                ? 'Los recargos pagan solo el porcentaje adicional; las extras pagan la hora completa más el recargo.'
                : 'Los días se descuentan del salario ordinario del periodo.'}
            />
          )}

          <TextField fullWidth label="Observaciones" value={obs}
            onChange={e => setObs(e.target.value)} multiline rows={2} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={guardando}>Cancelar</Button>
        <Button variant="contained" onClick={handleCrear}
          disabled={guardando || !empleado || (porValor ? !valor : !cantidad)}>
          {guardando ? <CircularProgress size={20} /> : 'Registrar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Detalle de un periodo ────────────────────────────────────────────────────

function DetallePeriodo({ periodo, onVolver, onCambio }: {
  periodo: PeriodoNomina; onVolver: () => void; onCambio: () => void;
}) {
  const { showToast } = useUIStore();
  const [tab, setTab]             = useState(0);
  const [pre, setPre]             = useState<Prenomina | null>(null);
  const [novedades, setNovedades] = useState<NovedadNomina[]>([]);
  const [detalles, setDetalles]   = useState<DetalleNomina[]>([]);
  const [costo, setCosto]         = useState<CostoLaboral | null>(null);
  const [empleados, setEmpleados] = useState<Usuario[]>([]);
  const [cargando, setCargando]   = useState(true);
  const [accion, setAccion]       = useState('');
  const [novedadOpen, setNovedadOpen] = useState(false);
  const [confirmar, setConfirmar] = useState<null | 'aprobar' | 'pagar' | 'reabrir'>(null);

  const editable = periodo.estado === 'borrador' || periodo.estado === 'en_revision';

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [p, n, d] = await Promise.all([
        nominaService.prenomina(periodo.id).catch(() => null),
        nominaService.listarNovedades(periodo.id).catch(() => []),
        nominaService.listarDetalles(periodo.id).catch(() => []),
      ]);
      setPre(p); setNovedades(n); setDetalles(d);
      nominaService.costoLaboral(periodo.id).then(setCosto).catch(() => setCosto(null));
      usuariosService.listar({ limit: 200, estado: 'activo' })
        .then(r => setEmpleados(r.data as Usuario[])).catch(() => setEmpleados([]));
    } finally {
      setCargando(false);
    }
  }, [periodo.id]);

  useEffect(() => { cargar(); }, [cargar]);

  const ejecutar = async (nombre: string, fn: () => Promise<unknown>, exito: string) => {
    setAccion(nombre);
    try {
      await fn();
      showToast(exito, 'success');
      onCambio();
      await cargar();
    } catch (err) {
      showToast(mensajeError(err, 'La operación falló'), 'error');
    } finally {
      setAccion('');
    }
  };

  if (cargando) return <LoadingScreen />;

  const bloqueantes  = pre?.excepciones.filter(x => x.severidad === 'bloqueante') ?? [];
  const advertencias = pre?.excepciones.filter(x => x.severidad === 'advertencia') ?? [];

  return (
    <Box>
      <Button startIcon={<ArrowBack />} size="small" onClick={onVolver} sx={{ mb: 2 }}>
        Volver a periodos
      </Button>

      {/* Cabecera */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}
          justifyContent="space-between" alignItems={{ md: 'center' }}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="h5" fontWeight={700}>{periodo.nombre}</Typography>
              <Chip label={ESTADO_PERIODO_LABEL[periodo.estado]}
                color={ESTADO_PERIODO_COLOR[periodo.estado]} size="small" sx={{ fontWeight: 700 }} />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {formatDateShort(periodo.fecha_inicio)} — {formatDateShort(periodo.fecha_fin)}
              {periodo.restaurante ? ` · ${periodo.restaurante.nombre}` : ' · Todas las sedes'}
            </Typography>
            {periodo.liquidado_por && (
              <Typography variant="caption" color="text.secondary" display="block">
                Liquidado por {periodo.liquidado_por.nombre_completo}
                {periodo.aprobado_por && ` · Aprobado por ${periodo.aprobado_por.nombre_completo}`}
              </Typography>
            )}
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {editable && (
              <Button
                variant="contained" startIcon={accion === 'liquidar' ? <CircularProgress size={16} color="inherit" /> : <Calculate />}
                disabled={!!accion || !pre?.puede_liquidar}
                onClick={() => ejecutar('liquidar',
                  () => nominaService.liquidar(periodo.id),
                  'Periodo liquidado')}
              >
                {periodo.estado === 'en_revision' ? 'Reliquidar' : 'Liquidar'}
              </Button>
            )}
            {periodo.estado === 'en_revision' && (
              <>
                <Button variant="contained" color="success" startIcon={<Gavel />}
                  disabled={!!accion} onClick={() => setConfirmar('aprobar')}>
                  Aprobar
                </Button>
                <Button variant="outlined" startIcon={<Undo />}
                  disabled={!!accion} onClick={() => setConfirmar('reabrir')}>
                  Reabrir
                </Button>
              </>
            )}
            {periodo.estado === 'aprobada' && (
              <Button variant="contained" color="primary" startIcon={<Paid />}
                disabled={!!accion} onClick={() => setConfirmar('pagar')}>
                Marcar como pagada
              </Button>
            )}
            <Tooltip title="Actualizar">
              <IconButton onClick={cargar}><Refresh /></IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {/* Totales */}
        {periodo.empleados_liquidados > 0 && (
          <Box sx={{ display: 'flex', gap: 2, mt: 3, flexWrap: 'wrap' }}>
            {[
              { label: 'Empleados',   valor: String(periodo.empleados_liquidados), color: 'text.primary' },
              { label: 'Devengado',   valor: formatCurrency(num(periodo.total_devengado)), color: 'text.primary' },
              { label: 'Deducciones', valor: formatCurrency(num(periodo.total_deducciones)), color: 'warning.main' },
              { label: 'Neto a pagar', valor: formatCurrency(num(periodo.total_neto)), color: 'success.main' },
              { label: 'Costo empresa',
                valor: formatCurrency(num(periodo.total_devengado) + num(periodo.total_aportes_empleador) + num(periodo.total_provisiones)),
                color: 'error.main' },
            ].map(t => (
              <Card variant="outlined" key={t.label} sx={{ flex: '1 1 170px' }}>
                <CardContent sx={{ py: '12px !important' }}>
                  <Typography variant="caption" color="text.secondary">{t.label}</Typography>
                  <Typography variant="h6" fontWeight={800} sx={{ color: t.color }}>{t.valor}</Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </Paper>

      {/* Avisos de la prenómina */}
      {pre && !pre.parametros_verificados && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>Parámetros legales sin verificar</AlertTitle>
          Los valores de {pre.anio_parametros} (salario mínimo, auxilio de transporte, UVT)
          no han sido confirmados. El sistema no liquidará hasta que se verifiquen:
          hacerlo con cifras del año anterior afectaría a toda la nómina.
        </Alert>
      )}
      {bloqueantes.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>{bloqueantes.length} empleado(s) no se pueden liquidar</AlertTitle>
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            {bloqueantes.map((x, i) => (
              <Typography key={i} variant="body2">
                <strong>{x.empleado}:</strong> {x.mensaje}
              </Typography>
            ))}
          </Stack>
        </Alert>
      )}
      {advertencias.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }} icon={<Warning />}>
          <AlertTitle>{advertencias.length} advertencia(s)</AlertTitle>
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            {advertencias.map((x, i) => (
              <Typography key={i} variant="body2">
                <strong>{x.empleado}:</strong> {x.mensaje}
              </Typography>
            ))}
          </Stack>
        </Alert>
      )}
      {pre && pre.excepciones.length === 0 && pre.parametros_verificados && editable && (
        <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircle />}>
          Prenómina en verde: {pre.liquidables} empleado(s) listos para liquidar.
        </Alert>
      )}

      {/* Pestañas */}
      <Paper variant="outlined">
        <Tabs value={tab} onChange={(_, v) => setTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab label={`Novedades (${novedades.length})`} />
          <Tab label={`Liquidación (${detalles.length})`} />
          <Tab label="Costo laboral" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* ── Novedades ── */}
          {tab === 0 && (
            <Box>
              {editable && (
                <Button variant="outlined" startIcon={<Add />} sx={{ mb: 2 }}
                  onClick={() => setNovedadOpen(true)}>
                  Registrar novedad
                </Button>
              )}
              {novedades.length === 0 ? (
                <EmptyState
                  message="Sin novedades"
                  description="Horas extra, incapacidades, préstamos y bonificaciones del periodo se registran aquí."
                />
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Empleado</TableCell>
                        <TableCell>Novedad</TableCell>
                        <TableCell align="right">Cantidad</TableCell>
                        <TableCell align="right">Valor</TableCell>
                        <TableCell>Observaciones</TableCell>
                        {editable && <TableCell align="center">—</TableCell>}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {novedades.map(n => (
                        <TableRow key={n.id} hover>
                          <TableCell>{n.empleado.nombre_completo}</TableCell>
                          <TableCell>{TIPO_NOVEDAD_LABEL[n.tipo]}</TableCell>
                          <TableCell align="right">{num(n.cantidad) || '—'}</TableCell>
                          <TableCell align="right">
                            {num(n.valor) ? formatCurrency(num(n.valor)) : '—'}
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">{n.observaciones || '—'}</Typography>
                          </TableCell>
                          {editable && (
                            <TableCell align="center">
                              <IconButton size="small" color="error"
                                onClick={() => ejecutar('novedad',
                                  () => nominaService.eliminarNovedad(periodo.id, n.id),
                                  'Novedad eliminada')}>
                                <Delete fontSize="small" />
                              </IconButton>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}

          {/* ── Liquidación ── */}
          {tab === 1 && (
            detalles.length === 0 ? (
              <EmptyState
                message="Sin liquidar"
                description="Pulsa «Liquidar» para calcular la nómina del periodo."
              />
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Empleado</TableCell>
                      <TableCell align="right">Días</TableCell>
                      <TableCell align="right">IBC</TableCell>
                      <TableCell align="right">Devengado</TableCell>
                      <TableCell align="right">Deducciones</TableCell>
                      <TableCell align="right">Neto</TableCell>
                      <TableCell align="right">Costo empresa</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detalles.map(d => (
                      <TableRow key={d.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {d.empleado.nombre_completo}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {d.empleado.codigo_empleado ?? ''} {d.empleado.cargo ?? ''}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{num(d.dias_trabajados)}</TableCell>
                        <TableCell align="right">{formatCurrency(num(d.ibc))}</TableCell>
                        <TableCell align="right">{formatCurrency(num(d.total_devengado))}</TableCell>
                        <TableCell align="right" sx={{ color: 'warning.main' }}>
                          {formatCurrency(num(d.total_deducciones))}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={700} color="success.main">
                            {formatCurrency(num(d.neto_pagar))}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="caption" color="text.secondary">
                            {formatCurrency(
                              num(d.total_devengado) + num(d.aportes_empleador) + num(d.provisiones),
                            )}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Alert severity="info" sx={{ mt: 2 }}>
                  El desprendible de pago de cada empleado se emite desde su ficha,
                  en la pestaña <strong>Documentos</strong>, una vez la nómina esté aprobada.
                </Alert>
              </TableContainer>
            )
          )}

          {/* ── Costo laboral ── */}
          {tab === 2 && (
            !costo ? (
              <EmptyState message="Sin datos" description="Liquida el periodo para ver el costo laboral." />
            ) : (
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <Card variant="outlined" sx={{ flex: '1 1 300px' }}>
                  <CardContent>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
                      Costo laboral sobre ventas
                    </Typography>
                    {costo.porcentaje === null ? (
                      <Alert severity="info">
                        No hay ventas registradas en este rango de fechas, así que el
                        porcentaje no se puede calcular.
                      </Alert>
                    ) : (
                      <>
                        <Typography variant="h3" fontWeight={800}
                          color={costo.porcentaje > 35 ? 'error.main'
                            : costo.porcentaje > 32 ? 'warning.main' : 'success.main'}>
                          {costo.porcentaje.toFixed(1)} %
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          En restaurantes se considera sano entre 25 % y 32 %.
                        </Typography>
                      </>
                    )}
                    <Divider sx={{ my: 2 }} />
                    <Stack spacing={1}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Ventas del periodo</Typography>
                        <Typography variant="body2" fontWeight={600}>{formatCurrency(costo.ventas)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Costo total de nómina</Typography>
                        <Typography variant="body2" fontWeight={600}>{formatCurrency(costo.costo_total)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Venta por empleado</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {formatCurrency(costo.venta_por_empleado)}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ flex: '1 1 300px' }}>
                  <CardContent>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                      Por qué importa
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Esta cifra solo se puede calcular porque la nómina vive dentro
                      del POS: cruza el costo laboral real —incluyendo aportes y
                      provisiones— con las ventas del mismo rango de fechas. Un
                      software de nómina aparte no conoce tus ventas.
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            )
          )}
        </Box>
      </Paper>

      <NuevaNovedadDialog
        open={novedadOpen} idPeriodo={periodo.id} empleados={empleados}
        onClose={() => setNovedadOpen(false)}
        onCreada={() => { showToast('Novedad registrada', 'success'); cargar(); }}
      />

      <ConfirmDialog
        open={confirmar === 'aprobar'}
        title="Aprobar la nómina"
        message={`Se aprobará el pago de ${formatCurrency(num(periodo.total_neto))} a ${periodo.empleados_liquidados} empleado(s). Una vez aprobada ya no se puede reliquidar: las correcciones se hacen con un periodo de ajuste.`}
        confirmText="Aprobar" confirmColor="success"
        onConfirm={() => ejecutar('aprobar', () => nominaService.aprobar(periodo.id), 'Periodo aprobado')}
        onClose={() => setConfirmar(null)}
      />
      <ConfirmDialog
        open={confirmar === 'pagar'}
        title="Marcar como pagada"
        message="Confirma que la dispersión bancaria ya se realizó. El periodo quedará cerrado."
        confirmText="Marcar pagada"
        onConfirm={() => ejecutar('pagar', () => nominaService.marcarPagado(periodo.id), 'Periodo marcado como pagado')}
        onClose={() => setConfirmar(null)}
      />
      <ConfirmDialog
        open={confirmar === 'reabrir'}
        title="Reabrir el periodo"
        message="Volverá a borrador para corregir novedades. Habrá que liquidarlo de nuevo."
        confirmText="Reabrir"
        onConfirm={() => ejecutar('reabrir', () => nominaService.reabrir(periodo.id), 'Periodo reabierto')}
        onClose={() => setConfirmar(null)}
      />
    </Box>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function Nomina() {
  const { showToast } = useUIStore();
  const [periodos, setPeriodos] = useState<PeriodoNomina[]>([]);
  const [sedes, setSedes]       = useState<Restaurante[]>([]);
  const [seleccionado, setSeleccionado] = useState<PeriodoNomina | null>(null);
  const [cargando, setCargando] = useState(true);
  const [nuevoOpen, setNuevoOpen] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [p, s] = await Promise.all([
        nominaService.listarPeriodos(),
        restaurantesService.listar().catch(() => []),
      ]);
      setPeriodos(p);
      setSedes(s);
      // Refresca el periodo abierto para reflejar su nuevo estado
      setSeleccionado(prev => prev ? p.find(x => x.id === prev.id) ?? null : null);
    } catch {
      showToast('No se pudieron cargar los periodos', 'error');
    } finally {
      setCargando(false);
    }
  }, [showToast]);

  useEffect(() => { cargar(); }, [cargar]);

  if (cargando && periodos.length === 0) return <LoadingScreen />;

  if (seleccionado) {
    return (
      <DetallePeriodo
        periodo={seleccionado}
        onVolver={() => setSeleccionado(null)}
        onCambio={cargar}
      />
    );
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <PageHeader title="Nómina" subtitle="Liquidación de periodos, novedades y costo laboral" />
        <Button variant="contained" startIcon={<Add />} onClick={() => setNuevoOpen(true)}>
          Nuevo periodo
        </Button>
      </Stack>

      {periodos.length === 0 ? (
        <EmptyState
          message="Sin periodos de nómina"
          description="Crea el primer periodo para liquidar la nómina de tus empleados."
          actionLabel="Nuevo periodo"
          onAction={() => setNuevoOpen(true)}
        />
      ) : (
        <Paper variant="outlined">
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Periodo</TableCell>
                  <TableCell>Fechas</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Empleados</TableCell>
                  <TableCell align="right">Neto a pagar</TableCell>
                  <TableCell align="center">—</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {periodos.map(p => (
                  <TableRow key={p.id} hover sx={{ cursor: 'pointer' }}
                    onClick={() => setSeleccionado(p)}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{p.nombre}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {p.restaurante?.nombre ?? 'Todas las sedes'} · {p.tipo_periodo}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {formatDateShort(p.fecha_inicio)} — {formatDateShort(p.fecha_fin)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={ESTADO_PERIODO_LABEL[p.estado]}
                        color={ESTADO_PERIODO_COLOR[p.estado]} size="small" />
                    </TableCell>
                    <TableCell align="right">{p.empleados_liquidados || '—'}</TableCell>
                    <TableCell align="right">
                      {num(p.total_neto) > 0 ? formatCurrency(num(p.total_neto)) : '—'}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Abrir periodo">
                        <IconButton size="small" color="primary">
                          <PlaylistAddCheck fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <NuevoPeriodoDialog
        open={nuevoOpen} sedes={sedes}
        onClose={() => setNuevoOpen(false)}
        onCreado={(p) => { showToast('Periodo creado', 'success'); cargar(); setSeleccionado(p); }}
      />
    </Box>
  );
}
