/**
 * TabDatosEmpleado — formulario editable de la ficha (personal, laboral,
 * seguridad social, contacto de emergencia y notas internas).
 *
 * Guarda con un único PUT /usuarios/:id enviando SOLO los campos que cambiaron,
 * para no pisar datos que otro administrador haya tocado mientras tanto.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Divider,
  FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import { Save, Undo } from '@mui/icons-material';
import type {
  Usuario, UpdateUsuarioDto, EstadoLaboral, TipoContrato, Jornada, Turno,
  TipoDocumento, NivelRiesgoARL,
} from '../../types';
import type { Restaurante } from '../../services/restaurantes.service';
import {
  ESTADO_LABORAL_LABEL, TIPO_CONTRATO_LABEL, JORNADA_LABEL, TURNO_LABEL,
  TIPO_DOCUMENTO_LABEL, NIVEL_RIESGO_ARL_LABEL,
} from '../../utils/empleado';

/** Empleado con jefe/sede como ids planos, tal como los edita el formulario. */
interface FormState {
  // Personales
  tipo_documento:      TipoDocumento | '';
  documento_identidad: string;
  fecha_nacimiento:    string;
  direccion:           string;
  telefono:            string;
  // Laborales
  cargo:               string;
  fecha_ingreso:       string;
  turno:               Turno | '';
  tipo_contrato:       TipoContrato | '';
  jornada:             Jornada | '';
  estado_laboral:      EstadoLaboral;
  fecha_retiro:        string;
  motivo_retiro:       string;
  id_restaurante_base: string;   // '' = sin asignar
  id_jefe_directo:     string;
  // Seguridad social
  eps:                 string;
  afp:                 string;
  arl:                 string;
  nivel_riesgo_arl:    NivelRiesgoARL | '';
  fondo_cesantias:     string;
  caja_compensacion:   string;
  // Emergencia y notas
  contacto_emergencia_nombre:   string;
  contacto_emergencia_telefono: string;
  notas:               string;
}

const soloFecha = (v?: string | null) => (v ? v.substring(0, 10) : '');

const aFormState = (e: Usuario): FormState => ({
  tipo_documento:      e.tipo_documento ?? '',
  documento_identidad: e.documento_identidad ?? '',
  fecha_nacimiento:    soloFecha(e.fecha_nacimiento),
  direccion:           e.direccion ?? '',
  telefono:            e.telefono ?? '',
  cargo:               e.cargo ?? '',
  fecha_ingreso:       soloFecha(e.fecha_ingreso),
  turno:               e.turno ?? '',
  tipo_contrato:       e.tipo_contrato ?? '',
  jornada:             e.jornada ?? '',
  estado_laboral:      e.estado_laboral ?? 'activo',
  fecha_retiro:        soloFecha(e.fecha_retiro),
  motivo_retiro:       e.motivo_retiro ?? '',
  id_restaurante_base: e.id_restaurante_base ? String(e.id_restaurante_base) : '',
  id_jefe_directo:     e.id_jefe_directo ? String(e.id_jefe_directo) : '',
  eps:                 e.eps ?? '',
  afp:                 e.afp ?? '',
  arl:                 e.arl ?? '',
  nivel_riesgo_arl:    e.nivel_riesgo_arl ?? '',
  fondo_cesantias:     e.fondo_cesantias ?? '',
  caja_compensacion:   e.caja_compensacion ?? '',
  contacto_emergencia_nombre:   e.contacto_emergencia_nombre ?? '',
  contacto_emergencia_telefono: e.contacto_emergencia_telefono ?? '',
  notas:               e.notas ?? '',
});

/**
 * Construye el payload con los campos que realmente cambiaron.
 * '' se envía como null para poder BORRAR un dato; los ids numéricos se
 * convierten a number o null.
 */
function construirPayload(inicial: FormState, actual: FormState): UpdateUsuarioDto {
  const dto: Record<string, unknown> = {};
  const idFields = new Set(['id_restaurante_base', 'id_jefe_directo']);

  (Object.keys(actual) as (keyof FormState)[]).forEach((k) => {
    if (inicial[k] === actual[k]) return;
    const v = actual[k];

    if (idFields.has(k))            dto[k] = v === '' ? null : Number(v);
    else if (k === 'estado_laboral') dto[k] = v;              // nunca es vacío
    else                             dto[k] = v === '' ? null : v;
  });

  return dto as UpdateUsuarioDto;
}

interface TabDatosEmpleadoProps {
  empleado:     Usuario;
  sedes:        Restaurante[];
  posiblesJefes: { id: number; nombre_completo: string; cargo?: string | null }[];
  soloLectura:  boolean;
  onGuardar:    (dto: UpdateUsuarioDto) => Promise<void>;
}

export function TabDatosEmpleado({
  empleado, sedes, posiblesJefes, soloLectura, onGuardar,
}: TabDatosEmpleadoProps) {
  const inicial = useMemo(() => aFormState(empleado), [empleado]);
  const [form, setForm]       = useState<FormState>(inicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => { setForm(inicial); setError(''); }, [inicial]);

  const payload    = construirPayload(inicial, form);
  const hayCambios = Object.keys(payload).length > 0;
  const retirado   = form.estado_laboral === 'retirado';

  const set = (campo: keyof FormState) =>
    (e: { target: { value: unknown } }) => {
      setForm(prev => ({ ...prev, [campo]: e.target.value as string }));
      setError('');
    };

  const handleGuardar = async () => {
    // Se valida aquí además del backend para dar el mensaje sin ida y vuelta
    if (retirado && !form.fecha_retiro) {
      setError('Un empleado retirado requiere fecha de retiro.');
      return;
    }
    if (!retirado && form.fecha_retiro) {
      setError('La fecha de retiro solo aplica si el estado laboral es "Retirado".');
      return;
    }

    setGuardando(true);
    try {
      await onGuardar(payload);
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
      setError(msg?.error ?? msg?.message ?? 'No se pudieron guardar los cambios.');
    } finally {
      setGuardando(false);
    }
  };

  const Seccion = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
    <Card variant="outlined" sx={{ mb: 2.5 }}>
      <CardContent>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>{titulo}</Typography>
        <Stack spacing={2}>{children}</Stack>
      </CardContent>
    </Card>
  );

  const Fila = ({ children }: { children: React.ReactNode }) => (
    <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
      {children}
    </Box>
  );

  return (
    <Box>
      {soloLectura && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Los datos del super administrador no se pueden modificar.
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ opacity: soloLectura ? 0.6 : 1, pointerEvents: soloLectura ? 'none' : 'auto' }}>
        <Seccion titulo="Datos personales">
          <Fila>
            <FormControl fullWidth>
              <InputLabel>Tipo de documento</InputLabel>
              <Select value={form.tipo_documento} label="Tipo de documento" onChange={set('tipo_documento')}>
                <MenuItem value="">Sin especificar</MenuItem>
                {(Object.keys(TIPO_DOCUMENTO_LABEL) as TipoDocumento[]).map(k => (
                  <MenuItem key={k} value={k}>{TIPO_DOCUMENTO_LABEL[k]}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField fullWidth label="Número de documento"
              value={form.documento_identidad} onChange={set('documento_identidad')} />
          </Fila>
          <Fila>
            <TextField fullWidth label="Fecha de nacimiento" type="date"
              value={form.fecha_nacimiento} onChange={set('fecha_nacimiento')}
              InputLabelProps={{ shrink: true }} />
            <TextField fullWidth label="Teléfono" value={form.telefono} onChange={set('telefono')} />
          </Fila>
          <TextField fullWidth label="Dirección" value={form.direccion} onChange={set('direccion')} />
        </Seccion>

        <Seccion titulo="Vínculo laboral">
          <Fila>
            <TextField fullWidth label="Cargo / Puesto" placeholder="ej. Chef Principal, Mesero"
              value={form.cargo} onChange={set('cargo')} />
            <TextField fullWidth label="Fecha de ingreso" type="date"
              value={form.fecha_ingreso} onChange={set('fecha_ingreso')}
              InputLabelProps={{ shrink: true }} />
          </Fila>
          <Fila>
            <FormControl fullWidth>
              <InputLabel>Tipo de contrato</InputLabel>
              <Select value={form.tipo_contrato} label="Tipo de contrato" onChange={set('tipo_contrato')}>
                <MenuItem value="">Sin asignar</MenuItem>
                {(Object.keys(TIPO_CONTRATO_LABEL) as TipoContrato[]).map(k => (
                  <MenuItem key={k} value={k}>{TIPO_CONTRATO_LABEL[k]}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Jornada</InputLabel>
              <Select value={form.jornada} label="Jornada" onChange={set('jornada')}>
                <MenuItem value="">Sin asignar</MenuItem>
                {(Object.keys(JORNADA_LABEL) as Jornada[]).map(k => (
                  <MenuItem key={k} value={k}>{JORNADA_LABEL[k]}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Fila>
          <Fila>
            <FormControl fullWidth>
              <InputLabel>Turno</InputLabel>
              <Select value={form.turno} label="Turno" onChange={set('turno')}>
                <MenuItem value="">Sin asignar</MenuItem>
                {(Object.keys(TURNO_LABEL) as Turno[]).map(k => (
                  <MenuItem key={k} value={k}>{TURNO_LABEL[k]}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Sede de nómina</InputLabel>
              <Select value={form.id_restaurante_base} label="Sede de nómina" onChange={set('id_restaurante_base')}>
                <MenuItem value="">Sin asignar</MenuItem>
                {sedes.map(s => <MenuItem key={s.id} value={String(s.id)}>{s.nombre}</MenuItem>)}
              </Select>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                Sede que asume su costo laboral al liquidar nómina.
              </Typography>
            </FormControl>
          </Fila>
          <FormControl fullWidth>
            <InputLabel>Jefe directo</InputLabel>
            <Select value={form.id_jefe_directo} label="Jefe directo" onChange={set('id_jefe_directo')}>
              <MenuItem value="">Sin asignar</MenuItem>
              {posiblesJefes.map(j => (
                <MenuItem key={j.id} value={String(j.id)}>
                  {j.nombre_completo}{j.cargo ? ` — ${j.cargo}` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Divider />

          <Fila>
            <FormControl fullWidth>
              <InputLabel>Estado laboral</InputLabel>
              <Select value={form.estado_laboral} label="Estado laboral" onChange={set('estado_laboral')}>
                {(Object.keys(ESTADO_LABORAL_LABEL) as EstadoLaboral[]).map(k => (
                  <MenuItem key={k} value={k}>{ESTADO_LABORAL_LABEL[k]}</MenuItem>
                ))}
              </Select>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                Distinto del estado de la cuenta de acceso.
              </Typography>
            </FormControl>
            <TextField
              fullWidth label="Fecha de retiro" type="date"
              value={form.fecha_retiro} onChange={set('fecha_retiro')}
              InputLabelProps={{ shrink: true }}
              disabled={!retirado}
              helperText={retirado ? 'Obligatoria' : 'Solo para empleados retirados'}
            />
          </Fila>
          {retirado && (
            <TextField fullWidth label="Motivo del retiro"
              placeholder="ej. Renuncia voluntaria, terminación de contrato"
              value={form.motivo_retiro} onChange={set('motivo_retiro')} />
          )}
        </Seccion>

        <Seccion titulo="Seguridad social">
          <Fila>
            <TextField fullWidth label="EPS" placeholder="ej. Sura, Sanitas"
              value={form.eps} onChange={set('eps')} />
            <TextField fullWidth label="Fondo de pensiones (AFP)" placeholder="ej. Porvenir, Protección"
              value={form.afp} onChange={set('afp')} />
          </Fila>
          <Fila>
            <TextField fullWidth label="ARL" placeholder="ej. Positiva, Sura"
              value={form.arl} onChange={set('arl')} />
            <FormControl fullWidth>
              <InputLabel>Nivel de riesgo ARL</InputLabel>
              <Select value={form.nivel_riesgo_arl} label="Nivel de riesgo ARL" onChange={set('nivel_riesgo_arl')}>
                <MenuItem value="">Sin asignar</MenuItem>
                {(Object.keys(NIVEL_RIESGO_ARL_LABEL) as NivelRiesgoARL[]).map(k => (
                  <MenuItem key={k} value={k}>{NIVEL_RIESGO_ARL_LABEL[k]}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Fila>
          <Fila>
            <TextField fullWidth label="Fondo de cesantías"
              value={form.fondo_cesantias} onChange={set('fondo_cesantias')} />
            <TextField fullWidth label="Caja de compensación"
              value={form.caja_compensacion} onChange={set('caja_compensacion')} />
          </Fila>
        </Seccion>

        <Seccion titulo="Contacto de emergencia">
          <Fila>
            <TextField fullWidth label="Nombre"
              value={form.contacto_emergencia_nombre} onChange={set('contacto_emergencia_nombre')} />
            <TextField fullWidth label="Teléfono"
              value={form.contacto_emergencia_telefono} onChange={set('contacto_emergencia_telefono')} />
          </Fila>
        </Seccion>

        <Seccion titulo="Notas internas">
          <TextField fullWidth multiline rows={3}
            placeholder="Observaciones del administrador — no visibles para el empleado"
            value={form.notas} onChange={set('notas')} />
        </Seccion>
      </Box>

      {!soloLectura && (
        <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 1 }}>
          <Button startIcon={<Undo />} disabled={!hayCambios || guardando}
            onClick={() => { setForm(inicial); setError(''); }}>
            Descartar cambios
          </Button>
          <Button
            variant="contained"
            startIcon={guardando ? <CircularProgress size={16} color="inherit" /> : <Save />}
            disabled={!hayCambios || guardando}
            onClick={handleGuardar}
          >
            {hayCambios ? `Guardar (${Object.keys(payload).length})` : 'Sin cambios'}
          </Button>
        </Stack>
      )}
    </Box>
  );
}
