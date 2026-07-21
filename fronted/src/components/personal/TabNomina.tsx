/**
 * TabNomina — salario vigente, datos bancarios e historial de cambios.
 *
 * El historial no se edita: lo escribe el backend automáticamente al guardar
 * la nómina (y solo cuando cambia el salario o la frecuencia de pago).
 */

import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  FormControl, InputAdornment, InputLabel, MenuItem, Select, Stack, Table,
  TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { Save, TrendingDown, TrendingFlat, TrendingUp } from '@mui/icons-material';
import type { NominaEmpleado, NominaDto, HistorialSalario } from '../../types';
import { formatCurrency } from '../../utils/format';
import { EmptyState } from '../common';

const TIPO_PAGO_LABEL: Record<NominaDto['tipo_pago'], string> = {
  mensual:   'Mensual',
  quincenal: 'Quincenal',
  semanal:   'Semanal',
};

interface TabNominaProps {
  nomina:      NominaEmpleado | null;
  historial:   HistorialSalario[];
  soloLectura: boolean;
  onGuardar:   (dto: NominaDto) => Promise<void>;
}

export function TabNomina({ nomina, historial, soloLectura, onGuardar }: TabNominaProps) {
  const [salario, setSalario]           = useState('');
  const [tipoPago, setTipoPago]         = useState<NominaDto['tipo_pago']>('mensual');
  const [banco, setBanco]               = useState('');
  const [tipoCuenta, setTipoCuenta]     = useState('');
  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [motivo, setMotivo]             = useState('');
  const [vigencia, setVigencia]         = useState('');
  const [guardando, setGuardando]       = useState(false);
  const [error, setError]               = useState('');

  useEffect(() => {
    setSalario(nomina ? String(nomina.salario_base) : '');
    setTipoPago(nomina?.tipo_pago ?? 'mensual');
    setBanco(nomina?.banco ?? '');
    setTipoCuenta(nomina?.tipo_cuenta ?? '');
    setNumeroCuenta(nomina?.numero_cuenta ?? '');
    setObservaciones(nomina?.observaciones ?? '');
    setMotivo('');
    setVigencia('');
    setError('');
  }, [nomina]);

  // El motivo solo se pide cuando de verdad va a generar una fila de historial
  const salarioNum   = parseFloat(salario);
  const cambiaSueldo = !!salario && (
    !nomina || Number(nomina.salario_base) !== salarioNum || nomina.tipo_pago !== tipoPago
  );

  const handleGuardar = async () => {
    if (!salario || isNaN(salarioNum) || salarioNum < 0) {
      setError('Ingresa un salario base válido.');
      return;
    }
    setGuardando(true);
    try {
      await onGuardar({
        salario_base:  salarioNum,
        tipo_pago:     tipoPago,
        banco:         banco || undefined,
        tipo_cuenta:   (tipoCuenta as NominaDto['tipo_cuenta']) || undefined,
        numero_cuenta: numeroCuenta || undefined,
        observaciones: observaciones || undefined,
        motivo:        cambiaSueldo && motivo ? motivo : undefined,
        vigencia_desde: cambiaSueldo && vigencia ? vigencia : undefined,
      });
      setMotivo('');
      setVigencia('');
    } catch (err) {
      const data = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
      setError(data?.error ?? data?.message ?? 'No se pudo guardar la nómina.');
    } finally {
      setGuardando(false);
    }
  };

  const iconoTendencia = (h: HistorialSalario) => {
    if (h.salario_anterior === null) return <TrendingFlat fontSize="small" color="disabled" />;
    if (h.salario_nuevo > h.salario_anterior) return <TrendingUp fontSize="small" color="success" />;
    if (h.salario_nuevo < h.salario_anterior) return <TrendingDown fontSize="small" color="error" />;
    return <TrendingFlat fontSize="small" color="disabled" />;
  };

  return (
    <Box>
      {soloLectura && (
        <Alert severity="info" sx={{ mb: 2 }}>
          La nómina del super administrador no se puede modificar.
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Card variant="outlined" sx={{ flex: '1 1 380px' }}>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
              Salario vigente
            </Typography>

            <Box sx={{
              opacity: soloLectura ? 0.6 : 1,
              pointerEvents: soloLectura ? 'none' : 'auto',
            }}>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                  <TextField
                    fullWidth label="Salario base" type="number"
                    value={salario} onChange={e => { setSalario(e.target.value); setError(''); }}
                    InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                    helperText="Valor bruto en COP"
                  />
                  <FormControl fullWidth>
                    <InputLabel>Frecuencia de pago</InputLabel>
                    <Select value={tipoPago} label="Frecuencia de pago"
                      onChange={e => setTipoPago(e.target.value as NominaDto['tipo_pago'])}>
                      {(Object.keys(TIPO_PAGO_LABEL) as NominaDto['tipo_pago'][]).map(k => (
                        <MenuItem key={k} value={k}>{TIPO_PAGO_LABEL[k]}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                {cambiaSueldo && nomina && (
                  <Alert severity="info" sx={{ py: 0.5 }}>
                    Este cambio quedará registrado en el historial salarial.
                  </Alert>
                )}

                {cambiaSueldo && (
                  <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <TextField
                      fullWidth label="Motivo del cambio" placeholder="ej. Ascenso, ajuste anual"
                      value={motivo} onChange={e => setMotivo(e.target.value)}
                    />
                    <TextField
                      fullWidth label="Vigente desde" type="date"
                      value={vigencia} onChange={e => setVigencia(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      helperText="Por defecto, hoy"
                    />
                  </Box>
                )}

                <Divider />
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  INFORMACIÓN BANCARIA
                </Typography>

                <TextField fullWidth label="Banco" placeholder="ej. Bancolombia, Davivienda, Nequi"
                  value={banco} onChange={e => setBanco(e.target.value)} />
                <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                  <FormControl fullWidth>
                    <InputLabel>Tipo de cuenta</InputLabel>
                    <Select value={tipoCuenta} label="Tipo de cuenta"
                      onChange={e => setTipoCuenta(e.target.value)}>
                      <MenuItem value="">Sin especificar</MenuItem>
                      <MenuItem value="ahorros">Ahorros</MenuItem>
                      <MenuItem value="corriente">Corriente</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField fullWidth label="Número de cuenta"
                    value={numeroCuenta} onChange={e => setNumeroCuenta(e.target.value)} />
                </Box>
                <TextField fullWidth label="Observaciones" multiline rows={2}
                  value={observaciones} onChange={e => setObservaciones(e.target.value)} />
              </Stack>
            </Box>

            {!soloLectura && (
              <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  startIcon={guardando ? <CircularProgress size={16} color="inherit" /> : <Save />}
                  onClick={handleGuardar} disabled={guardando}
                >
                  Guardar nómina
                </Button>
              </Stack>
            )}
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ flex: '1 1 420px' }}>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Historial salarial
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
              Se registra automáticamente cada vez que cambia el salario o la frecuencia.
            </Typography>

            {historial.length === 0 ? (
              <EmptyState
                message="Sin cambios registrados"
                description="Al guardar el primer salario se creará el registro inicial."
              />
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Vigencia</TableCell>
                    <TableCell>Cambio</TableCell>
                    <TableCell>Motivo</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {historial.map(h => (
                    <TableRow key={h.id} hover>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(h.vigencia_desde).toLocaleDateString('es-CO')}
                        </Typography>
                        {h.registrado_por && (
                          <Typography variant="caption" color="text.secondary">
                            por {h.registrado_por.nombre_completo}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          {iconoTendencia(h)}
                          <Box>
                            {h.salario_anterior !== null && (
                              <Typography variant="caption" color="text.secondary"
                                sx={{ textDecoration: 'line-through', display: 'block' }}>
                                {formatCurrency(Number(h.salario_anterior))}
                              </Typography>
                            )}
                            <Typography variant="body2" fontWeight={700}>
                              {formatCurrency(Number(h.salario_nuevo))}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{h.motivo || '—'}</Typography>
                        <Chip label={TIPO_PAGO_LABEL[h.tipo_pago]} size="small" variant="outlined"
                          sx={{ height: 18, fontSize: 10, mt: 0.5, display: 'flex', width: 'fit-content' }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
