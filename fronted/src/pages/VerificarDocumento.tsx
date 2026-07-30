/**
 * VerificarDocumento — página PÚBLICA de verificación (/verificar/:codigo).
 *
 * Es el destino del QR impreso en los documentos laborales. Debe funcionar sin
 * sesión: quien verifica suele ser un banco, una embajada o un arrendador que
 * no tiene cuenta en el sistema.
 *
 * Muestra lo justo para confirmar autenticidad —tipo, empresa, titular, fechas
 * y vigencia— y nunca el salario ni el documento de identidad: la pregunta que
 * responde es "¿este certificado es real?", no "¿cuánto gana esta persona?".
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert, Box, Card, CardContent, Chip, CircularProgress, Divider,
  Stack, TextField, Typography, Button,
} from '@mui/material';
import {
  Block, CheckCircle, ErrorOutline, Search, WatchLater,
} from '@mui/icons-material';
import { documentosService, type VerificacionDocumento } from '../services/documentos.service';

const ESTADO_UI = {
  vigente: {
    color: 'success' as const,
    icon:  <CheckCircle sx={{ fontSize: 52 }} />,
    titulo: 'Documento auténtico',
    detalle: 'Este documento fue emitido por la empresa y se encuentra vigente.',
  },
  vencido: {
    color: 'warning' as const,
    icon:  <WatchLater sx={{ fontSize: 52 }} />,
    titulo: 'Documento vencido',
    detalle: 'El documento es auténtico, pero superó su fecha de validez. Solicita uno actualizado.',
  },
  anulado: {
    color: 'error' as const,
    icon:  <Block sx={{ fontSize: 52 }} />,
    titulo: 'Documento anulado',
    detalle: 'La empresa anuló este documento. No debe tomarse como válido.',
  },
};

function Fila({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.75 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600} sx={{ textAlign: 'right' }}>{value}</Typography>
    </Box>
  );
}

const fecha = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : null;

export function VerificarDocumento() {
  const { codigo: codigoUrl } = useParams<{ codigo: string }>();

  const [codigo, setCodigo]   = useState(codigoUrl ?? '');
  const [datos, setDatos]     = useState<VerificacionDocumento | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError]     = useState('');
  const [buscado, setBuscado] = useState(false);

  const verificar = async (valor: string) => {
    const limpio = valor.trim();
    if (!limpio) return;

    setCargando(true);
    setError('');
    setDatos(null);
    try {
      setDatos(await documentosService.verificar(limpio));
    } catch {
      setError('No existe ningún documento con ese código. Revisa que lo hayas escrito bien.');
    } finally {
      setCargando(false);
      setBuscado(true);
    }
  };

  // Si el código viene en la URL (escaneando el QR) se verifica solo
  useEffect(() => {
    if (codigoUrl) verificar(codigoUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoUrl]);

  const ui = datos ? ESTADO_UI[datos.estado] : null;

  return (
    <Box sx={{
      minHeight: '100vh', bgcolor: 'grey.100',
      display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
      p: { xs: 2, sm: 5 },
    }}>
      <Box sx={{ width: '100%', maxWidth: 520 }}>
        <Typography variant="h5" fontWeight={800} textAlign="center" sx={{ mb: 0.5 }}>
          Verificación de documentos
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 3 }}>
          Comprueba la autenticidad de un documento laboral con su código.
        </Typography>

        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction="row" spacing={1.5}>
              <TextField
                fullWidth size="small" label="Código de verificación"
                placeholder="Ej. M3DVPCBHJU"
                value={codigo}
                onChange={e => setCodigo(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') verificar(codigo); }}
                inputProps={{ style: { fontFamily: 'monospace', letterSpacing: 2 } }}
              />
              <Button
                variant="contained"
                startIcon={cargando ? <CircularProgress size={16} color="inherit" /> : <Search />}
                onClick={() => verificar(codigo)}
                disabled={cargando || !codigo.trim()}
              >
                Verificar
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {error && (
          <Alert severity="error" icon={<ErrorOutline />} sx={{ mb: 3 }}>{error}</Alert>
        )}

        {datos && ui && (
          <Card variant="outlined">
            <Box sx={{
              bgcolor: `${ui.color}.main`, color: '#fff',
              p: 3, textAlign: 'center',
            }}>
              {ui.icon}
              <Typography variant="h6" fontWeight={800}>{ui.titulo}</Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                {ui.detalle}
              </Typography>
            </Box>

            <CardContent>
              <Fila label="Tipo de documento" value={datos.tipo_nombre} />
              <Fila label="Consecutivo"       value={datos.consecutivo} />
              <Fila label="Titular"           value={datos.titular} />
              <Divider sx={{ my: 1 }} />
              <Fila label="Empresa"    value={datos.empresa} />
              <Fila label="NIT"        value={datos.empresa_nit} />
              <Divider sx={{ my: 1 }} />
              <Fila label="Fecha de emisión" value={fecha(datos.fecha_emision)} />
              <Fila label="Válido hasta"     value={fecha(datos.vigencia_hasta) ?? 'Sin vencimiento'} />

              <Box sx={{ mt: 2 }}>
                <Chip
                  label={datos.estado.toUpperCase()}
                  color={ui.color}
                  size="small"
                  sx={{ fontWeight: 700 }}
                />
              </Box>

              <Alert severity="info" sx={{ mt: 2 }}>
                Por privacidad, esta consulta no revela el salario ni el
                documento de identidad del titular.
              </Alert>

              <Typography
                variant="caption" color="text.secondary"
                sx={{ mt: 2, display: 'block', wordBreak: 'break-all' }}
              >
                Huella del documento (SHA-256): {datos.hash}
              </Typography>
            </CardContent>
          </Card>
        )}

        {buscado && !datos && !error && !cargando && (
          <Alert severity="info">Escribe un código para verificar.</Alert>
        )}
      </Box>
    </Box>
  );
}
