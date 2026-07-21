/**
 * TabDocumentos — emisión y consulta de documentos laborales del empleado.
 *
 * El flujo es: elegir tipo → previsualizar → emitir. La previsualización usa
 * el mismo renderer del backend que la emisión, así que lo que se ve en el
 * iframe es exactamente lo que quedará guardado.
 *
 * Un documento emitido no se edita ni se borra: se anula, y su contenido
 * original se conserva.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, FormControl, IconButton,
  InputLabel, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  Block, Close, ContentCopy, Description, Print, Visibility,
} from '@mui/icons-material';
import {
  documentosService,
  type DocumentoEmitido, type TipoDocumento, type TipoDocumentoMeta,
} from '../../services/documentos.service';
import type { Usuario } from '../../types';
import { EmptyState, ConfirmDialog } from '../common';
import { formatDateTime } from '../../utils/format';

/** Abre el HTML en una ventana y lanza la impresión del navegador. */
function imprimirHtml(html: string) {
  const win = window.open('', '_blank', 'width=860,height=1000');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  // El load garantiza que el CSS y el QR estén pintados antes de imprimir
  win.onload = () => { win.focus(); win.print(); };
  return true;
}

interface TabDocumentosProps {
  empleado: Usuario;
  onError:  (mensaje: string) => void;
  onExito:  (mensaje: string) => void;
}

export function TabDocumentos({ empleado, onError, onExito }: TabDocumentosProps) {
  const [tipos, setTipos]           = useState<TipoDocumentoMeta[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoEmitido[]>([]);
  const [cargando, setCargando]     = useState(true);

  // Emisión
  const [tipoSel, setTipoSel]           = useState<TipoDocumento | ''>('');
  const [observaciones, setObservaciones] = useState('');
  const [previewHtml, setPreviewHtml]   = useState<string | null>(null);
  const [previewCargando, setPreviewCargando] = useState(false);
  const [emitiendo, setEmitiendo]       = useState(false);

  // Anulación
  const [anular, setAnular] = useState<DocumentoEmitido | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');

  const retirado = empleado.estado_laboral === 'retirado';

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [t, d] = await Promise.all([
        documentosService.listarTipos(),
        documentosService.listarPorEmpleado(empleado.id),
      ]);
      setTipos(t);
      setDocumentos(d);
    } catch {
      onError('No se pudieron cargar los documentos');
    } finally {
      setCargando(false);
    }
  }, [empleado.id, onError]);

  useEffect(() => { cargar(); }, [cargar]);

  const metaSel = tipos.find(t => t.tipo === tipoSel);
  const bloqueadoPorRetiro = !!metaSel?.requiereRetiro && !retirado;

  const handlePrevisualizar = async () => {
    if (!tipoSel) return;
    setPreviewCargando(true);
    try {
      const { html } = await documentosService.previsualizar(tipoSel, empleado.id, observaciones || undefined);
      setPreviewHtml(html);
    } catch (err) {
      const data = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
      onError(data?.error ?? data?.message ?? 'No se pudo generar la vista previa');
    } finally {
      setPreviewCargando(false);
    }
  };

  const handleEmitir = async () => {
    if (!tipoSel) return;
    setEmitiendo(true);
    try {
      const doc = await documentosService.emitir(tipoSel, empleado.id, observaciones || undefined);
      onExito(`Documento ${doc.consecutivo} emitido correctamente`);
      setPreviewHtml(null);
      setObservaciones('');
      await cargar();
      // Se abre el snapshot ya guardado, no el preview
      const { contenido_html } = await documentosService.obtenerContenido(doc.id);
      imprimirHtml(contenido_html);
    } catch (err) {
      const data = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
      onError(data?.error ?? data?.message ?? 'No se pudo emitir el documento');
    } finally {
      setEmitiendo(false);
    }
  };

  const handleImprimir = async (doc: DocumentoEmitido) => {
    try {
      const { contenido_html } = await documentosService.obtenerContenido(doc.id);
      if (!imprimirHtml(contenido_html)) {
        onError('El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes.');
      }
    } catch {
      onError('No se pudo abrir el documento');
    }
  };

  const handleAnular = async () => {
    if (!anular) return;
    try {
      await documentosService.anular(anular.id, motivoAnulacion);
      onExito('Documento anulado');
      setMotivoAnulacion('');
      await cargar();
    } catch (err) {
      const data = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
      onError(data?.error ?? data?.message ?? 'No se pudo anular el documento');
    }
  };

  const estadoDoc = (d: DocumentoEmitido) => {
    if (d.anulado) return { label: 'Anulado', color: 'error' as const };
    if (d.vigencia_hasta && new Date(d.vigencia_hasta) < new Date())
      return { label: 'Vencido', color: 'warning' as const };
    return { label: 'Vigente', color: 'success' as const };
  };

  if (cargando) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      {/* ── Emitir ──────────────────────────────────────────────────────── */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
            Emitir un documento
          </Typography>

          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Tipo de documento</InputLabel>
              <Select
                value={tipoSel} label="Tipo de documento"
                onChange={e => { setTipoSel(e.target.value as TipoDocumento); setPreviewHtml(null); }}
              >
                {tipos.map(t => (
                  <MenuItem key={t.tipo} value={t.tipo} disabled={t.requiereRetiro && !retirado}>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{t.nombre}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t.descripcion}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {bloqueadoPorRetiro && (
              <Alert severity="warning">
                Este documento solo puede emitirse a empleados retirados. Registra
                primero el retiro en la pestaña <strong>Datos del empleado</strong>.
              </Alert>
            )}

            {tipoSel === 'documento_acta_dotacion' && (
              <TextField
                fullWidth multiline rows={3}
                label="Elementos entregados"
                placeholder="ej. 2 camisas talla M, 1 pantalón, 1 par de calzado antideslizante"
                value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                helperText="Se insertan en el cuerpo del acta"
              />
            )}

            <Stack direction="row" spacing={1.5}>
              <Button
                variant="outlined"
                startIcon={previewCargando ? <CircularProgress size={16} /> : <Visibility />}
                onClick={handlePrevisualizar}
                disabled={!tipoSel || previewCargando || bloqueadoPorRetiro}
              >
                Previsualizar
              </Button>
              <Button
                variant="contained"
                startIcon={emitiendo ? <CircularProgress size={16} color="inherit" /> : <Description />}
                onClick={handleEmitir}
                disabled={!tipoSel || emitiendo || bloqueadoPorRetiro}
              >
                Emitir e imprimir
              </Button>
            </Stack>

            <Typography variant="caption" color="text.secondary">
              Al emitir se genera un consecutivo, un código de verificación y una
              copia inmutable del documento. Editar la plantilla después no
              cambia los documentos ya emitidos.
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Historial ───────────────────────────────────────────────────── */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
            Documentos emitidos
          </Typography>

          {documentos.length === 0 ? (
            <EmptyState
              message="Sin documentos emitidos"
              description="Los certificados y cartas que emitas quedarán registrados aquí."
            />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Documento</TableCell>
                  <TableCell>Emisión</TableCell>
                  <TableCell>Código</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {documentos.map(d => {
                  const est = estadoDoc(d);
                  return (
                    <TableRow key={d.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{d.consecutivo}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {tipos.find(t => t.tipo === d.tipo)?.nombre ?? d.tipo}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{formatDateTime(d.fecha_emision)}</Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          por {d.emisor.nombre_completo}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Typography variant="caption" fontFamily="monospace" fontWeight={700}>
                            {d.codigo_verificacion}
                          </Typography>
                          <Tooltip title="Copiar código">
                            <IconButton
                              size="small"
                              onClick={() => {
                                navigator.clipboard?.writeText(d.codigo_verificacion);
                                onExito('Código copiado');
                              }}
                            >
                              <ContentCopy sx={{ fontSize: 13 }} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip label={est.label} size="small" color={est.color} variant="outlined" />
                        {d.anulado && d.motivo_anulacion && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {d.motivo_anulacion}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Ver e imprimir">
                          <IconButton size="small" onClick={() => handleImprimir(d)}>
                            <Print fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={d.anulado ? 'Ya está anulado' : 'Anular'}>
                          <span>
                            <IconButton
                              size="small" color="error" disabled={d.anulado}
                              onClick={() => { setAnular(d); setMotivoAnulacion(''); }}
                            >
                              <Block fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Vista previa ────────────────────────────────────────────────── */}
      <Dialog open={!!previewHtml} onClose={() => setPreviewHtml(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography fontWeight={700}>Vista previa — sin emitir</Typography>
          <IconButton size="small" onClick={() => setPreviewHtml(null)}><Close fontSize="small" /></IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ p: 0, bgcolor: 'grey.100' }}>
          <Alert severity="info" square sx={{ borderRadius: 0 }}>
            Borrador. El consecutivo y el código de verificación se generan al emitir.
          </Alert>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
            <iframe
              title="Vista previa del documento"
              srcDoc={previewHtml ?? ''}
              style={{
                width: '210mm', height: '70vh', border: '1px solid #ccc',
                background: '#fff', transform: 'scale(0.85)', transformOrigin: 'top center',
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPreviewHtml(null)}>Cerrar</Button>
          <Button
            variant="contained" startIcon={<Description />}
            onClick={handleEmitir} disabled={emitiendo}
          >
            Emitir este documento
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Anulación ───────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!anular}
        title="Anular documento"
        message={
          `El documento ${anular?.consecutivo ?? ''} quedará marcado como anulado y su ` +
          `verificación pública dejará de ser válida. El contenido original se conserva.`
        }
        confirmText="Anular"
        confirmColor="error"
        disabled={motivoAnulacion.trim().length < 5}
        onConfirm={handleAnular}
        onClose={() => setAnular(null)}
      >
        <TextField
          fullWidth autoFocus size="small" sx={{ mt: 2 }}
          label="Motivo de la anulación"
          placeholder="ej. Emitido con el cargo equivocado"
          value={motivoAnulacion}
          onChange={e => setMotivoAnulacion(e.target.value)}
          helperText="Mínimo 5 caracteres — queda registrado en la auditoría"
        />
      </ConfirmDialog>
    </Box>
  );
}
