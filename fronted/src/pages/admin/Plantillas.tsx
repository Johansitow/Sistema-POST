/**
 * Plantillas de Impresión — Admin page
 *
 * Gestión completa de plantillas para ticket, factura, comanda y cocina.
 * Cada plantilla configura qué secciones y campos aparecen al imprimir.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogTitle, Divider,
  FormControl, FormControlLabel, IconButton, InputLabel,
  MenuItem, Paper, Select, Snackbar, Switch, Tab, Tabs,
  TextField, Tooltip, Typography,
} from '@mui/material';
import {
  Add, Close, Delete, Edit, KeyboardArrowDown, KeyboardArrowUp,
  Print, Refresh, Save, Star, StarBorder,
} from '@mui/icons-material';
import {
  plantillasService,
  type PlantillaImpresion,
  type PlantillaConfig,
  type TipoPlantilla,
  PLANTILLA_DEFAULTS,
} from '../../services/plantillas.service';
import { PlantillaPreview } from '../../components/plantillas/PlantillaPreview';
import { uiConfigService } from '../../services/ui-config.service';

// ── Impresión defaults ────────────────────────────────────────────────────────

const PAPEL_OPCIONES = [
  { value: '58mm', label: '58 mm', desc: 'Impresoras pequeñas de bolsillo' },
  { value: '80mm', label: '80 mm', desc: 'Impresoras térmicas estándar (más común)' },
  { value: 'A4',   label: 'A4',    desc: 'Hoja tamaño carta / A4' },
];

function ImpresionDefaultsPanel() {
  const [anchoPapel,    setAnchoPapel]    = useState('80mm');
  const [copiasComanda, setCopiasComanda] = useState(1);
  const [pieTicket,     setPieTicket]     = useState('¡Gracias por su compra!');
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState('');

  useEffect(() => {
    Promise.all([
      uiConfigService.getConfig('impresion', 'ancho_papel'),
      uiConfigService.getConfig('impresion', 'copias_comanda'),
      uiConfigService.getConfig('impresion', 'pie_ticket'),
    ]).then(([papel, copias, pie]) => {
      if (papel?.valor)  setAnchoPapel(String(papel.valor));
      if (copias?.valor) setCopiasComanda(Number(copias.valor));
      if (pie?.valor)    setPieTicket(String(pie.valor));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        uiConfigService.setConfig('impresion', 'ancho_papel',    anchoPapel),
        uiConfigService.setConfig('impresion', 'copias_comanda', copiasComanda),
        uiConfigService.setConfig('impresion', 'pie_ticket',     pieTicket),
      ]);
      setToast('Configuración de impresión guardada');
    } catch { setToast('Error al guardar'); }
    finally { setSaving(false); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Configuración de impresión</Typography>
          <Typography variant="body2" color="text.secondary">Valores por defecto para tickets y comandas.</Typography>
        </Box>
        <Button variant="contained"
          startIcon={saving ? <CircularProgress size={16} /> : <Save />}
          onClick={handleSave} disabled={saving}>
          Guardar
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 520 }}>
        {/* Ancho de papel */}
        <Box>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>Tamaño del papel</Typography>
          <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
            {PAPEL_OPCIONES.map(opt => {
              const sel = anchoPapel === opt.value;
              return (
                <Box key={opt.value} onClick={() => setAnchoPapel(opt.value)} sx={{
                  flex: 1, p: 2, borderRadius: 2, border: '2px solid', cursor: 'pointer',
                  borderColor: sel ? 'primary.main' : 'divider',
                  bgcolor:     sel ? 'primary.50'   : 'transparent',
                  transition: 'all 0.15s', '&:hover': { borderColor: 'primary.light' },
                }}>
                  <Typography variant="subtitle2" fontWeight={700}
                    color={sel ? 'primary.main' : 'text.primary'}>
                    {opt.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{opt.desc}</Typography>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Copias de comanda */}
        <Box>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>Copias de comanda de cocina</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
            Número de impresiones al cerrar una orden.
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <IconButton size="small" onClick={() => setCopiasComanda(p => Math.max(1, p - 1))}
              disabled={copiasComanda <= 1} sx={{ border: '1px solid', borderColor: 'divider' }}>
              <KeyboardArrowDown fontSize="small" />
            </IconButton>
            <Typography variant="h5" fontWeight={800} sx={{ minWidth: 32, textAlign: 'center' }}>
              {copiasComanda}
            </Typography>
            <IconButton size="small" onClick={() => setCopiasComanda(p => Math.min(5, p + 1))}
              disabled={copiasComanda >= 5} sx={{ border: '1px solid', borderColor: 'divider' }}>
              <KeyboardArrowUp fontSize="small" />
            </IconButton>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              {copiasComanda === 1 ? '1 copia' : `${copiasComanda} copias`}
            </Typography>
          </Box>
        </Box>

        {/* Pie del ticket */}
        <Box>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>Mensaje al pie del ticket</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Texto que aparece al final de cada ticket impreso.
          </Typography>
          <TextField value={pieTicket} onChange={e => setPieTicket(e.target.value)}
            placeholder="Ej: ¡Gracias por su visita!" fullWidth size="small"
            inputProps={{ maxLength: 100 }} helperText={`${pieTicket.length}/100`} />
          <Paper variant="outlined" sx={{ mt: 2, p: 2, borderRadius: 1.5, maxWidth: 200, mx: 'auto', textAlign: 'center' }}>
            <Typography variant="caption" color="text.disabled" display="block" sx={{ mb: 0.5 }}>— — —</Typography>
            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.72rem', fontWeight: 600 }}>
              {pieTicket || '(sin mensaje)'}
            </Typography>
          </Paper>
        </Box>
      </Box>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={toast.startsWith('Error') ? 'error' : 'success'}
          onClose={() => setToast('')} variant="filled">
          {toast}
        </Alert>
      </Snackbar>
    </>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TIPOS: { value: TipoPlantilla; label: string; icono: string; color: string }[] = [
  { value: 'ticket',  label: 'Ticket',  icono: '🧾', color: '#2196f3' },
  { value: 'factura', label: 'Factura', icono: '📄', color: '#9c27b0' },
  { value: 'comanda', label: 'Comanda', icono: '📋', color: '#ff9800' },
  { value: 'cocina',  label: 'Cocina',  icono: '🍳', color: '#f44336' },
];

const SECTION_LABELS: Record<string, string> = {
  header:  'Encabezado',
  items:   'Productos',
  totals:  'Totales',
  footer:  'Pie de página',
  cliente: 'Datos del cliente',
};

const CAMPO_LABELS: Record<string, string> = {
  restaurantName: 'Nombre del restaurante',
  nit: 'NIT',
  direccion: 'Dirección',
  telefono: 'Teléfono',
  resolucionDian: 'Resolución DIAN',
  nombre: 'Nombre',
  documento: 'Documento',
  email: 'Email',
  cantidad: 'Cantidad',
  precio: 'Precio',
  subtotal: 'Subtotal',
  descuento: 'Descuento',
  variante: 'Variante',
  nota: 'Nota',
  iva: 'IVA',
  total: 'Total',
  metodoPago: 'Método de pago',
  gracias: 'Mensaje de gracias',
  fechaHora: 'Fecha y hora',
  condicionesPago: 'Condiciones de pago',
  mesa: 'Mesa',
  mesero: 'Mesero',
  orden: 'Número de orden',
  prioridad: 'Prioridad',
  totalItems: 'Total de ítems',
};

// ── Section editor ────────────────────────────────────────────────────────────

function SectionEditor({
  config,
  onChange,
}: {
  config: PlantillaConfig;
  onChange: (c: PlantillaConfig) => void;
}) {
  const updateSection = (idx: number, patch: Partial<{ visible: boolean; campos: Record<string, boolean> }>) => {
    const sections = config.sections.map((s, i) => i === idx ? { ...s, ...patch } : s);
    onChange({ ...config, sections });
  };

  const toggleCampo = (secIdx: number, campo: string) => {
    const sec = config.sections[secIdx];
    updateSection(secIdx, { campos: { ...sec.campos, [campo]: !sec.campos[campo] } });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
      {/* Config global */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Ancho papel</InputLabel>
          <Select
            label="Ancho papel"
            value={config.config.paperWidth}
            onChange={e => onChange({ ...config, config: { ...config.config, paperWidth: e.target.value } })}
          >
            <MenuItem value="80mm">80mm (térmica)</MenuItem>
            <MenuItem value="58mm">58mm (pequeña)</MenuItem>
            <MenuItem value="A4">A4 (carta)</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Tamaño texto</InputLabel>
          <Select
            label="Tamaño texto"
            value={config.config.fontSize}
            onChange={e => onChange({ ...config, config: { ...config.config, fontSize: e.target.value } })}
          >
            <MenuItem value="small">Pequeño</MenuItem>
            <MenuItem value="medium">Mediano</MenuItem>
            <MenuItem value="large">Grande</MenuItem>
          </Select>
        </FormControl>
        <FormControlLabel
          control={
            <Switch
              checked={config.config.showLogo}
              onChange={e => onChange({ ...config, config: { ...config.config, showLogo: e.target.checked } })}
            />
          }
          label="Mostrar logo"
        />
      </Box>

      <Divider />

      {/* Secciones */}
      {config.sections.map((sec, idx) => (
        <Card key={sec.id} variant="outlined" sx={{ opacity: sec.visible ? 1 : 0.5 }}>
          <CardContent sx={{ py: '10px !important' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                {SECTION_LABELS[sec.tipo] ?? sec.tipo}
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={sec.visible}
                    onChange={() => updateSection(idx, { visible: !sec.visible })}
                  />
                }
                label={sec.visible ? 'Visible' : 'Oculta'}
              />
            </Box>
            {sec.visible && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {Object.entries(sec.campos).map(([campo, activo]) => (
                  <Chip
                    key={campo}
                    label={CAMPO_LABELS[campo] ?? campo}
                    size="small"
                    color={activo ? 'primary' : 'default'}
                    variant={activo ? 'filled' : 'outlined'}
                    onClick={() => toggleCampo(idx, campo)}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

// ── Form Dialog ───────────────────────────────────────────────────────────────

function PlantillaDialog({
  open,
  item,
  onClose,
  onSaved,
}: {
  open: boolean;
  item: PlantillaImpresion | null;
  onClose: () => void;
  onSaved: (p: PlantillaImpresion) => void;
}) {
  const isEdit = !!item;
  const [nombre,    setNombre]    = useState('');
  const [tipo,      setTipo]      = useState<TipoPlantilla>('ticket');
  const [esDefault, setEsDefault] = useState(false);
  const [config,    setConfig]    = useState<PlantillaConfig>(
    (PLANTILLA_DEFAULTS.ticket as unknown) as PlantillaConfig
  );
  const [loading, setLoading]     = useState(false);
  const [error,   setError]       = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (item) {
      setNombre(item.nombre);
      setTipo(item.tipo as TipoPlantilla);
      setEsDefault(item.es_default);
      setConfig((item.plantilla as unknown) as PlantillaConfig);
    } else {
      setNombre('');
      setTipo('ticket');
      setEsDefault(false);
      setConfig((PLANTILLA_DEFAULTS.ticket as unknown) as PlantillaConfig);
    }
  }, [open, item]);

  // Cuando cambia el tipo en modo creación, cargar el default de ese tipo
  const handleTipoChange = (t: TipoPlantilla) => {
    setTipo(t);
    if (!isEdit) setConfig((PLANTILLA_DEFAULTS[t] as unknown) as PlantillaConfig);
  };

  const handleSave = async () => {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setLoading(true);
    try {
      const dto = { nombre: nombre.trim(), tipo, es_default: esDefault, plantilla: config as any };
      const saved = isEdit
        ? await plantillasService.actualizar(item!.id, dto)
        : await plantillasService.crear(dto);
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Print fontSize="small" />
          <Typography fontWeight={700}>{isEdit ? 'Editar plantilla' : 'Nueva plantilla'}</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
      </DialogTitle>
      <Divider />

      {/* Dos columnas: editor | preview */}
      <Box sx={{ display: 'flex', height: '78vh', overflow: 'hidden' }}>

        {/* Columna izquierda — editor */}
        <Box sx={{ width: '42%', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: 1, borderColor: 'divider' }}>
          <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                fullWidth size="small"
                label="Nombre de la plantilla *"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Ticket compacto, Factura legal"
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Tipo</InputLabel>
                  <Select
                    label="Tipo"
                    value={tipo}
                    onChange={e => handleTipoChange(e.target.value as TipoPlantilla)}
                    disabled={isEdit}
                  >
                    {TIPOS.map(t => (
                      <MenuItem key={t.value} value={t.value}>
                        {t.icono} {t.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControlLabel
                  control={<Switch checked={esDefault} onChange={e => setEsDefault(e.target.checked)} />}
                  label="Predeterminada"
                />
              </Box>
              <Divider>
                <Typography variant="caption" color="text.secondary">Configurar secciones</Typography>
              </Divider>
              <SectionEditor config={config} onChange={setConfig} />
            </Box>
          </Box>

          {/* Acciones en el pie de la columna izquierda */}
          <Box sx={{ px: 2.5, py: 1.5, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button variant="contained" onClick={handleSave} disabled={loading}>
              {loading ? <CircularProgress size={20} /> : isEdit ? 'Guardar cambios' : 'Crear plantilla'}
            </Button>
          </Box>
        </Box>

        {/* Columna derecha — preview en vivo */}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <PlantillaPreview tipo={tipo} config={config} />
        </Box>

      </Box>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function Plantillas() {
  const [items,    setItems]    = useState<PlantillaImpresion[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<PlantillaImpresion | null>(null);
  const [toast,    setToast]    = useState('');
  const [toastErr, setToastErr] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await plantillasService.listar()); }
    catch { setToast('Error al cargar plantillas'); setToastErr(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isConfigTab = tab === TIPOS.length;
  const tipoActual  = isConfigTab ? null : TIPOS[tab]?.value;
  const filtered    = tipoActual ? items.filter(p => p.tipo === tipoActual) : [];

  const handleDelete = async (p: PlantillaImpresion) => {
    if (!window.confirm(`¿Eliminar la plantilla "${p.nombre}"?`)) return;
    try {
      await plantillasService.eliminar(p.id);
      setItems(prev => prev.filter(x => x.id !== p.id));
      setToast('Plantilla eliminada'); setToastErr(false);
    } catch (err: any) {
      setToast(err.response?.data?.error || 'Error al eliminar'); setToastErr(true);
    }
  };

  const handleSetDefault = async (p: PlantillaImpresion) => {
    try {
      await plantillasService.actualizar(p.id, { es_default: true });
      // Quitar default de las demás del mismo tipo
      setItems(prev => prev.map(x =>
        x.tipo === p.tipo ? { ...x, es_default: x.id === p.id } : x
      ));
      setToast(`"${p.nombre}" marcada como predeterminada`); setToastErr(false);
    } catch {
      setToast('Error al cambiar predeterminada'); setToastErr(true);
    }
  };

  const handleSaved = (p: PlantillaImpresion) => {
    setItems(prev => {
      const idx = prev.findIndex(x => x.id === p.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = p; return n; }
      return [...prev, p];
    });
    setToast(editItem ? 'Plantilla actualizada' : 'Plantilla creada');
    setToastErr(false);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Plantillas de Impresión</Typography>
          <Typography variant="body2" color="text.secondary">
            Configura el diseño de tickets, facturas, comandas y comandas de cocina
          </Typography>
        </Box>
        {!isConfigTab && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Recargar">
              <IconButton onClick={load} disabled={loading}><Refresh /></IconButton>
            </Tooltip>
            <Button variant="contained" startIcon={<Add />}
              onClick={() => { setEditItem(null); setFormOpen(true); }}>
              Nueva plantilla
            </Button>
          </Box>
        )}
      </Box>

      {/* Tabs por tipo */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        {TIPOS.map(t => (
          <Tab
            key={t.value}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <span>{t.icono}</span>
                <span>{t.label}</span>
                <Chip
                  size="small"
                  label={items.filter(p => p.tipo === t.value).length}
                  sx={{ height: 18, fontSize: '0.65rem', ml: 0.5 }}
                />
              </Box>
            }
          />
        ))}
        <Tab icon={<Print fontSize="small" />} iconPosition="start" label="Impresión" />
      </Tabs>

      {/* Panel de configuración de impresión */}
      {isConfigTab && <ImpresionDefaultsPanel />}

      {/* Lista de plantillas */}
      {!isConfigTab && loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}><CircularProgress /></Box>
      ) : !isConfigTab && filtered.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center' }}>
          <Print sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography color="text.secondary" gutterBottom>
            No hay plantillas de tipo {TIPOS[tab]?.label}.
          </Typography>
          <Button variant="contained" startIcon={<Add />}
            onClick={() => { setEditItem(null); setFormOpen(true); }}>
            Crear plantilla {TIPOS[tab]?.label}
          </Button>
        </Card>
      ) : !isConfigTab ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {filtered.map(p => {
            const tipoInfo = TIPOS.find(t => t.value === p.tipo)!;
            const cfg      = (p.plantilla as unknown) as PlantillaConfig;
            const secVisible = cfg?.sections?.filter(s => s.visible).length ?? 0;
            const secTotal   = cfg?.sections?.length ?? 0;

            return (
              <Card
                key={p.id}
                sx={{
                  borderLeft: '4px solid',
                  borderColor: p.es_default ? tipoInfo.color : 'divider',
                  '&:hover': { boxShadow: 2 },
                }}
              >
                <CardContent sx={{ py: '12px !important', display: 'flex', alignItems: 'center', gap: 2 }}>
                  {/* Icono tipo */}
                  <Box sx={{
                    width: 44, height: 44, borderRadius: 2, flexShrink: 0,
                    bgcolor: p.es_default ? `${tipoInfo.color}20` : 'action.hover',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem',
                  }}>
                    {tipoInfo.icono}
                  </Box>

                  {/* Info */}
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography fontWeight={700}>{p.nombre}</Typography>
                      {p.es_default && (
                        <Chip size="small" label="Predeterminada" color="success" sx={{ height: 18, fontSize: '0.65rem' }} />
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {secVisible}/{secTotal} secciones visibles
                      {cfg?.config?.paperWidth ? ` · ${cfg.config.paperWidth}` : ''}
                      {cfg?.config?.fontSize ? ` · Texto ${cfg.config.fontSize}` : ''}
                    </Typography>
                  </Box>

                  {/* Acciones */}
                  {!p.es_default && (
                    <Tooltip title="Marcar como predeterminada">
                      <IconButton size="small" onClick={() => handleSetDefault(p)}>
                        <StarBorder fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {p.es_default && (
                    <Tooltip title="Es la plantilla predeterminada">
                      <Star fontSize="small" sx={{ color: 'warning.main', mx: 0.5 }} />
                    </Tooltip>
                  )}
                  <Tooltip title="Editar">
                    <IconButton size="small" onClick={() => { setEditItem(p); setFormOpen(true); }}>
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Eliminar">
                    <IconButton size="small" color="error" onClick={() => handleDelete(p)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      ) : null}

      <PlantillaDialog
        open={formOpen}
        item={editItem}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />

      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={toastErr ? 'error' : 'success'} onClose={() => setToast('')}>{toast}</Alert>
      </Snackbar>
    </Box>
  );
}
