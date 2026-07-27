/**
 * MisDocumentos — autoservicio de documentos del trabajador (pestaña de Perfil).
 *
 * Dos bloques:
 *   · Mis documentos: los que administración ya emitió a mi nombre (certificado,
 *     paz y salvo, etc.). Solo se ven e imprimen — no se editan.
 *   · Mi desprendible: elijo un periodo de nómina ya aprobado y genero mi colilla.
 *     Es idempotente: volver a generarla del mismo periodo devuelve la misma.
 *
 * Todo sale de rutas /auth/mi(s)-* que toman el id del token: no requiere permiso
 * de administración y no hay forma de ver los documentos de otra persona.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, FormControl, IconButton,
  InputLabel, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Typography,
} from '@mui/material';
import { Close, Print, ReceiptLong, Visibility } from '@mui/icons-material';
import {
  documentosService,
  type DocumentoEmitido, type PeriodoLiquidado, type TipoDocumento,
} from '../../services/documentos.service';
import { EmptyState } from '../common';
import { DocumentoPreviewA4 } from './DocumentoPreviewA4';
import { imprimirHtml } from '../../utils/imprimirHtml';
import { formatCurrency, formatDateTime } from '../../utils/format';

const TIPO_LABEL: Record<TipoDocumento, string> = {
  documento_certificado_laboral: 'Certificado laboral',
  documento_carta_terminacion:   'Carta de terminación',
  documento_paz_y_salvo:         'Paz y salvo',
  documento_acta_dotacion:       'Acta de dotación',
  documento_desprendible_pago:   'Desprendible de pago',
};

const soloFecha = (v: string) => new Date(v).toLocaleDateString('es-CO');

interface MisDocumentosProps {
  onError: (mensaje: string) => void;
}

export function MisDocumentos({ onError }: MisDocumentosProps) {
  const [documentos, setDocumentos] = useState<DocumentoEmitido[]>([]);
  const [periodos, setPeriodos]     = useState<PeriodoLiquidado[]>([]);
  const [cargando, setCargando]     = useState(true);

  const [periodoSel, setPeriodoSel] = useState<number | ''>('');
  const [generando, setGenerando]   = useState(false);

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [abriendo, setAbriendo]       = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [docs, pers] = await Promise.all([
        documentosService.misDocumentos(),
        documentosService.misPeriodosLiquidados(),
      ]);
      setDocumentos(docs);
      setPeriodos(pers);
    } catch {
      onError('No se pudieron cargar tus documentos');
    } finally {
      setCargando(false);
    }
  }, [onError]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirPreview = async (id: number) => {
    setAbriendo(id);
    try {
      const { contenido_html } = await documentosService.miDocumentoContenido(id);
      setPreviewHtml(contenido_html);
    } catch {
      onError('No se pudo abrir el documento');
    } finally {
      setAbriendo(null);
    }
  };

  const imprimir = async (id: number) => {
    try {
      const { contenido_html } = await documentosService.miDocumentoContenido(id);
      if (!imprimirHtml(contenido_html)) {
        onError('El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes.');
      }
    } catch {
      onError('No se pudo abrir el documento');
    }
  };

  const generarDesprendible = async () => {
    if (!periodoSel) return;
    setGenerando(true);
    try {
      const doc = await documentosService.miDesprendible(periodoSel);
      await cargar();
      await abrirPreview(doc.id);
    } catch (err) {
      const data = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
      onError(data?.error ?? data?.message ?? 'No se pudo generar el desprendible');
    } finally {
      setGenerando(false);
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
      {/* ── Mi desprendible de pago ──────────────────────────────────────── */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
            Mi desprendible de pago
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Genera la colilla de un periodo ya aprobado. Volver a generarla del mismo
            periodo devuelve la misma, no crea copias.
          </Typography>

          {periodos.length === 0 ? (
            <Alert severity="info">
              Aún no tienes periodos de nómina aprobados. Cuando administración liquide
              y apruebe un periodo, tu desprendible aparecerá aquí.
            </Alert>
          ) : (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start">
              <FormControl size="small" sx={{ minWidth: 260 }}>
                <InputLabel>Periodo</InputLabel>
                <Select
                  value={periodoSel} label="Periodo"
                  onChange={e => setPeriodoSel(e.target.value as number)}
                >
                  {periodos.map(p => (
                    <MenuItem key={p.id_periodo} value={p.id_periodo}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{p.nombre}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {soloFecha(p.fecha_inicio)}–{soloFecha(p.fecha_fin)} · Neto {formatCurrency(p.neto_pagar)}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                startIcon={generando ? <CircularProgress size={16} color="inherit" /> : <ReceiptLong />}
                onClick={generarDesprendible}
                disabled={!periodoSel || generando}
              >
                Generar desprendible
              </Button>
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* ── Mis documentos emitidos ──────────────────────────────────────── */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
            Mis documentos
          </Typography>

          {documentos.length === 0 ? (
            <EmptyState
              message="Aún no tienes documentos"
              description="Tus certificados y desprendibles aparecerán aquí cuando se emitan."
            />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Documento</TableCell>
                  <TableCell>Emisión</TableCell>
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
                          {TIPO_LABEL[d.tipo] ?? d.tipo}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{formatDateTime(d.fecha_emision)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={est.label} size="small" color={est.color} variant="outlined" />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small" onClick={() => abrirPreview(d.id)} disabled={abriendo === d.id}>
                          {abriendo === d.id ? <CircularProgress size={16} /> : <Visibility fontSize="small" />}
                        </IconButton>
                        <IconButton size="small" onClick={() => imprimir(d.id)}>
                          <Print fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Vista previa ─────────────────────────────────────────────────── */}
      <Dialog open={!!previewHtml} onClose={() => setPreviewHtml(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography fontWeight={700}>Vista previa</Typography>
          <IconButton size="small" onClick={() => setPreviewHtml(null)}><Close fontSize="small" /></IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ p: 2 }}>
          <DocumentoPreviewA4 html={previewHtml ?? ''} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPreviewHtml(null)}>Cerrar</Button>
          <Button
            variant="contained" startIcon={<Print />}
            onClick={() => previewHtml && imprimirHtml(previewHtml)}
          >
            Imprimir
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
