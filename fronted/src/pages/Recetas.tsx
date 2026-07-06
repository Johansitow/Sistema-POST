import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid as Grid, Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, IconButton, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, FormControl,
  InputLabel, Chip, LinearProgress, Alert, Stack, InputAdornment,
  Autocomplete, FormHelperText, Tooltip, Divider,
} from '@mui/material';
import {
  MenuBook, Add, Edit, Delete, Close, TrendingUp, TrendingDown,
  Warning, Restaurant, Calculate, Inventory2, Storage, ListAlt, ArrowBack,
  Info, Search, FilterList, Circle,
} from '@mui/icons-material';
import { recetaService, type Receta, type Rentabilidad, type RecetaIngrediente } from '../services/servicios-operacion';
import api from '../services/api';
import { socket } from '../lib/socket';
import { useFeatureFlag } from '../store/featureFlagStore';
import TablaDesgloseRentabilidad, { type DesgloseRentabilidad } from '../components/recetas/TablaDesgloseRentabilidad';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const UNIDADES = ['kilogramo', 'gramo', 'litro', 'mililitro', 'unidad', 'porcion'];

/** Abreviaturas legibles para mostrar en la UI */
const UNIDAD_LABEL: Record<string, string> = {
  kilogramo: 'kg', gramo: 'g', litro: 'L', mililitro: 'mL',
  unidad: 'und', porcion: 'porción',
};
const fmtU = (u: string) => UNIDAD_LABEL[u] ?? u;

const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

// ─── Card Disponibilidad ──────────────────────────────────────────────────────

function DisponibilidadCard({ idReceta }: { idReceta: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [flashUpdate, setFlashUpdate] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    api.get(`/recetas/${idReceta}/disponibilidad`)
      .then(r => { setData(r.data.data); setFlashUpdate(true); setTimeout(() => setFlashUpdate(false), 1500); })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [idReceta]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Refrescar automáticamente cuando el stock cambia
  useEffect(() => {
    socket.on('STOCK_BAJO', fetchData);
    return () => { socket.off('STOCK_BAJO', fetchData); };
  }, [fetchData]);

  if (loading) return <LinearProgress sx={{ borderRadius: 1, mb: 2 }} />;
  if (!data) return null;

  const color = data.disponibilidad > 0 ? '#10b981' : '#ef4444';
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2, borderRadius: 2, borderColor: color, borderWidth: 2, mb: 2,
        transition: 'background-color 0.6s ease',
        bgcolor: flashUpdate ? color + '10' : 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Inventory2 sx={{ fontSize: 18, color }} />
          <Typography variant="subtitle2" fontWeight={700}>Disponibilidad en inventario</Typography>
        </Box>
        <Chip
          label={`${data.disponibilidad} ${fmtU(data.unidad_produccion)} disponibles`}
          size="small"
          sx={{ bgcolor: color + '20', color, fontWeight: 700 }}
        />
      </Box>
      {data.ingrediente_limitante && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          Ingrediente limitante: <strong>{data.ingrediente_limitante.nombre}</strong>
          {' '}(hay menos stock del necesario)
        </Typography>
      )}
      {data.disponibilidad === 0 && (
        <Typography variant="caption" color="error.main" sx={{ mt: 0.5, display: 'block' }}>
          No hay suficiente stock para preparar ni una porción.
        </Typography>
      )}
    </Paper>
  );
}

// ─── Card de Rentabilidad ─────────────────────────────────────────────────────

function RentabilidadCard({ r }: { r: Rentabilidad }) {
  const color = r.es_rentable ? '#10b981' : '#ef4444';
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: color, borderWidth: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Calculate sx={{ fontSize: 18, color }} />
          <Typography variant="subtitle2" fontWeight={700}>Análisis de rentabilidad</Typography>
        </Box>
        <Chip
          icon={r.es_rentable ? <TrendingUp fontSize="small" /> : <TrendingDown fontSize="small" />}
          label={r.es_rentable ? `Rentable · ${r.margen_actual_porcentaje}% margen` : `Sin margen suficiente · ${r.margen_actual_porcentaje}%`}
          size="small"
          sx={{ bgcolor: color + '20', color, fontWeight: 700, '& .MuiChip-icon': { color } }}
        />
      </Box>
      <Grid container spacing={1.5}>
        {[
          { label: 'Costo ingredientes',   val: fmt(r.costo_ingredientes),      help: 'Suma de todos los ingredientes requeridos' },
          { label: 'Costo con merma',      val: fmt(r.costo_con_merma),         help: 'Costo ajustado por pérdidas en preparación' },
          { label: 'Costo por porción',    val: fmt(r.costo_unitario),          bold: true },
          { label: 'Precio mínimo suger.', val: fmt(r.precio_sugerido_minimo),  bold: true, accent: '#0ea5e9', help: 'Precio mínimo para tener 40% de margen' },
          { label: 'Precio de venta actual', val: fmt(r.precio_actual),         bold: true, accent: color },
          { label: 'Diferencia vs mínimo', val: `${r.diferencia_precio >= 0 ? '+' : ''}${fmt(r.diferencia_precio)}`, bold: true, accent: r.diferencia_precio >= 0 ? '#10b981' : '#ef4444' },
        ].map(item => (
          <Grid size={{ xs: 6 }} key={item.label}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary">{item.label}</Typography>
              {(item as any).help && (
                <Tooltip title={(item as any).help} arrow>
                  <Info sx={{ fontSize: 11, color: 'text.disabled', cursor: 'help' }} />
                </Tooltip>
              )}
            </Box>
            <Typography variant="body2" fontWeight={item.bold ? 800 : 400} sx={{ color: (item as any).accent || 'text.primary' }}>
              {item.val}
            </Typography>
          </Grid>
        ))}
      </Grid>
      {r.alerta_rentabilidad && (
        <Alert severity="warning" sx={{ mt: 1.5, py: 0.5, borderRadius: 1.5 }} icon={<Warning fontSize="small" />}>
          <Typography variant="caption">{r.alerta_rentabilidad}</Typography>
        </Alert>
      )}
    </Paper>
  );
}

// ─── Tabla de ingredientes ────────────────────────────────────────────────────

function TablaIngredientes({ ingredientes }: { ingredientes: RecetaIngrediente[] }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'grey.50' }}>
            <TableCell sx={{ fontWeight: 700 }}>Ingrediente</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Cantidad</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Precio unit.</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Costo</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Stock actual</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ingredientes.map((ing: RecetaIngrediente) => {
            const stockSuficiente = Number(ing.producto.stock_actual) >= ing.cantidad;
            return (
              <TableRow key={ing.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" fontWeight={600}>{ing.producto.nombre}</Typography>
                    {ing.es_opcional && (
                      <Chip label="Opcional" size="small" variant="outlined" sx={{ height: 16, fontSize: '0.6rem' }} />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{ing.cantidad} {fmtU(ing.unidad)}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{fmt(ing.producto.precio_unitario)}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={700}>
                    {fmt(ing.cantidad * ing.producto.precio_unitario)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={`${Number(ing.producto.stock_actual).toFixed(1)} ${fmtU(ing.unidad)}`}
                    size="small"
                    color={stockSuficiente ? 'success' : 'error'}
                    variant={stockSuficiente ? 'outlined' : 'filled'}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ─── Detalle de receta ────────────────────────────────────────────────────────

function DetalleReceta({ receta, onEdit }: { receta: Receta; onEdit: () => void }) {
  const rentabilidadEnabled = useFeatureFlag('rentabilidad_recetas');
  const [desglose, setDesglose] = useState<DesgloseRentabilidad | null>(null);

  useEffect(() => {
    if (!rentabilidadEnabled) return;
    api.get(`/recetas/${receta.id}/rentabilidad/desglose`)
      .then(r => setDesglose(r.data.data))
      .catch(() => setDesglose(null));
  }, [receta.id, rentabilidadEnabled]);

  const fases: any[] = (receta as any).fases?.filter((f: any) => f.estado !== 'eliminado') ?? [];
  const tieneFases = fases.length > 0;

  // Agrupar ingredientes por fase si hay fases definidas
  const gruposIngredientes = tieneFases
    ? fases.map(f => ({
        fase: f,
        ingredientes: receta.ingredientes.filter((i: any) => i.numero_fase === f.numero_fase),
      }))
    : [{ fase: null as any, ingredientes: receta.ingredientes }];

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      {/* Encabezado */}
      <Box sx={{ p: 2, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="subtitle1" fontWeight={800}>{receta.nombre_receta}</Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
            <Chip label={`Producto: ${receta.producto_final.nombre}`} size="small" variant="outlined" />
            <Chip label={`Produce: ${receta.cantidad_producida} ${fmtU(receta.unidad_produccion)}`} size="small" variant="outlined" />
            {receta.tiempo_preparacion && (
              <Chip label={`${receta.tiempo_preparacion} min`} size="small" variant="outlined" />
            )}
            {receta.merma_esperada_porcentaje && (
              <Chip label={`${receta.merma_esperada_porcentaje}% merma`} size="small" variant="outlined" sx={{ color: 'warning.main', borderColor: 'warning.main' }} />
            )}
          </Stack>
          {receta.descripcion && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {receta.descripcion}
            </Typography>
          )}
        </Box>
        <Button size="small" startIcon={<Edit />} onClick={onEdit} sx={{ ml: 2, flexShrink: 0 }}>
          Editar
        </Button>
      </Box>

      <Box sx={{ p: 2 }}>
        {/* Disponibilidad */}
        <DisponibilidadCard idReceta={receta.id} />

        {/* Ingredientes agrupados por fase */}
        {gruposIngredientes.map(({ fase, ingredientes }) => (
          <Box key={fase?.numero_fase ?? 'all'} sx={{ mb: 2 }}>
            {fase ? (
              <Box sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Chip
                    label={`Fase ${fase.numero_fase}: ${fase.nombre}`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  {fase.duracion_minutos && (
                    <Chip label={`${fase.duracion_minutos} min`} size="small" variant="outlined" />
                  )}
                  {fase.merma_esperada_porcentaje > 0 && (
                    <Chip label={`${fase.merma_esperada_porcentaje}% merma`} size="small" variant="outlined" sx={{ color: 'warning.main', borderColor: 'warning.main' }} />
                  )}
                </Box>
                {fase.descripcion && (
                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-line', pl: 0.5 }}>
                    {fase.descripcion}
                  </Typography>
                )}
              </Box>
            ) : (
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, display: 'block', mb: 1 }}>
                Ingredientes
              </Typography>
            )}
            {ingredientes.length > 0
              ? <TablaIngredientes ingredientes={ingredientes} />
              : (
                <Typography variant="caption" color="text.disabled" sx={{ pl: 0.5 }}>
                  Sin ingredientes en esta fase
                </Typography>
              )
            }
          </Box>
        ))}

        <Divider sx={{ my: 2 }} />

        {/* Rentabilidad — siempre visible (resumen básico) */}
        <RentabilidadCard r={receta.rentabilidad} />

        {/* Desglose de costos por proveedor — solo si flag activo */}
        {rentabilidadEnabled && desglose && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, display: 'block', mb: 1 }}>
              Desglose de costos (precios de proveedor)
            </Typography>
            <TablaDesgloseRentabilidad desglose={desglose} />
          </Box>
        )}

        {/* Instrucciones generales (si existen y no hay fases que las contengan) */}
        {receta.instrucciones && !tieneFases && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              <ListAlt sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />Instrucciones de preparación
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-line' }}>{receta.instrucciones}</Typography>
          </Box>
        )}

        {/* Instrucciones de almacenamiento */}
        {(receta as any).instrucciones_almacenamiento && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              <Storage sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />Almacenamiento
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-line' }}>
              {(receta as any).instrucciones_almacenamiento}
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

// ─── Modal: Crear/Editar Receta ───────────────────────────────────────────────

interface ProductoOpt { id: number; nombre: string; sku: string; precio_unitario: number; unidad_medida: string; tipo_materia?: string; precio_venta?: number; }

type PasoModal = 'datos' | 'fases';

interface IngFase {
  id_producto: number; nombre: string; cantidad: string; unidad: string;
  precio_unitario: number; es_opcional: boolean;
  tipo_formula: string; factor_formula: string; formula_descripcion: string;
}
interface FaseForm {
  numero_fase: number; nombre: string; descripcion: string;
  duracion_minutos: string; merma_esperada_porcentaje: string;
  ingredientes: IngFase[];
}

function RecetaModal({ open, receta, onClose, onSaved, productoPreseleccionado }: {
  open: boolean; receta: Receta | null; onClose: () => void; onSaved: () => void;
  productoPreseleccionado?: number;
}) {
  const [paso, setPaso]               = useState<PasoModal>('datos');
  const [todosProductos, setTodos]    = useState<ProductoOpt[]>([]);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [preview, setPreview]         = useState<Rentabilidad | null>(null);

  const [form, setForm] = useState({
    id_producto_final:   0,
    nombre_receta:       '',
    descripcion:         '',
    cantidad_producida:  1,
    unidad_produccion:   'porcion',
    medio_refrigeracion: '',
  });

  const [fases, setFases] = useState<FaseForm[]>([]);

  useEffect(() => {
    if (!open) return;
    setError(''); setPaso('datos'); setPreview(null);

    api.get('/productos', { params: { limit: 500 } })
      .then(res => setTodos(res.data.data || []))
      .catch(() => {});

    if (receta) {
      setForm({
        id_producto_final:   receta.id_producto_final,
        nombre_receta:       receta.nombre_receta,
        descripcion:         receta.descripcion || '',
        cantidad_producida:  receta.cantidad_producida,
        unidad_produccion:   receta.unidad_produccion,
        medio_refrigeracion: (receta as any).medio_refrigeracion || '',
      });
      const fasesExistentes: any[] = (receta as any).fases || [];
      if (fasesExistentes.length > 0) {
        setFases(fasesExistentes.map((f: any) => ({
          numero_fase:               f.numero_fase,
          nombre:                    f.nombre,
          descripcion:               f.descripcion,
          duracion_minutos:          f.duracion_minutos?.toString() || '',
          merma_esperada_porcentaje: f.merma_esperada_porcentaje?.toString() || '',
          ingredientes: receta.ingredientes
            .filter((i: any) => i.numero_fase === f.numero_fase)
            .map((i: RecetaIngrediente) => ({
              id_producto: i.id_producto, nombre: i.producto.nombre,
              cantidad: i.cantidad.toString(), unidad: i.unidad,
              precio_unitario: i.producto.precio_unitario, es_opcional: i.es_opcional,
              tipo_formula: (i as any).tipo_formula || '', factor_formula: (i as any).factor_formula?.toString() || '',
              formula_descripcion: (i as any).formula_descripcion || '',
            })),
        })));
      } else {
        // Migrar receta vieja: todos los ingredientes en una fase "Preparación"
        setFases([{
          numero_fase: 1, nombre: 'Preparación',
          descripcion: receta.instrucciones || '',
          duracion_minutos: receta.tiempo_preparacion?.toString() || '',
          merma_esperada_porcentaje: receta.merma_esperada_porcentaje?.toString() || '',
          ingredientes: receta.ingredientes.map((i: RecetaIngrediente) => ({
            id_producto: i.id_producto, nombre: i.producto.nombre,
            cantidad: i.cantidad.toString(), unidad: i.unidad,
            precio_unitario: i.producto.precio_unitario, es_opcional: i.es_opcional,
            tipo_formula: (i as any).tipo_formula || '', factor_formula: (i as any).factor_formula?.toString() || '',
            formula_descripcion: (i as any).formula_descripcion || '',
          })),
        }]);
      }
    } else {
      setForm({ id_producto_final: productoPreseleccionado ?? 0, nombre_receta: '', descripcion: '', cantidad_producida: 1, unidad_produccion: 'porcion', medio_refrigeracion: '' });
      setFases([]);
    }
  }, [open, receta, productoPreseleccionado]);

  // Preview de rentabilidad en tiempo real
  useEffect(() => {
    const allIngs = fases.flatMap(f => f.ingredientes);
    if (allIngs.length === 0 || form.id_producto_final === 0) { setPreview(null); return; }
    const costo     = allIngs.filter(i => !i.es_opcional).reduce((s, i) => s + Number(i.cantidad) * i.precio_unitario, 0);
    const merma     = Math.max(...fases.map(f => Number(f.merma_esperada_porcentaje || 0))) / 100;
    const costoCon  = merma > 0 ? costo / (1 - merma) : costo;
    const costoUnit = costoCon / Number(form.cantidad_producida || 1);
    const sugerido  = Math.ceil(costoUnit / 0.6);
    const prod      = todosProductos.find(p => p.id === form.id_producto_final);
    const actual    = prod?.precio_venta || prod?.precio_unitario || 0;
    const margen    = actual > 0 ? ((actual - costoUnit) / actual) * 100 : 0;
    setPreview({
      costo_ingredientes:       Math.round(costo),
      costo_con_merma:          Math.round(costoCon),
      costo_unitario:           Math.round(costoUnit),
      precio_sugerido_minimo:   sugerido,
      precio_actual:            Math.round(actual),
      margen_actual_porcentaje: Math.round(margen * 100) / 100,
      es_rentable:              margen >= 40,
      diferencia_precio:        Math.round(actual - sugerido),
      alerta_rentabilidad: actual < sugerido
        ? `Precio actual (${fmt(actual)}) está ${fmt(Math.abs(actual - sugerido))} por debajo del mínimo rentable (${fmt(sugerido)})`
        : null,
    });
  }, [fases, form.cantidad_producida, form.id_producto_final, todosProductos]);

  const addFase    = () => setFases(p => [...p, { numero_fase: p.length + 1, nombre: '', descripcion: '', duracion_minutos: '', merma_esperada_porcentaje: '', ingredientes: [] }]);
  const removeFase = (i: number) => setFases(p => p.filter((_, n) => n !== i).map((f, n) => ({ ...f, numero_fase: n + 1 })));
  const updateFase = (i: number, f: string, v: any) => setFases(p => p.map((x, n) => n === i ? { ...x, [f]: v } : x));

  const addIngFase    = (fi: number) => setFases(p => p.map((f, n) => n === fi ? { ...f, ingredientes: [...f.ingredientes, { id_producto: 0, nombre: '', cantidad: '1', unidad: 'kilogramo', precio_unitario: 0, es_opcional: false, tipo_formula: '', factor_formula: '', formula_descripcion: '' }] } : f));
  const removeIngFase = (fi: number, ii: number) => setFases(p => p.map((f, n) => n === fi ? { ...f, ingredientes: f.ingredientes.filter((_, m) => m !== ii) } : f));
  const updateIngFase = (fi: number, ii: number, field: string, v: any) => setFases(p => p.map((f, n) => n === fi ? { ...f, ingredientes: f.ingredientes.map((x, m) => m === ii ? { ...x, [field]: v } : x) } : f));
  const selectProdFase = (fi: number, ii: number, prod: ProductoOpt | null) => {
    if (!prod) return;
    setFases(p => p.map((f, n) => n === fi ? { ...f, ingredientes: f.ingredientes.map((x, m) => m === ii ? { ...x, id_producto: prod.id, nombre: prod.nombre, precio_unitario: prod.precio_unitario, unidad: prod.unidad_medida } : x) } : f));
  };

  const productosFinal = todosProductos.filter(p => p.tipo_materia === 'procesada' || (p as any).es_vendible);

  // Resumen de lo configurado en el paso 1 (para mostrar en paso 2)
  const productoFinalNombre = todosProductos.find(p => p.id === form.id_producto_final)?.nombre;
  const totalIngredientes = fases.flatMap(f => f.ingredientes).length;

  const handleSave = async () => {
    if (!form.id_producto_final) { setError('Selecciona el producto final'); return; }
    if (!form.nombre_receta.trim()) { setError('El nombre de la receta es requerido'); return; }
    if (fases.length === 0) { setError('Agrega al menos una fase'); return; }
    if (fases.some(f => !f.nombre.trim())) { setError('Todas las fases deben tener un nombre'); return; }
    if (fases.some(f => !f.descripcion.trim())) { setError('Todas las fases deben tener instrucción de preparación'); return; }
    const allIngs = fases.flatMap(f => f.ingredientes);
    if (allIngs.length === 0) { setError('Agrega ingredientes en al menos una fase'); return; }
    if (allIngs.some(i => i.id_producto === 0)) { setError('Todos los ingredientes deben tener un producto seleccionado'); return; }
    setSaving(true); setError('');
    try {
      const maxMerma = fases.reduce((m, f) => Math.max(m, Number(f.merma_esperada_porcentaje || 0)), 0);
      const payload = {
        ...form,
        merma_esperada_porcentaje: maxMerma || undefined,
        instrucciones: fases.map(f => `Fase ${f.numero_fase} - ${f.nombre}: ${f.descripcion}`).join('\n\n'),
        ingredientes: fases.flatMap((f, fi) => f.ingredientes.map((i, idx) => ({
          id_producto:         i.id_producto,
          cantidad:            Number(i.cantidad),
          unidad:              i.unidad,
          es_opcional:         i.es_opcional,
          orden:               fi * 100 + idx,
          numero_fase:         f.numero_fase,
          tipo_formula:        i.tipo_formula || undefined,
          factor_formula:      i.factor_formula ? Number(i.factor_formula) : undefined,
          formula_descripcion: i.formula_descripcion || undefined,
        }))),
        fases: fases.map(f => ({
          numero_fase:               f.numero_fase,
          nombre:                    f.nombre,
          descripcion:               f.descripcion,
          duracion_minutos:          f.duracion_minutos ? Number(f.duracion_minutos) : undefined,
          merma_esperada_porcentaje: f.merma_esperada_porcentaje ? Number(f.merma_esperada_porcentaje) : undefined,
        })),
      };
      if (receta) {
        await recetaService.update(receta.id, payload as any);
        await recetaService.updateIngredientes(receta.id, payload.ingredientes);
      } else {
        await recetaService.create(payload as any);
      }
      onSaved(); onClose();
    } catch (e: any) { setError(e.response?.data?.error || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            {receta ? 'Editar receta' : 'Nueva receta'}
          </Typography>
          {/* Indicador de pasos */}
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
            <Chip
              label="1. Datos generales"
              onClick={() => setPaso('datos')}
              color={paso === 'datos' ? 'primary' : 'default'}
              variant={paso === 'datos' ? 'filled' : 'outlined'}
              size="small"
              sx={{ cursor: 'pointer' }}
            />
            <Chip
              label="2. Fases e ingredientes"
              onClick={() => { setError(''); setPaso('fases'); }}
              color={paso === 'fases' ? 'primary' : 'default'}
              variant={paso === 'fases' ? 'filled' : 'outlined'}
              size="small"
              sx={{ cursor: 'pointer' }}
            />
          </Box>
        </Box>
        <IconButton onClick={onClose}><Close /></IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* ─── PASO 1: DATOS GENERALES ─── */}
        {paso === 'datos' && (
          <Grid container spacing={2}>
            {productoPreseleccionado && !receta && (
              <Grid size={{ xs: 12 }}>
                <Alert severity="info" icon={<Restaurant />}>
                  Producto terminado creado. Define la receta para calcular el <strong>costo</strong> y <strong>disponibilidad</strong> automáticamente.
                </Alert>
              </Grid>
            )}
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Producto final que produce esta receta *</InputLabel>
                <Select
                  value={form.id_producto_final || ''}
                  label="Producto final que produce esta receta *"
                  onChange={e => setForm(p => ({ ...p, id_producto_final: Number(e.target.value) }))}
                  disabled={!!receta}
                >
                  {(receta ? todosProductos : productosFinal).map(p => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.nombre}
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>({p.sku})</Typography>
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>El plato o preparación que resulta de esta receta</FormHelperText>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                label="Nombre de la receta *"
                fullWidth size="small"
                value={form.nombre_receta}
                onChange={e => setForm(p => ({ ...p, nombre_receta: e.target.value }))}
                helperText="Ej: Hamburguesa clásica, Salsa de la casa, Limonada de menta"
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                label="Descripción (opcional)"
                fullWidth size="small" multiline rows={2}
                value={form.descripcion}
                onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                helperText="Breve descripción de la receta para referencia del equipo"
              />
            </Grid>

            <Grid size={{ xs: 6 }}>
              <TextField
                label="Porciones que produce"
                type="number" fullWidth size="small"
                value={form.cantidad_producida}
                onChange={e => setForm(p => ({ ...p, cantidad_producida: Number(e.target.value) }))}
                helperText="Cuántas unidades o porciones resultan de la receta completa"
                inputProps={{ min: 1 }}
              />
            </Grid>

            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Unidad de producción</InputLabel>
                <Select
                  value={form.unidad_produccion}
                  label="Unidad de producción"
                  onChange={e => setForm(p => ({ ...p, unidad_produccion: e.target.value }))}
                >
                  {UNIDADES.map(u => <MenuItem key={u} value={u}>{fmtU(u)} — {u}</MenuItem>)}
                </Select>
                <FormHelperText>Unidad en que se mide el resultado final</FormHelperText>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                label="Condición de almacenamiento (opcional)"
                fullWidth size="small"
                value={form.medio_refrigeracion}
                onChange={e => setForm(p => ({ ...p, medio_refrigeracion: e.target.value }))}
                placeholder="Ej: Refrigerado a 4°C, Congelado, Temperatura ambiente"
                helperText="Cómo se debe guardar el producto terminado"
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Storage sx={{ fontSize: 16, color: 'text.secondary' }} /></InputAdornment>,
                }}
              />
            </Grid>
          </Grid>
        )}

        {/* ─── PASO 2: FASES E INGREDIENTES ─── */}
        {paso === 'fases' && (
          <Box>
            {/* Resumen del paso 1 */}
            {form.nombre_receta && (
              <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2, bgcolor: 'primary.50', borderColor: 'primary.200' }}>
                <Typography variant="caption" color="primary.main" fontWeight={700}>RECETA CONFIGURADA</Typography>
                <Typography variant="body2" fontWeight={600}>{form.nombre_receta}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {productoFinalNombre && `Producto: ${productoFinalNombre} · `}
                  Produce: {form.cantidad_producida} {fmtU(form.unidad_produccion)}
                  {totalIngredientes > 0 && ` · ${totalIngredientes} ingredientes cargados`}
                </Typography>
              </Paper>
            )}

            <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }} icon={<Info />}>
              <Typography variant="caption" fontWeight={700} display="block">¿Qué son las fases?</Typography>
              <Typography variant="caption">
                Una <strong>fase</strong> es una etapa del proceso de preparación (ej: "Cocción", "Montaje", "Refrigeración").
                Cada fase tiene sus propios ingredientes, tiempo estimado y % de pérdida (<em>merma</em>).
                Si tu receta es simple, usa una sola fase llamada "Preparación".
              </Typography>
            </Alert>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                Fases de preparación {fases.length > 0 && `(${fases.length})`}
              </Typography>
              <Button size="small" startIcon={<Add />} onClick={addFase} variant="outlined">
                Agregar fase
              </Button>
            </Box>

            <Stack spacing={3}>
              {fases.map((fase, fi) => (
                <Paper key={fi} variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: 'primary.light' }}>
                  {/* Header de la fase */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Chip label={`Fase ${fase.numero_fase}`} size="small" color="primary" />
                    <IconButton size="small" color="error" onClick={() => removeFase(fi)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>

                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 8 }}>
                      <TextField
                        size="small" label="Nombre de la fase *" fullWidth
                        value={fase.nombre}
                        onChange={e => updateFase(fi, 'nombre', e.target.value)}
                        placeholder="Ej: Preparación, Cocción, Montaje"
                      />
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <TextField
                        size="small" label="Tiempo estimado (min)" type="number" fullWidth
                        value={fase.duracion_minutos}
                        onChange={e => updateFase(fi, 'duracion_minutos', e.target.value)}
                        placeholder="Ej: 15"
                      />
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                      <TextField
                        size="small" label="Instrucciones de esta fase *" fullWidth multiline rows={2}
                        value={fase.descripcion}
                        onChange={e => updateFase(fi, 'descripcion', e.target.value)}
                        placeholder="Describe qué se hace en esta etapa de preparación..."
                        helperText="Indica los pasos a seguir durante esta fase"
                      />
                    </Grid>

                    <Grid size={{ xs: 5 }}>
                      <TextField
                        size="small" label="Merma esperada" type="number" fullWidth
                        value={fase.merma_esperada_porcentaje}
                        onChange={e => updateFase(fi, 'merma_esperada_porcentaje', e.target.value)}
                        helperText="Pérdida por cocción, corte u otras causas"
                        InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                        inputProps={{ min: 0, max: 99 }}
                        placeholder="0"
                      />
                    </Grid>

                    {/* Ingredientes de esta fase */}
                    <Grid size={{ xs: 12 }}>
                      <Divider sx={{ my: 1 }} />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Ingredientes de esta fase ({fase.ingredientes.length})
                        </Typography>
                        <Button size="small" startIcon={<Add />} onClick={() => addIngFase(fi)} sx={{ fontSize: '0.7rem' }}>
                          Agregar ingrediente
                        </Button>
                      </Box>

                      <Stack spacing={1}>
                        {fase.ingredientes.map((ing, ii) => (
                          <Paper key={ii} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'grey.50' }}>
                            <Grid container spacing={1} alignItems="flex-start">
                              <Grid size={{ xs: 12, sm: 5 }}>
                                <Autocomplete
                                  size="small"
                                  options={todosProductos}
                                  getOptionLabel={p => `${p.nombre} (${p.sku})`}
                                  value={todosProductos.find(p => p.id === ing.id_producto) || null}
                                  onChange={(_, v) => selectProdFase(fi, ii, v)}
                                  renderInput={params => <TextField {...params} label="Ingrediente *" placeholder="Buscar por nombre o SKU" />}
                                  isOptionEqualToValue={(opt, val) => opt.id === val.id}
                                />
                              </Grid>
                              <Grid size={{ xs: 5, sm: 2 }}>
                                <TextField
                                  size="small" label="Cantidad" type="number" fullWidth
                                  value={ing.cantidad}
                                  onChange={e => updateIngFase(fi, ii, 'cantidad', e.target.value)}
                                  inputProps={{ min: 0, step: 0.1 }}
                                />
                              </Grid>
                              <Grid size={{ xs: 7, sm: 3 }}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>Unidad</InputLabel>
                                  <Select
                                    value={ing.unidad}
                                    label="Unidad"
                                    onChange={e => updateIngFase(fi, ii, 'unidad', e.target.value)}
                                  >
                                    {UNIDADES.map(u => <MenuItem key={u} value={u}>{fmtU(u)} — {u}</MenuItem>)}
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid size={{ xs: 12, sm: 2 }} sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                                <IconButton size="small" color="error" onClick={() => removeIngFase(fi, ii)}>
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Grid>
                              <Grid size={{ xs: 12 }} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                {ing.precio_unitario > 0 ? (
                                  <Typography variant="caption" color="text.secondary">
                                    Costo estimado: <strong>{fmt(Number(ing.cantidad) * ing.precio_unitario)}</strong>
                                  </Typography>
                                ) : (
                                  <Typography variant="caption" color="text.disabled">
                                    Selecciona el ingrediente para ver el costo
                                  </Typography>
                                )}
                                <Tooltip title={ing.es_opcional ? 'Clic para marcar como requerido' : 'Clic para marcar como opcional'}>
                                  <Chip
                                    label={ing.es_opcional ? 'Opcional' : 'Requerido'}
                                    size="small"
                                    color={ing.es_opcional ? 'default' : 'primary'}
                                    onClick={() => updateIngFase(fi, ii, 'es_opcional', !ing.es_opcional)}
                                    sx={{ cursor: 'pointer' }}
                                  />
                                </Tooltip>
                              </Grid>
                            </Grid>
                          </Paper>
                        ))}

                        {fase.ingredientes.length === 0 && (
                          <Box sx={{ p: 2, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 1.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              Sin ingredientes — haz clic en "Agregar ingrediente" para empezar
                            </Typography>
                          </Box>
                        )}
                      </Stack>
                    </Grid>
                  </Grid>
                </Paper>
              ))}

              {fases.length === 0 && (
                <Box sx={{ p: 5, textAlign: 'center', border: '2px dashed', borderColor: 'divider', borderRadius: 2 }}>
                  <ListAlt sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary" variant="body2" sx={{ mb: 0.5 }}>
                    Todavía no has agregado fases
                  </Typography>
                  <Typography color="text.disabled" variant="caption" display="block" sx={{ mb: 2 }}>
                    Empieza con una fase "Preparación" y luego agrega los ingredientes
                  </Typography>
                  <Button size="small" startIcon={<Add />} onClick={addFase} variant="contained">
                    Agregar primera fase
                  </Button>
                </Box>
              )}
            </Stack>

            {/* Preview de rentabilidad */}
            {preview && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Vista previa — se actualiza a medida que agregas ingredientes
                </Typography>
                <RentabilidadCard r={preview} />
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} color="inherit">Cancelar</Button>
        {paso === 'fases' && (
          <Button startIcon={<ArrowBack />} onClick={() => { setError(''); setPaso('datos'); }}>
            Volver a datos
          </Button>
        )}
        {paso === 'datos'
          ? (
            <Button
              variant="contained"
              onClick={() => {
                if (!form.id_producto_final) { setError('Selecciona el producto final'); return; }
                if (!form.nombre_receta.trim()) { setError('El nombre de la receta es requerido'); return; }
                setError(''); setPaso('fases');
              }}
            >
              Siguiente: fases e ingredientes →
            </Button>
          ) : (
            <Button variant="contained" color="success" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : receta ? 'Guardar cambios' : 'Crear receta'}
            </Button>
          )
        }
      </DialogActions>
    </Dialog>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

type FiltroReceta = 'todas' | 'rentables' | 'sin_margen';
type OrdenReceta  = 'nombre' | 'margen' | 'costo';

export function Recetas() {
  const location = useLocation();
  const [recetas, setRecetas]               = useState<Receta[]>([]);
  const [loading, setLoading]               = useState(true);
  const [modal, setModal]                   = useState(false);
  const [recetaEdit, setRecetaEdit]         = useState<Receta | null>(null);
  const [seleccionada, setSeleccionada]     = useState<Receta | null>(null);
  const [productoPresel, setProductoPresel] = useState<number | undefined>(undefined);
  const estadoProcesadoRef                  = useRef(false);

  // Búsqueda, filtro y ordenamiento
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro]     = useState<FiltroReceta>('todas');
  const [ordenar, setOrdenar]   = useState<OrdenReceta>('nombre');
  const [socketVivo, setSocketVivo] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await recetaService.getAll({ limit: 100 });
      setRecetas(data);
      if (data.length > 0) {
        setSeleccionada((prev: Receta | null) =>
          prev ? (data.find((r: Receta) => r.id === prev.id) || data[0]) : data[0]
        );
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // WebSocket: refrescar lista cuando cambia el stock
  useEffect(() => {
    const handleStockBajo = () => { load(); };
    const handleConnect   = () => setSocketVivo(true);
    const handleDisconnect = () => setSocketVivo(false);

    socket.on('connect',    handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('STOCK_BAJO', handleStockBajo);
    setSocketVivo(socket.connected);

    return () => {
      socket.off('connect',    handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('STOCK_BAJO', handleStockBajo);
    };
  }, [load]);

  // Abrir modal automáticamente si venimos de crear un Producto en Inventario
  useEffect(() => {
    const nuevoProductoId = (location.state as any)?.nuevoProductoId;
    if (nuevoProductoId && !estadoProcesadoRef.current) {
      estadoProcesadoRef.current = true;
      setProductoPresel(nuevoProductoId);
      setRecetaEdit(null);
      setModal(true);
    }
  }, [location.state]);

  // Lista filtrada y ordenada (recalculada solo cuando cambia algo)
  const recetasFiltradas = useMemo(() => {
    let res = recetas;

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      res = res.filter(r =>
        r.nombre_receta.toLowerCase().includes(q) ||
        r.producto_final.nombre.toLowerCase().includes(q)
      );
    }

    if (filtro === 'rentables')  res = res.filter(r =>  r.rentabilidad.es_rentable);
    if (filtro === 'sin_margen') res = res.filter(r => !r.rentabilidad.es_rentable);

    return [...res].sort((a, b) => {
      if (ordenar === 'nombre') return a.nombre_receta.localeCompare(b.nombre_receta, 'es');
      if (ordenar === 'margen') return b.rentabilidad.margen_actual_porcentaje - a.rentabilidad.margen_actual_porcentaje;
      if (ordenar === 'costo')  return a.rentabilidad.costo_unitario - b.rentabilidad.costo_unitario;
      return 0;
    });
  }, [recetas, busqueda, filtro, ordenar]);

  const rentables   = recetas.filter(r =>  r.rentabilidad.es_rentable).length;
  const noRentables = recetas.filter(r => !r.rentabilidad.es_rentable).length;

  return (
    <Box sx={{ p: 3 }}>
      {/* Encabezado */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ p: 1.5, borderRadius: 2, background: 'linear-gradient(135deg, #f59e0b, #ef4444)', display: 'flex' }}>
            <MenuBook sx={{ color: 'white', fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={800}>Recetas de producción</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Ingredientes, costos por porción y análisis de rentabilidad
              </Typography>
              <Chip
                icon={<Circle sx={{ fontSize: '8px !important', animation: socketVivo ? 'pulse 2s infinite' : 'none' }} />}
                label={socketVivo ? 'En vivo' : 'Sin conexión'}
                size="small"
                variant="outlined"
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  color: socketVivo ? '#10b981' : 'text.disabled',
                  borderColor: socketVivo ? '#10b981' : 'divider',
                  '& .MuiChip-icon': { color: socketVivo ? '#10b981' : 'text.disabled' },
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.3 },
                  },
                }}
              />
            </Box>
          </Box>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => { setRecetaEdit(null); setModal(true); }}>
          Nueva receta
        </Button>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total recetas',      val: recetas.length, color: '#6366f1', help: '' },
          { label: 'Con margen ≥ 40%',   val: rentables,      color: '#10b981', help: '' },
          { label: 'Sin margen mínimo',  val: noRentables,    color: '#ef4444', help: '' },
        ].map(s => (
          <Grid size={{ xs: 4 }} key={s.label}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, textAlign: 'center', borderColor: s.color }}>
              <Typography variant="h4" fontWeight={800} sx={{ color: s.color }}>{s.val}</Typography>
              <Typography variant="caption" color="text.secondary">{s.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {loading ? <LinearProgress sx={{ borderRadius: 1 }} /> : (
        <Grid container spacing={3}>
          {/* Lista de recetas */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>

              {/* Barra de búsqueda */}
              <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <TextField
                  size="small" fullWidth
                  placeholder="Buscar por nombre o producto..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search sx={{ fontSize: 18, color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                    endAdornment: busqueda && (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setBusqueda('')}>
                          <Close fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>

              {/* Filtros y orden */}
              <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                <FilterList sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />
                {([
                  { val: 'todas',      label: `Todas (${recetas.length})` },
                  { val: 'rentables',  label: `✓ Rentables (${rentables})` },
                  { val: 'sin_margen', label: `✗ Sin margen (${noRentables})` },
                ] as const).map(op => (
                  <Chip
                    key={op.val}
                    label={op.label}
                    size="small"
                    variant={filtro === op.val ? 'filled' : 'outlined'}
                    color={filtro === op.val ? 'primary' : 'default'}
                    onClick={() => setFiltro(op.val)}
                    sx={{ cursor: 'pointer', fontSize: '0.68rem' }}
                  />
                ))}
              </Box>

              {/* Ordenamiento */}
              <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  Ordenar:
                </Typography>
                <FormControl size="small" sx={{ flex: 1 }}>
                  <Select
                    value={ordenar}
                    onChange={e => setOrdenar(e.target.value as OrdenReceta)}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    <MenuItem value="nombre">Nombre A→Z</MenuItem>
                    <MenuItem value="margen">Mayor margen primero</MenuItem>
                    <MenuItem value="costo">Menor costo primero</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {/* Resultados */}
              <Box sx={{ p: 1.5, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary">
                  {recetasFiltradas.length === recetas.length
                    ? `${recetas.length} recetas`
                    : `${recetasFiltradas.length} de ${recetas.length} recetas`}
                </Typography>
              </Box>

              {recetas.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <MenuBook sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary" variant="body2" sx={{ mb: 1 }}>
                    No hay recetas creadas aún
                  </Typography>
                  <Button size="small" variant="outlined" onClick={() => { setRecetaEdit(null); setModal(true); }}>
                    Crear primera receta
                  </Button>
                </Box>
              ) : recetasFiltradas.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Search sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary" variant="body2">
                    No hay resultados para "{busqueda}"
                  </Typography>
                  <Button size="small" sx={{ mt: 1 }} onClick={() => { setBusqueda(''); setFiltro('todas'); }}>
                    Limpiar filtros
                  </Button>
                </Box>
              ) : recetasFiltradas.map(r => {
                const esSeleccionada = seleccionada?.id === r.id;
                const numFases = (r as any).fases?.length ?? 0;
                return (
                  <Box
                    key={r.id}
                    onClick={() => setSeleccionada(r)}
                    sx={{
                      p: 2, cursor: 'pointer',
                      borderBottom: '1px solid', borderColor: 'divider',
                      bgcolor: esSeleccionada ? 'primary.50' : 'transparent',
                      borderLeft: `3px solid ${esSeleccionada ? '#6366f1' : 'transparent'}`,
                      '&:hover': { bgcolor: esSeleccionada ? 'primary.50' : 'action.hover' },
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={700} noWrap>{r.nombre_receta}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap display="block">
                          {r.producto_final.nombre}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {r.ingredientes.length} ingredientes
                          {numFases > 0 && ` · ${numFases} fase${numFases > 1 ? 's' : ''}`}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', ml: 1, gap: 0.5 }}>
                        <Chip
                          icon={r.rentabilidad.es_rentable ? <TrendingUp fontSize="small" /> : <TrendingDown fontSize="small" />}
                          label={`${r.rentabilidad.margen_actual_porcentaje}%`}
                          size="small"
                          sx={{
                            bgcolor: r.rentabilidad.es_rentable ? '#10b98120' : '#ef444420',
                            color:   r.rentabilidad.es_rentable ? '#10b981'   : '#ef4444',
                            fontWeight: 700,
                            '& .MuiChip-icon': { color: r.rentabilidad.es_rentable ? '#10b981' : '#ef4444' },
                          }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          {fmt(r.rentabilidad.costo_unitario)} / {fmtU(r.unidad_produccion)}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </Paper>
          </Grid>

          {/* Detalle */}
          <Grid size={{ xs: 12, md: 8 }}>
            {seleccionada ? (
              <DetalleReceta
                receta={seleccionada}
                onEdit={() => { setRecetaEdit(seleccionada); setModal(true); }}
              />
            ) : (
              <Paper variant="outlined" sx={{ borderRadius: 2, p: 5, textAlign: 'center' }}>
                <Restaurant sx={{ fontSize: 52, color: 'text.disabled', mb: 1 }} />
                <Typography color="text.secondary">
                  Selecciona una receta de la lista para ver su detalle
                </Typography>
              </Paper>
            )}
          </Grid>
        </Grid>
      )}

      <RecetaModal
        open={modal}
        receta={recetaEdit}
        productoPreseleccionado={productoPresel}
        onClose={() => { setModal(false); setProductoPresel(undefined); }}
        onSaved={() => { load(); setModal(false); setProductoPresel(undefined); }}
      />
    </Box>
  );
}

export default Recetas;
