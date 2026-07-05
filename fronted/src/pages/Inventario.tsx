/**
 * Inventario - Lista de Productos + Movimientos
 *
 * Cambios v4:
 * 1. Modal Producto rediseñado: selector de tipo (Materia Prima / Procesada / Terminado)
 * 2. SKU auto-generado desde el nombre con prefijo por tipo (MP / MPP / PT)
 * 3. Precio unitario bloqueado para materias primas procesadas (se calcula desde receta)
 * 4. Creación rápida de categorías desde el modal (botón "+ Nueva categoría")
 * 5. Tabla dividida en 3 secciones: Materias Primas / M.P. Procesadas / Terminados
 * 6. Modal movimiento: tipo 'produccion' + responsable + vida útil
 * 7. Columna Disponibilidad con cálculo bajo demanda para productos vendibles
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Edit2, Trash2, Package, AlertCircle,
  X, Check, ChevronDown, RefreshCw, BarChart2, Archive,
  Thermometer, ShoppingBag, Filter, TruckIcon, ArrowUpCircle,
  ArrowDownCircle, Hash, Users, Calculator, Layers, LayoutGrid,
  History, ChevronUp, AlertTriangle,
} from 'lucide-react';
import ModalHeader from '../components/common/ModalHeader';
import { productosService, Producto, ProductoCreateDTO, ProductoUpdateDTO } from '../services/productos.service';
import { categoriasService, Categoria } from '../services/categorias.service';
import { inventarioService } from '../services/inventario.service';
import { proveedorService, Proveedor } from '../services/servicios-gestion';
import { usuariosService } from '../services/usuarios.service';
import { variantesService, type ProductoVariante, type CreateVarianteDto } from '../services/variantes.service';
import api from '../services/api';
import { formatCurrency, ESTADOS } from '../utils';
import { ConfirmDialog, EmptyState, TableSkeleton } from '../components/common';
import { useUIStore } from '../store/uiStore';
import { useFeatureFlag } from '../store/featureFlagStore';

type ModalMode = 'create' | 'edit' | null;

interface FormData {
  sku: string; nombre: string; descripcion: string; id_categoria: string;
  tipo_materia: 'prima' | 'procesada';
  unidad_medida: 'unidad' | 'gramo' | 'kilogramo' | 'litro' | 'mililitro' | 'porcion';
  precio_unitario: string; precio_venta: string;
  stock_actual: string; stock_minimo: string; stock_maximo: string;
  requiere_refrigeracion: boolean; es_vendible: boolean;
  estado: 'activo' | 'inactivo';
}

const FORM_DEFAULTS: FormData = {
  sku: '', nombre: '', descripcion: '', id_categoria: '',
  tipo_materia: 'prima', unidad_medida: 'unidad',
  precio_unitario: '', precio_venta: '',
  stock_actual: '0', stock_minimo: '0', stock_maximo: '',
  requiere_refrigeracion: false, es_vendible: false, estado: 'activo',
};

// ============================================================================
// TIPOS Y HELPERS — MODAL DE PRODUCTO
// ============================================================================
type TipoProducto = 'prima' | 'procesada' | 'terminado';

const TIPO_PRODUCTO_CONFIG: Record<TipoProducto, {
  label: string; sub: string;
  headerGradient: string; borderClass: string; hoverClass: string;
  tipo_materia: 'prima' | 'procesada'; es_vendible: boolean;
  prefix: string; precioBloqueado: boolean;
}> = {
  prima: {
    label: 'Materia Prima',
    sub: 'Ingrediente crudo o insumo directo del proveedor',
    headerGradient: 'from-blue-600 to-indigo-600',
    borderClass: 'border-blue-300', hoverClass: 'hover:bg-blue-50',
    tipo_materia: 'prima', es_vendible: false,
    prefix: 'MP', precioBloqueado: false,
  },
  procesada: {
    label: 'M. Prima Procesada',
    sub: 'Ingrediente elaborado a partir de una receta interna',
    headerGradient: 'from-violet-600 to-purple-600',
    borderClass: 'border-violet-300', hoverClass: 'hover:bg-violet-50',
    tipo_materia: 'procesada', es_vendible: false,
    prefix: 'MPP', precioBloqueado: true,
  },
  terminado: {
    label: 'Producto Terminado',
    sub: 'Producto final listo para vender al cliente',
    headerGradient: 'from-emerald-600 to-teal-600',
    borderClass: 'border-emerald-300', hoverClass: 'hover:bg-emerald-50',
    tipo_materia: 'procesada', es_vendible: true,
    prefix: 'PT', precioBloqueado: false,
  },
};

const TIPO_ICONS: Record<TipoProducto, React.ReactNode> = {
  prima:     <Package     className="w-6 h-6" />,
  procesada: <Layers      className="w-6 h-6" />,
  terminado: <ShoppingBag className="w-6 h-6" />,
};

function generarSKU(nombre: string, tipo: TipoProducto): string {
  const cfg = TIPO_PRODUCTO_CONFIG[tipo];
  const slug = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .trim();
  const palabras = slug.split(/\s+/).filter(Boolean);
  if (!palabras.length) return cfg.prefix + '-';
  const codigo = palabras.slice(0, 3).map(p => p.substring(0, 4)).join('');
  return `${cfg.prefix}-${codigo}`;
}

function inferirTipo(p: Producto): TipoProducto {
  if (p.es_vendible) return 'terminado';
  if (p.tipo_materia === 'procesada') return 'procesada';
  return 'prima';
}

// ============================================================================
// MODAL DE DISPONIBILIDAD — carga bajo demanda para productos vendibles
// ============================================================================
interface DisponibilidadModalProps {
  producto: Producto;
  onClose: () => void;
}

const DisponibilidadModal: React.FC<DisponibilidadModalProps> = ({ producto, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData]       = useState<any>(null);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const recipesRes = await api.get(`/recetas?id_producto=${producto.id}&limit=1`);
        const recipes: any[] = recipesRes.data?.data ?? [];
        if (recipes.length === 0) {
          setError('Este producto no tiene una receta asociada. Créala en el módulo de Recetas para ver la disponibilidad.');
          return;
        }
        const dispRes = await api.get(`/recetas/${recipes[0].id}/disponibilidad`);
        setData(dispRes.data?.data ?? dispRes.data);
      } catch (e: any) {
        setError(e.message || 'Error al calcular disponibilidad');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [producto.id]);

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 1400 }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <ModalHeader
          title={producto.nombre}
          subtitle="Disponibilidad"
          onClose={onClose}
          gradient="from-teal-600 to-emerald-600"
        />

        <div className="p-6">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-8">
              <RefreshCw className="w-8 h-8 text-teal-500 animate-spin" />
              <p className="text-slate-500 text-sm">Calculando disponibilidad...</p>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <p className="text-slate-600 text-sm">{error}</p>
            </div>
          )}
          {data && !loading && (
            <div className="space-y-4">
              <div className="text-center py-4 bg-gradient-to-br from-teal-50 to-emerald-50 rounded-xl border border-teal-100">
                <p className="text-sm text-slate-500 mb-1">Puedes preparar hoy</p>
                <p className="text-5xl font-black text-teal-700">{Math.floor(Number(data.disponibilidad ?? 0))}</p>
                <p className="text-sm text-teal-600 font-semibold mt-1">{producto.unidad_medida}</p>
              </div>
              {data.limitante && (
                <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700">Ingrediente limitante</p>
                    <p className="text-sm text-amber-800">{data.limitante.nombre}</p>
                  </div>
                </div>
              )}
              {data.detalle_ingredientes && data.detalle_ingredientes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Detalle por ingrediente</p>
                  <div className="space-y-2">
                    {data.detalle_ingredientes.map((ing: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                        <span className="text-sm text-slate-700">{ing.nombre}</span>
                        <span className={`text-sm font-semibold ${ing.suficiente === false ? 'text-red-500' : ing.es_limitante ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {Math.floor(Number(ing.unidades_posibles ?? 0))} uds
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button onClick={onClose} className="w-full py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MODAL MOVIMIENTO — con selector de proveedor para entradas
// ============================================================================
interface MovimientoModalProps {
  producto: Producto;
  onClose: () => void;
  onSave: (loteGenerado?: string) => void;
}

const TIPOS_MOVIMIENTO = [
  {
    value: 'entrada',    label: 'Entrada',    requiereProveedor: true,  esPositivo: true,
    icon:       <ArrowUpCircle   className="w-4 h-4" />,
    iconBig:    <ArrowUpCircle   className="w-5 h-5 text-white" />,
    active:     'border-emerald-500 bg-emerald-50 text-emerald-700',
    iconBg:     'bg-emerald-100 text-emerald-600',
    iconBgActive:'bg-white/25',
    header:     'from-emerald-600 to-teal-600',
    btn:        'from-emerald-600 to-teal-600',
    ring:       'focus:ring-emerald-400',
    lote:       'border-emerald-200 bg-emerald-50/40',
    loteTit:    'text-emerald-700',
  },
  {
    value: 'produccion', label: 'Producción', requiereProveedor: false, esPositivo: true,
    icon:       <Layers          className="w-4 h-4" />,
    iconBig:    <Layers          className="w-5 h-5 text-white" />,
    active:     'border-teal-500 bg-teal-50 text-teal-700',
    iconBg:     'bg-teal-100 text-teal-600',
    iconBgActive:'bg-white/25',
    header:     'from-teal-600 to-cyan-600',
    btn:        'from-teal-600 to-cyan-600',
    ring:       'focus:ring-teal-400',
    lote:       'border-teal-200 bg-teal-50/40',
    loteTit:    'text-teal-700',
  },
  {
    value: 'salida',     label: 'Salida',     requiereProveedor: false, esPositivo: false,
    icon:       <ArrowDownCircle className="w-4 h-4" />,
    iconBig:    <ArrowDownCircle className="w-5 h-5 text-white" />,
    active:     'border-red-500 bg-red-50 text-red-700',
    iconBg:     'bg-red-100 text-red-600',
    iconBgActive:'bg-white/25',
    header:     'from-red-600 to-rose-600',
    btn:        'from-red-600 to-rose-600',
    ring:       'focus:ring-red-400',
    lote:       '',
    loteTit:    '',
  },
  {
    value: 'ajuste',     label: 'Ajuste',     requiereProveedor: false, esPositivo: null,
    icon:       <Hash            className="w-4 h-4" />,
    iconBig:    <Hash            className="w-5 h-5 text-white" />,
    active:     'border-blue-500 bg-blue-50 text-blue-700',
    iconBg:     'bg-blue-100 text-blue-600',
    iconBgActive:'bg-white/25',
    header:     'from-blue-600 to-indigo-600',
    btn:        'from-blue-600 to-indigo-600',
    ring:       'focus:ring-blue-400',
    lote:       '',
    loteTit:    '',
  },
  {
    value: 'merma',      label: 'Merma',      requiereProveedor: false, esPositivo: false,
    icon:       <Trash2          className="w-4 h-4" />,
    iconBig:    <Trash2          className="w-5 h-5 text-white" />,
    active:     'border-amber-500 bg-amber-50 text-amber-700',
    iconBg:     'bg-amber-100 text-amber-600',
    iconBgActive:'bg-white/25',
    header:     'from-amber-500 to-orange-500',
    btn:        'from-amber-500 to-orange-500',
    ring:       'focus:ring-amber-400',
    lote:       '',
    loteTit:    '',
  },
  {
    value: 'devolucion', label: 'Devolución', requiereProveedor: false, esPositivo: true,
    icon:       <RefreshCw       className="w-4 h-4" />,
    iconBig:    <RefreshCw       className="w-5 h-5 text-white" />,
    active:     'border-violet-500 bg-violet-50 text-violet-700',
    iconBg:     'bg-violet-100 text-violet-600',
    iconBgActive:'bg-white/25',
    header:     'from-violet-600 to-purple-600',
    btn:        'from-violet-600 to-purple-600',
    ring:       'focus:ring-violet-400',
    lote:       '',
    loteTit:    '',
  },
];

// Helper: fecha relativa compacta
const fechaRelativa = (fecha: string) => {
  const diff = Date.now() - new Date(fecha).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60)   return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30)   return `hace ${d}d`;
  return new Date(fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
};

const MovimientoModal: React.FC<MovimientoModalProps> = ({ producto, onClose, onSave }) => {
  const [tipo, setTipo]                       = useState<string>('entrada');
  const [cantidad, setCantidad]               = useState('');
  const [motivo, setMotivo]                   = useState('');
  const [referencia, setReferencia]           = useState('');
  const [idProveedor, setIdProveedor]         = useState<number | null>(null);
  const [fechaVenc, setFechaVenc]             = useState('');
  const [costoProd, setCostoProd]             = useState('');
  const [idResponsable, setIdResponsable]     = useState<number | null>(null);
  const [vidaUtil, setVidaUtil]               = useState('');
  const [observacionesLote, setObsLote]       = useState('');
  const [mermaCantidad, setMermaCantidad]     = useState('');
  const [mermaPorcentaje, setMermaPorcentaje] = useState('');
  const [proveedores, setProveedores]         = useState<Proveedor[]>([]);
  const [usuarios, setUsuarios]               = useState<any[]>([]);
  const [historial, setHistorial]             = useState<any[]>([]);
  const [showHistorial, setShowHistorial]     = useState(false);
  const [loadingProvs, setLoadingProvs]       = useState(false);
  const [saving, setSaving]                   = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [loteCreado, setLoteCreado]           = useState<string | null>(null);

  const esEntrada      = tipo === 'entrada';
  const esProduccion   = tipo === 'produccion';
  const esLote         = esEntrada || esProduccion;
  const tipoActual     = TIPOS_MOVIMIENTO.find(t => t.value === tipo)!;
  const cantidadNum    = parseFloat(cantidad) || 0;
  const stockActual    = Number(producto.stock_actual);
  const nuevoStock     = tipo === 'ajuste'
    ? cantidadNum
    : tipoActual.esPositivo
      ? stockActual + cantidadNum
      : stockActual - cantidadNum;
  const deltaStock     = nuevoStock - stockActual;
  const showImpacto    = cantidadNum > 0;

  useEffect(() => {
    const load = async () => {
      setLoadingProvs(true);
      try {
        const [provRes, userRes, histRes] = await Promise.all([
          proveedorService.getAll({ estado: 'activo', limit: 100 }),
          usuariosService.listar({ estado: 'activo', limit: 100 }),
          api.get(`/inventario/movimientos?id_producto=${producto.id}&limit=5`),
        ]);
        setProveedores(provRes.data);
        setUsuarios(userRes.data ?? []);
        setHistorial(histRes.data?.data ?? []);
      } catch { /* silencioso */ }
      finally { setLoadingProvs(false); }
    };
    load();
  }, []);

  useEffect(() => {
    if (!esEntrada) setIdProveedor(null);
  }, [tipo]);

  const handleSubmit = async () => {
    if (!cantidad || parseFloat(cantidad) <= 0) { setError('La cantidad debe ser mayor a 0'); return; }
    if (!motivo.trim()) { setError('El motivo es obligatorio'); return; }
    if (esEntrada && !idProveedor) { setError('Selecciona un proveedor para registrar una entrada'); return; }

    setSaving(true); setError(null);
    try {
      const data: any = {
        id_producto:     producto.id,
        tipo_movimiento: tipo,
        cantidad:        parseFloat(cantidad),
        motivo:          motivo.trim(),
        id_proveedor:    idProveedor ?? undefined,
        referencia:      referencia || undefined,
        ...(esLote && fechaVenc        && { fecha_vencimiento:       new Date(fechaVenc).toISOString() }),
        ...(esLote && costoProd        && { costo_produccion:        parseFloat(costoProd) }),
        ...(esLote && idResponsable    && { id_usuario_responsable:  idResponsable }),
        ...(esLote && vidaUtil         && { vida_util_dias:          parseInt(vidaUtil) }),
        ...(esLote && observacionesLote && { observaciones_lote:     observacionesLote }),
        ...(esProduccion && mermaCantidad   && { merma_cantidad:   parseFloat(mermaCantidad) }),
        ...(esProduccion && mermaPorcentaje && { merma_porcentaje: parseFloat(mermaPorcentaje) }),
      };

      const resultado = await inventarioService.registrarMovimiento(data);
      const numeroLote = resultado?.data?.lote_generado?.numero_lote ?? resultado?.lote_generado?.numero_lote ?? null;
      setLoteCreado(numeroLote);
      if (!numeroLote) { onSave(); }
    } catch (e: any) {
      setError(e.message || 'Error al registrar movimiento');
    } finally {
      setSaving(false);
    }
  };

  if (loteCreado) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 1400 }}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">Movimiento registrado</h3>
          <p className="text-slate-500 text-sm mb-4">Se generó automáticamente el lote:</p>
          <div className="bg-slate-100 rounded-xl px-4 py-3 font-mono font-bold text-slate-700 text-lg mb-6">
            {loteCreado}
          </div>
          <p className="text-xs text-slate-400 mb-6">Puedes consultar este lote en la sección <strong>Lotes</strong> del menú lateral</p>
          <button onClick={() => onSave(loteCreado)}
            className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold text-sm hover:from-emerald-700 hover:to-teal-700 transition-all">
            Entendido
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 1400 }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">

        {/* ── Header dinámico según tipo ── */}
        <div className={`bg-gradient-to-r ${tipoActual.header} px-5 py-4`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm">
                {tipoActual.iconBig}
              </div>
              <div>
                <p className="text-white/70 text-xs font-medium uppercase tracking-wider">Registrar movimiento</p>
                <h2 className="text-white font-bold text-base leading-tight mt-0.5">{producto.nombre}</h2>
                <p className="text-xs text-white/70 mt-0.5">{producto.sku} · {producto.unidad_medida}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/15 transition-colors mt-0.5">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stock actual + preview impacto */}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 bg-white/15 rounded-xl px-3 py-2 flex items-center justify-between">
              <span className="text-white/70 text-xs">Stock actual</span>
              <span className="text-white font-bold text-sm">{stockActual} {producto.unidad_medida}</span>
            </div>
            {showImpacto && (
              <>
                <div className="text-white/50 text-xs font-bold">→</div>
                <div className={`flex-1 rounded-xl px-3 py-2 flex items-center justify-between ${nuevoStock < 0 ? 'bg-red-900/40' : 'bg-white/20'}`}>
                  <span className="text-white/70 text-xs">Nuevo stock</span>
                  <span className={`font-bold text-sm ${nuevoStock < 0 ? 'text-red-200' : 'text-white'}`}>
                    {nuevoStock < 0 ? '—' : `${nuevoStock.toFixed(2)} ${producto.unidad_medida}`}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          {/* ── Historial reciente (colapsable) ── */}
          {historial.length > 0 && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <button
                onClick={() => setShowHistorial(!showHistorial)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <History className="w-3.5 h-3.5 text-slate-400" />
                  Últimos movimientos
                  <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full text-xs">{historial.length}</span>
                </div>
                {showHistorial
                  ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
              </button>
              {showHistorial && (
                <div className="divide-y divide-slate-100">
                  {historial.map((mov: any) => {
                    const t = TIPOS_MOVIMIENTO.find(x => x.value === mov.tipo_movimiento);
                    return (
                      <div key={mov.id} className="flex items-center justify-between px-3.5 py-2 bg-white">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${t?.active ?? 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                            {t?.icon} {t?.label ?? mov.tipo_movimiento}
                          </span>
                          <span className="text-xs text-slate-500 truncate max-w-[100px]">{mov.motivo}</span>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <p className={`text-xs font-bold ${t?.esPositivo ? 'text-emerald-600' : t?.esPositivo === false ? 'text-red-600' : 'text-blue-600'}`}>
                            {t?.esPositivo ? '+' : t?.esPositivo === false ? '-' : '='}{Number(mov.cantidad).toFixed(2)}
                          </p>
                          <p className="text-xs text-slate-400">{fechaRelativa(mov.fecha_movimiento)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Selector de tipo ── */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tipo de movimiento</p>
            <div className="grid grid-cols-3 gap-1.5">
              {TIPOS_MOVIMIENTO.map(t => {
                const isActive = tipo === t.value;
                return (
                  <button key={t.value} onClick={() => setTipo(t.value)}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 text-xs font-semibold transition-all ${isActive ? t.active + ' shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}>
                    <div className={`p-1.5 rounded-lg transition-colors ${isActive ? t.iconBg : 'bg-slate-100 text-slate-400'}`}>
                      {t.icon}
                    </div>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Cantidad ── */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              {tipo === 'ajuste' ? 'Nuevo stock total' : 'Cantidad'}
              <span className="text-slate-400 font-normal ml-1">({producto.unidad_medida})</span>
            </label>
            <input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)}
              placeholder={tipo === 'ajuste' ? `Stock actual: ${stockActual}` : 'Ej: 5'}
              min="0" step="0.01"
              className={`w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 ${tipoActual.ring}`} />
            {tipo === 'ajuste' && cantidadNum > 0 && (
              <p className="text-xs mt-1 text-blue-600">
                {deltaStock >= 0 ? `↑ Aumenta ${deltaStock.toFixed(2)} ${producto.unidad_medida}` : `↓ Reduce ${Math.abs(deltaStock).toFixed(2)} ${producto.unidad_medida}`}
              </p>
            )}
            {showImpacto && nuevoStock < 0 && tipo !== 'ajuste' && (
              <p className="text-xs mt-1 text-red-600 font-medium">⚠ La cantidad supera el stock disponible</p>
            )}
          </div>

          {/* ── Proveedor (solo Entrada) ── */}
          {esEntrada && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Proveedor <span className="text-red-500">*</span>
              </label>
              {loadingProvs ? (
                <div className="flex items-center gap-2 px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-400">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Cargando proveedores...
                </div>
              ) : proveedores.length === 0 ? (
                <div className="px-3 py-2.5 border border-amber-200 bg-amber-50 rounded-xl text-sm text-amber-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  No hay proveedores activos. <a href="/proveedores" className="underline font-semibold">Crear proveedor</a>
                </div>
              ) : (
                <select value={idProveedor ?? ''} onChange={e => setIdProveedor(e.target.value ? Number(e.target.value) : null)}
                  className={`w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 ${tipoActual.ring}`}>
                  <option value="">— Selecciona un proveedor —</option>
                  {proveedores.map(p => (
                    <option key={p.id} value={p.id}>{p.razon_social}{p.ciudad ? ` · ${p.ciudad}` : ''}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* ── Datos del Lote (Entrada / Producción) ── */}
          {esLote && (
            <div className={`rounded-xl border p-3.5 space-y-3 ${tipoActual.lote}`}>
              <div className="flex items-center justify-between">
                <p className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${tipoActual.loteTit}`}>
                  <Hash className="w-3.5 h-3.5" /> Datos del Lote
                </p>
                <span className="text-xs text-slate-400 bg-white/70 px-2 py-0.5 rounded-full border">opcional · N° auto</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                    <Users className="w-3 h-3" /> Responsable
                  </label>
                  <select value={idResponsable ?? ''} onChange={e => setIdResponsable(e.target.value ? Number(e.target.value) : null)}
                    className={`w-full px-3 py-2 border border-white/80 rounded-lg text-xs bg-white outline-none focus:ring-2 ${tipoActual.ring}`}>
                    <option value="">— Seleccionar —</option>
                    {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre_completo ?? u.usuario}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Vida útil (días)</label>
                  <input type="number" value={vidaUtil} onChange={e => setVidaUtil(e.target.value)}
                    placeholder="Ej: 7" min="1"
                    className={`w-full px-3 py-2 border border-white/80 rounded-lg text-xs outline-none focus:ring-2 ${tipoActual.ring}`} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Vencimiento</label>
                  <input type="date" value={fechaVenc} onChange={e => setFechaVenc(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className={`w-full px-3 py-2 border border-white/80 rounded-lg text-xs bg-white outline-none focus:ring-2 ${tipoActual.ring}`} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Costo Producción</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">$</span>
                    <input type="number" value={costoProd} onChange={e => setCostoProd(e.target.value)}
                      placeholder="0" min="0"
                      className={`w-full pl-6 pr-2 py-2 border border-white/80 rounded-lg text-xs outline-none focus:ring-2 ${tipoActual.ring}`} />
                  </div>
                </div>
              </div>
              {/* Observaciones del lote */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones del lote</label>
                <textarea rows={2} value={observacionesLote} onChange={e => setObsLote(e.target.value)}
                  placeholder="Notas adicionales del lote..."
                  className={`w-full px-3 py-2 border border-white/80 rounded-lg text-xs outline-none resize-none focus:ring-2 ${tipoActual.ring}`} />
              </div>
            </div>
          )}

          {/* ── Merma (solo Producción) ── */}
          {esProduccion && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Merma de Producción
                <span className="text-amber-500 font-normal normal-case">(opcional)</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Cantidad ({producto.unidad_medida})
                  </label>
                  <input type="number" value={mermaCantidad} onChange={e => setMermaCantidad(e.target.value)}
                    placeholder="0" min="0" step="0.01"
                    className="w-full px-3 py-2 border border-amber-200 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Porcentaje (%)</label>
                  <input type="number" value={mermaPorcentaje} onChange={e => setMermaPorcentaje(e.target.value)}
                    placeholder="0" min="0" max="100" step="0.1"
                    className="w-full px-3 py-2 border border-amber-200 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              </div>
              <p className="text-xs text-amber-600">
                La merma registrada se descuenta automáticamente del lote producido.
              </p>
            </div>
          )}

          {/* ── Motivo ── */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Motivo <span className="text-red-500">*</span>
            </label>
            <textarea rows={2} value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder={esEntrada ? 'Ej: Compra semanal, Reposición de stock...' : esProduccion ? 'Ej: Producción del día, Lote matutino...' : tipo === 'merma' ? 'Ej: Producto caducado, Derrame...' : 'Ej: Uso en preparación, Ajuste de inventario...'}
              className={`w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none resize-none focus:ring-2 ${tipoActual.ring}`} />
          </div>

          {/* ── Referencia ── */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Referencia <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input value={referencia} onChange={e => setReferencia(e.target.value)}
              placeholder="Número de factura, orden de compra..."
              className={`w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 ${tipoActual.ring}`} />
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 bg-slate-50/80">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className={`flex-2 flex-[2] py-2.5 bg-gradient-to-r ${tipoActual.btn} text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 shadow-sm`}>
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Registrando...' : `Registrar ${tipoActual.label}`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MODAL PRECIO DE VENTA — calculadora de utilidad para MP y MPP
// ============================================================================
interface PrecioVentaModalProps {
  producto: Producto;
  onClose: () => void;
  onSave: () => void;
}

const PrecioVentaModal: React.FC<PrecioVentaModalProps> = ({ producto, onClose, onSave }) => {
  const tipoP = inferirTipo(producto);

  const [costoBase, setCostoBase]         = useState<number>(0);
  const [utilidad, setUtilidad]           = useState<number>(30);
  const [ingredientes, setIngredientes]   = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [costoEditado, setCostoEditado]   = useState(false); // si el usuario editó el costo base manualmente

  // Calcular
  const aumentoMonto = costoBase * (utilidad / 100);
  const precioFinal  = costoBase + aumentoMonto;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (tipoP === 'procesada') {
          // Buscar receta y sumar costo de ingredientes
          const recipesRes = await api.get(`/recetas?id_producto=${producto.id}&limit=1`);
          const recipes: any[] = recipesRes.data?.data ?? [];
          if (recipes.length > 0) {
            const recRes = await api.get(`/recetas/${recipes[0].id}`);
            const receta = recRes.data?.data ?? recRes.data;
            const ings: any[] = receta.ingredientes ?? [];
            setIngredientes(ings);
            const total = ings.reduce((sum: number, ing: any) => {
              const precio = Number(ing.producto?.precio_unitario ?? 0);
              const qty    = Number(ing.cantidad ?? 0);
              return sum + precio * qty;
            }, 0);
            setCostoBase(total > 0 ? total : Number(producto.precio_unitario) || 0);
          } else {
            setCostoBase(Number(producto.precio_unitario) || 0);
          }
        } else {
          // prima: usar precio_unitario actual del producto
          setCostoBase(Number(producto.precio_unitario) || 0);
        }
        // Inferir utilidad desde precio_venta existente si está configurado
        if (producto.precio_venta && producto.precio_venta > 0 && Number(producto.precio_unitario) > 0) {
          const u = ((producto.precio_venta - Number(producto.precio_unitario)) / Number(producto.precio_unitario)) * 100;
          if (u > 0 && u < 500) setUtilidad(Math.round(u));
        }
      } catch (e: any) {
        setError(e.message || 'Error al cargar costos');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [producto.id, tipoP]);

  const handleSave = async () => {
    if (costoBase <= 0) { setError('Ingresa el costo base para calcular el precio'); return; }
    setSaving(true); setError(null);
    try {
      await productosService.update(producto.id, {
        precio_unitario: costoBase,
        precio_venta:    parseFloat(precioFinal.toFixed(2)),
        es_vendible:     true,
      });
      onSave();
    } catch (e: any) {
      setError(e.message || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const tipoCfg = TIPO_PRODUCTO_CONFIG[tipoP];

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 1400 }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">

        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between bg-gradient-to-r ${tipoCfg.headerGradient}`}>
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg text-white">{TIPO_ICONS[tipoP]}</div>
            <div>
              <p className="text-white/70 text-xs">Configurar precio de venta</p>
              <h2 className="text-white font-bold">{producto.nombre}</h2>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
              <p className="text-slate-500 text-sm">Calculando costos...</p>
            </div>
          ) : (
            <>
              {/* Ingredientes para MPP */}
              {tipoP === 'procesada' && ingredientes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Desglose de costos por ingrediente
                  </p>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Ingrediente</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">Cant.</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">Costo unit.</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ingredientes.map((ing: any, i: number) => {
                          const precioU = Number(ing.producto?.precio_unitario ?? 0);
                          const qty     = Number(ing.cantidad ?? 0);
                          return (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-3 py-2 text-slate-700">{ing.producto?.nombre ?? `Ing. ${i + 1}`}</td>
                              <td className="px-3 py-2 text-right text-slate-500">{qty} {ing.unidad_medida}</td>
                              <td className="px-3 py-2 text-right text-slate-500">{formatCurrency(precioU)}</td>
                              <td className="px-3 py-2 text-right font-semibold text-slate-700">{formatCurrency(precioU * qty)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Costo base editable */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Costo base {tipoP === 'procesada' ? '(calculado de ingredientes)' : '(precio de compra)'}</span>
                  {tipoP === 'procesada' && (
                    <button
                      type="button"
                      onClick={() => { setCostoEditado(!costoEditado); }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-normal">
                      {costoEditado ? 'Usar calculado' : 'Editar manualmente'}
                    </button>
                  )}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    value={costoBase === 0 ? '' : costoBase}
                    onChange={e => { setCostoBase(parseFloat(e.target.value) || 0); setCostoEditado(true); }}
                    disabled={tipoP === 'procesada' && !costoEditado}
                    className={`w-full pl-7 pr-3 py-2.5 border rounded-xl text-sm outline-none ${
                      tipoP === 'procesada' && !costoEditado
                        ? 'bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed'
                        : 'border-slate-200 focus:ring-2 focus:ring-blue-500'
                    }`}
                    placeholder="0.00"
                  />
                </div>
                {tipoP === 'prima' && costoBase === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Ingresa el precio al que compras este insumo al proveedor
                  </p>
                )}
              </div>

              {/* Porcentaje de utilidad */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center justify-between">
                  <span>Porcentaje de utilidad</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={utilidad}
                      onChange={e => setUtilidad(Math.max(0, Math.min(500, parseFloat(e.target.value) || 0)))}
                      className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-sm text-center font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                      min="0" max="500" step="1"
                    />
                    <span className="text-sm font-bold text-slate-600">%</span>
                  </div>
                </label>
                <input
                  type="range"
                  min="0" max="200" step="5"
                  value={Math.min(utilidad, 200)}
                  onChange={e => setUtilidad(parseInt(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                  <span>150%</span>
                  <span>200%</span>
                </div>
              </div>

              {/* Desglose del precio */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-5 border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Cálculo del precio de venta</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Costo base</span>
                    <span className="text-sm font-semibold text-slate-800">{formatCurrency(costoBase)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">
                      + Utilidad ({utilidad}%)
                    </span>
                    <span className="text-sm font-semibold text-emerald-600">+{formatCurrency(aumentoMonto)}</span>
                  </div>
                  <div className="border-t border-slate-300 pt-3 flex items-center justify-between">
                    <span className="text-base font-bold text-slate-800">Precio de venta</span>
                    <span className="text-xl font-black text-emerald-700">{formatCurrency(precioFinal)}</span>
                  </div>
                </div>
                {costoBase > 0 && (
                  <p className="text-xs text-slate-400 mt-3 text-center">
                    Ganancia por unidad: <strong className="text-emerald-600">{formatCurrency(aumentoMonto)}</strong>
                  </p>
                )}
              </div>

              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Al guardar, el producto quedará marcado como <strong>vendible</strong> y aparecerá
                  disponible en el módulo de <strong>Órdenes</strong> para agregarlo a pedidos.
                </p>
              </div>
            </>
          )}
        </div>

        {!loading && (
          <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end bg-slate-50">
            <button onClick={onClose}
              className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || costoBase <= 0}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 transition-all disabled:opacity-50 bg-gradient-to-r ${tipoCfg.headerGradient} hover:opacity-90`}>
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Guardando...' : `Guardar · ${formatCurrency(precioFinal)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MODAL PRODUCTO — v4: selector de tipo + SKU auto + categoría rápida
// ============================================================================
interface ProductoModalProps {
  mode: ModalMode;
  producto?: Producto | null;
  categorias: Categoria[];
  onClose: () => void;
  /** Recibe el id del nuevo Producto Terminado (solo en creación de terminados) */
  onSave: (nuevoTerminadoId?: number) => void;
}

const ProductoModal: React.FC<ProductoModalProps> = ({ mode, producto, categorias, onClose, onSave }) => {
  const [tipoProducto, setTipoProducto] = useState<TipoProducto | null>(null);
  const [form, setForm]                 = useState<FormData>(FORM_DEFAULTS);
  const [skuManual, setSkuManual]       = useState(false);
  const [localCats, setLocalCats]       = useState<Categoria[]>(categorias);
  const [showNewCat, setShowNewCat]     = useState(false);
  const [newCatNombre, setNewCatNombre] = useState('');
  const [savingCat, setSavingCat]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // Init: en edición detecta el tipo desde el producto
  useEffect(() => {
    if (mode === 'edit' && producto) {
      const tp = inferirTipo(producto);
      setTipoProducto(tp);
      setSkuManual(true); // en edición no regeneramos SKU
      setForm({
        sku:                    producto.sku,
        nombre:                 producto.nombre,
        descripcion:            producto.descripcion || '',
        id_categoria:           producto.id_categoria?.toString() || '',
        tipo_materia:           producto.tipo_materia,
        unidad_medida:          producto.unidad_medida,
        precio_unitario:        producto.precio_unitario.toString(),
        precio_venta:           producto.precio_venta?.toString() || '',
        stock_actual:           producto.stock_actual.toString(),
        stock_minimo:           producto.stock_minimo.toString(),
        stock_maximo:           producto.stock_maximo?.toString() || '',
        requiere_refrigeracion: producto.requiere_refrigeracion,
        es_vendible:            producto.es_vendible,
        estado: (producto.estado === 'eliminado' ? 'inactivo' : producto.estado) as 'activo' | 'inactivo',
      });
    } else {
      setForm(FORM_DEFAULTS);
      setTipoProducto(null);
      setSkuManual(false);
    }
  }, [mode, producto]);

  useEffect(() => { setLocalCats(categorias); }, [categorias]);

  const handleSelectTipo = (tipo: TipoProducto) => {
    const cfg = TIPO_PRODUCTO_CONFIG[tipo];
    setTipoProducto(tipo);
    setForm(prev => ({
      ...prev,
      tipo_materia:    cfg.tipo_materia,
      es_vendible:     cfg.es_vendible,
      precio_unitario: cfg.precioBloqueado ? '0' : prev.precio_unitario,
      sku:             !skuManual && prev.nombre ? generarSKU(prev.nombre, tipo) : prev.sku,
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (name === 'sku') {
      setSkuManual(true);
      setForm(prev => ({ ...prev, sku: value }));
      return;
    }
    if (name === 'nombre') {
      setForm(prev => ({
        ...prev,
        nombre: value,
        sku: !skuManual && tipoProducto ? generarSKU(value, tipoProducto) : prev.sku,
      }));
      return;
    }
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value }));
  };

  const handleResetSKU = () => {
    if (!tipoProducto || !form.nombre) return;
    setSkuManual(false);
    setForm(prev => ({ ...prev, sku: generarSKU(prev.nombre, tipoProducto) }));
  };

  const handleCrearCategoria = async () => {
    if (!newCatNombre.trim()) return;
    setSavingCat(true);
    try {
      const nueva = await categoriasService.create({ nombre: newCatNombre.trim(), estado: 'activo', orden: 99 });
      setLocalCats(prev => [...prev, nueva]);
      setForm(prev => ({ ...prev, id_categoria: nueva.id.toString() }));
      setNewCatNombre('');
      setShowNewCat(false);
    } catch { /* silencioso */ }
    finally { setSavingCat(false); }
  };

  const handleSubmit = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    if (!form.sku.trim())    { setError('El SKU es obligatorio'); return; }

    setSaving(true); setError(null);
    try {
      const data: ProductoCreateDTO = {
        sku:                    form.sku.trim(),
        nombre:                 form.nombre.trim(),
        descripcion:            form.descripcion || undefined,
        id_categoria:           form.id_categoria ? parseInt(form.id_categoria) : undefined,
        tipo_materia:           form.tipo_materia,
        unidad_medida:          form.unidad_medida,
        // Para terminado: precio y stock_actual se calculan desde la receta, se inician en 0
        precio_unitario:        tipoProducto === 'terminado' ? 0 : (form.precio_unitario ? parseFloat(form.precio_unitario) : 0),
        precio_venta:           form.precio_venta ? parseFloat(form.precio_venta) : undefined,
        stock_actual:           tipoProducto === 'terminado' ? 0 : (form.stock_actual ? parseFloat(form.stock_actual) : 0),
        stock_minimo:           form.stock_minimo ? parseFloat(form.stock_minimo) : 0,
        stock_maximo:           form.stock_maximo ? parseFloat(form.stock_maximo) : undefined,
        requiere_refrigeracion: form.requiere_refrigeracion,
        es_vendible:            form.es_vendible,
        estado:                 form.estado,
      };
      if (mode === 'create') {
        const creado = await productosService.create(data);
        // Si es terminado, pasamos el id para redirigir a Recetas
        onSave(tipoProducto === 'terminado' ? creado.id : undefined);
      } else if (mode === 'edit' && producto) {
        await productosService.update(producto.id, data as ProductoUpdateDTO);
        onSave();
      }
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const tipoCfg = tipoProducto ? TIPO_PRODUCTO_CONFIG[tipoProducto] : null;

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 1400 }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* ── Header ── */}
        <div className={`px-6 py-4 flex items-center justify-between bg-gradient-to-r ${tipoCfg?.headerGradient ?? 'from-slate-700 to-slate-800'}`}>
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg text-white">
              {tipoProducto ? TIPO_ICONS[tipoProducto] : <Package className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {mode === 'create'
                  ? (tipoProducto ? `Nuevo ${tipoCfg!.label}` : 'Nuevo Producto')
                  : 'Editar Producto'}
              </h2>
              {tipoCfg && (
                <p className="text-white/70 text-xs">{tipoCfg.sub}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tipoProducto && mode === 'create' && (
              <button onClick={() => setTipoProducto(null)}
                className="text-white/80 hover:text-white hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors text-xs font-medium">
                ← Cambiar tipo
              </button>
            )}
            <button onClick={onClose} className="text-white/80 hover:text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1">

          {/* PASO 1: Selector de tipo (solo en creación) */}
          {!tipoProducto && mode === 'create' && (
            <div className="p-8">
              <p className="text-center text-slate-500 text-sm mb-6">
                Selecciona qué tipo de elemento vas a registrar en el inventario
              </p>
              <div className="flex flex-col gap-4">
                {(Object.entries(TIPO_PRODUCTO_CONFIG) as [TipoProducto, typeof TIPO_PRODUCTO_CONFIG['prima']][]).map(([tipo, cfg]) => (
                  <button key={tipo} onClick={() => handleSelectTipo(tipo)}
                    className={`flex items-center gap-4 p-5 border-2 rounded-2xl text-left transition-all hover:shadow-md ${cfg.borderClass} ${cfg.hoverClass} group`}>
                    <div className={`bg-gradient-to-br ${cfg.headerGradient} p-3.5 rounded-xl shadow-md flex-shrink-0 text-white`}>
                      {TIPO_ICONS[tipo]}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-800 text-base">{cfg.label}</p>
                      <p className="text-sm text-slate-500 mt-0.5">{cfg.sub}</p>
                    </div>
                    <ChevronDown className="w-5 h-5 text-slate-400 -rotate-90 group-hover:translate-x-1 transition-transform flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PASO 2: Formulario */}
          {tipoProducto && (
            <div className="p-6 space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                </div>
              )}

              {/* Badge tipo en edición */}
              {mode === 'edit' && tipoCfg && (
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r ${tipoCfg.headerGradient}`}>
                  {TIPO_ICONS[tipoProducto]}
                  {tipoCfg.label}
                </div>
              )}

              {/* Nombre + SKU */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nombre *</label>
                  <input
                    name="nombre"
                    value={form.nombre}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="Nombre del producto"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                    SKU *
                    {!skuManual && (
                      <span className="text-xs font-normal bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-md">auto</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      name="sku"
                      value={form.sku}
                      onChange={handleChange}
                      className={`w-full px-3 py-2.5 border rounded-xl text-sm font-mono outline-none pr-9 ${
                        skuManual
                          ? 'border-slate-200 focus:ring-2 focus:ring-blue-500'
                          : 'border-blue-200 bg-blue-50/50 focus:ring-2 focus:ring-blue-400'
                      }`}
                      placeholder="Auto-generado"
                    />
                    {skuManual && (
                      <button
                        type="button"
                        onClick={handleResetSKU}
                        title="Regenerar automáticamente"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {skuManual ? `SKU personalizado · ↺ para regenerar` : `Auto-generado · prefijo ${tipoCfg!.prefix}`}
                  </p>
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Descripción</label>
                <textarea
                  name="descripcion"
                  value={form.descripcion}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
                  placeholder="Descripción opcional..."
                />
              </div>

              {/* Categoría + Unidad */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>Categoría</span>
                    <button
                      type="button"
                      onClick={() => setShowNewCat(!showNewCat)}
                      className="flex items-center gap-1 text-xs font-normal text-blue-600 hover:text-blue-700">
                      <Plus className="w-3 h-3" /> Nueva categoría
                    </button>
                  </label>
                  <select
                    name="id_categoria"
                    value={form.id_categoria}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white">
                    <option value="">Sin categoría</option>
                    {localCats.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                  {showNewCat && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                      <p className="text-xs font-semibold text-blue-700">Nueva categoría</p>
                      <div className="flex gap-2">
                        <input
                          value={newCatNombre}
                          onChange={e => setNewCatNombre(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleCrearCategoria()}
                          placeholder="Nombre de la categoría..."
                          className="flex-1 px-2.5 py-1.5 border border-blue-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                        />
                        <button
                          onClick={handleCrearCategoria}
                          disabled={savingCat || !newCatNombre.trim()}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50 hover:bg-blue-700 transition-colors">
                          {savingCat ? '...' : 'Crear'}
                        </button>
                        <button
                          onClick={() => { setShowNewCat(false); setNewCatNombre(''); }}
                          className="p-1.5 border border-blue-200 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Unidad de Medida</label>
                  <select
                    name="unidad_medida"
                    value={form.unidad_medida}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white">
                    <option value="unidad">Unidad</option>
                    <option value="gramo">Gramo</option>
                    <option value="kilogramo">Kilogramo</option>
                    <option value="litro">Litro</option>
                    <option value="mililitro">Mililitro</option>
                    <option value="porcion">Porción</option>
                  </select>
                </div>
              </div>

              {/* Precios */}
              {tipoProducto === 'procesada' ? (
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Precio calculado desde la receta</p>
                    <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                      El costo se calcula a partir del costo de sus ingredientes.
                      Configura la receta en el módulo <strong>Recetas</strong> y luego usa
                      <strong> "Configurar precio"</strong> en el inventario para agregar tu margen de utilidad.
                    </p>
                  </div>
                </div>
              ) : tipoProducto === 'prima' ? (
                <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <Package className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800">Precio desde el proveedor</p>
                    <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                      El costo de compra se configura en <strong>Proveedores</strong> al asociar el insumo.
                      Si quieres vender esta materia prima, usa <strong>"Configurar precio"</strong> en
                      el inventario para calcular el precio con tu margen de utilidad.
                    </p>
                  </div>
                </div>
              ) : (
                /* Solo para Producto Terminado */
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <Calculator className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">Costo calculado desde la receta</p>
                      <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                        El costo unitario se calculará automáticamente a partir del costo de los
                        ingredientes (materia prima y procesada) que definas en la <strong>receta</strong>.
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Precio de Venta</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                      <input
                        name="precio_venta"
                        type="number"
                        value={form.precio_venta}
                        onChange={handleChange}
                        className="w-full pl-7 pr-3 py-2.5 border border-emerald-200 bg-emerald-50/30 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                        placeholder="0.00"
                      />
                    </div>
                    <p className="text-xs text-emerald-600 mt-1">Precio que paga el cliente</p>
                  </div>
                </div>
              )}

              {/* Stock */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Stock Actual</label>
                  {tipoProducto === 'terminado' ? (
                    <>
                      <input
                        type="number" value="0" readOnly
                        className="w-full px-3 py-2.5 border border-slate-100 bg-slate-50 rounded-xl text-sm text-slate-400 cursor-not-allowed"
                      />
                      <p className="text-xs text-slate-400 mt-1">Calculado desde la receta</p>
                    </>
                  ) : (
                    <input name="stock_actual" type="number" value={form.stock_actual} onChange={handleChange}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Stock Mínimo</label>
                  <input name="stock_minimo" type="number" value={form.stock_minimo} onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Stock Máximo
                    {tipoProducto === 'terminado' && (
                      <span className="text-xs font-normal text-slate-400 ml-1">(inicial)</span>
                    )}
                  </label>
                  <input name="stock_maximo" type="number" value={form.stock_maximo} onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" placeholder="Opcional" />
                  {tipoProducto === 'terminado' && (
                    <p className="text-xs text-slate-400 mt-1">Se ajustará según ventas</p>
                  )}
                </div>
              </div>

              {/* Estado + Refrigeración */}
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <Thermometer className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700 flex-1">Requiere Refrigeración</span>
                  <div className={`relative w-10 h-5 rounded-full transition-colors ${form.requiere_refrigeracion ? 'bg-blue-500' : 'bg-slate-200'}`}>
                    <input type="checkbox" name="requiere_refrigeracion" checked={form.requiere_refrigeracion} onChange={handleChange} className="sr-only" />
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.requiere_refrigeracion ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </label>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Estado</label>
                  <select name="estado" value={form.estado} onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white">
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {tipoProducto && (
          <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end bg-slate-50">
            <button onClick={onClose}
              className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
              Cancelar
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 transition-all disabled:opacity-50 bg-gradient-to-r ${tipoCfg!.headerGradient} hover:opacity-90`}>
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Guardando...' : mode === 'create' ? `Crear ${tipoCfg!.label}` : 'Guardar Cambios'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// VARIANTES DRAWER
// ============================================================================

interface VariantesDrawerProps { producto: Producto; onClose: () => void; }

function VariantesDrawer({ producto, onClose }: VariantesDrawerProps) {
  const [variantes, setVariantes] = useState<ProductoVariante[]>([]);
  const [loading, setLoading]     = useState(true);
  const [formOpen, setFormOpen]   = useState(false);
  const [editV, setEditV]         = useState<ProductoVariante | null>(null);
  const [form, setForm]           = useState<CreateVarianteDto>({ nombre: '', precio: 0, sku: '', orden: 0 });
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setVariantes(await variantesService.listar(producto.id)); }
    catch { setVariantes([]); }
    finally { setLoading(false); }
  }, [producto.id]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditV(null); setForm({ nombre: '', precio: 0, sku: '', orden: variantes.length }); setError(''); setFormOpen(true); };
  const openEdit   = (v: ProductoVariante) => { setEditV(v); setForm({ nombre: v.nombre, precio: Number(v.precio), sku: v.sku||'', orden: v.orden }); setError(''); setFormOpen(true); };

  const handleSave = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    if (form.precio < 0) { setError('El precio no puede ser negativo'); return; }
    setSaving(true);
    try {
      if (editV) await variantesService.actualizar(producto.id, editV.id, form);
      else       await variantesService.crear(producto.id, form);
      setFormOpen(false);
      load();
    } catch (e: any) { setError(e.response?.data?.error || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (v: ProductoVariante) => {
    if (!window.confirm(`Eliminar la variante "${v.nombre}"?`)) return;
    try { await variantesService.eliminar(producto.id, v.id); load(); }
    catch { /* ignore */ }
  };

  const moveVariante = async (v: ProductoVariante, dir: -1 | 1) => {
    const sorted = [...variantes].sort((a, b) => a.orden - b.orden);
    const idx = sorted.findIndex(x => x.id === v.id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sorted.length) return;
    [sorted[idx], sorted[newIdx]] = [sorted[newIdx], sorted[idx]];
    const items = sorted.map((x, i) => ({ id: x.id, orden: i }));
    try {
      await variantesService.reordenar(producto.id, items);
      load();
    } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-gray-800 h-full shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">Variantes</h3>
            <p className="text-sm text-gray-500">{producto.nombre}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openCreate}
              className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
              <Plus className="w-3 h-3" /> Nueva
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : variantes.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Layers className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Sin variantes. Crea la primera.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...variantes].sort((a, b) => a.orden - b.orden).map((v, idx) => (
                <div key={v.id} className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                  <div className="flex flex-col gap-0.5">
                    <button disabled={idx === 0} onClick={() => moveVariante(v, -1)} className="text-gray-300 hover:text-gray-600 disabled:opacity-20">
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button disabled={idx === variantes.length - 1} onClick={() => moveVariante(v, 1)} className="text-gray-300 hover:text-gray-600 disabled:opacity-20">
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{v.nombre}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-bold text-purple-600">${Number(v.precio).toLocaleString('es-CO')}</span>
                      {v.sku && <span className="text-xs text-gray-400">SKU: {v.sku}</span>}
                      <span className={`text-xs px-1.5 py-0.5 rounded ${v.estado === 'activo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{v.estado}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(v)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded">
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleDelete(v)} className="p-1.5 text-red-400 hover:bg-red-50 rounded">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mini form dentro del drawer */}
        {formOpen && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
            <h4 className="font-semibold text-sm mb-3">{editV ? 'Editar variante' : 'Nueva variante'}</h4>
            {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input
                className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                placeholder="Nombre *" value={form.nombre}
                onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
              <input
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                placeholder="Precio *" type="number" min={0} value={form.precio}
                onChange={e => setForm(p => ({ ...p, precio: Number(e.target.value) }))} />
              <input
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                placeholder="SKU (opcional)" value={form.sku||''}
                onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setFormOpen(false)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100">Cancelar</button>
              <button onClick={handleSave} disabled={saving}
                className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export const Inventario: React.FC = () => {
  const navigate = useNavigate();
  const { setSidebarCollapsed } = useUIStore();
  const [productos, setProductos]               = useState<Producto[]>([]);
  const [categorias, setCategorias]             = useState<Categoria[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [searchTerm, setSearchTerm]             = useState('');
  const [filterCategoria, setFilterCategoria]   = useState('');
  const [filterEstado, setFilterEstado]         = useState('');
  const [filterStock, setFilterStock]           = useState('');
  const [showFilters, setShowFilters]           = useState(false);
  const [seccionActiva, setSeccionActiva]       = useState<'all' | 'prima' | 'procesada' | 'terminado'>('all');
  const [modalMode, setModalMode]               = useState<ModalMode>(null);
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);
  const [deleteTarget, setDeleteTarget]         = useState<Producto | null>(null);
  const [movimientoTarget, setMovimientoTarget]         = useState<Producto | null>(null);
  const [disponibilidadTarget, setDisponibilidadTarget] = useState<Producto | null>(null);
  const [precioVentaTarget, setPrecioVentaTarget]       = useState<Producto | null>(null);
  const [variantesTarget, setVariantesTarget]           = useState<Producto | null>(null);
  const [_deleting, setDeleting]                        = useState(false);
  const showVariantes = useFeatureFlag('variantes_productos');
  const [disponibilidades, setDisponibilidades]         = useState<Map<number, { disponibilidad: number; unidad_produccion: string | null }>>(new Map());

  // Auto-colapsar sidebar cuando hay un modal abierto
  const anyModalOpen = !!modalMode || !!movimientoTarget || !!disponibilidadTarget || !!precioVentaTarget || !!deleteTarget || !!variantesTarget;
  useEffect(() => {
    if (anyModalOpen) setSidebarCollapsed(true);
  }, [anyModalOpen]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { limit: 500 };
      if (searchTerm)      params.search    = searchTerm;
      if (filterCategoria) params.categoria = parseInt(filterCategoria);
      if (filterEstado)    params.estado    = filterEstado;

      const [prods, cats, dispRes] = await Promise.all([
        productosService.getAll(params),
        categorias.length === 0 ? categoriasService.getAll('activo') : Promise.resolve(categorias),
        api.get('/recetas/disponibilidad-catalogo').catch(() => null),
      ]);

      // Poblar mapa de disponibilidades para productos terminados
      const dispList: { id_producto: number; disponibilidad: number; unidad_produccion: string | null }[] =
        dispRes?.data?.data ?? [];
      const dispMap = new Map<number, { disponibilidad: number; unidad_produccion: string | null }>();
      for (const d of dispList) dispMap.set(d.id_producto, { disponibilidad: d.disponibilidad, unidad_produccion: d.unidad_produccion });
      setDisponibilidades(dispMap);

      // Filtrar usando disponibilidad calculada para terminados, stock_actual para los demás
      let filtered = prods;
      if (filterStock === 'bajo') {
        filtered = prods.filter(p => {
          if (p.es_vendible) {
            const disp = dispMap.get(p.id)?.disponibilidad ?? 0;
            return disp > 0 && disp <= p.stock_minimo;
          }
          return p.stock_actual <= p.stock_minimo && p.stock_actual > 0;
        });
      }
      if (filterStock === 'agotado') {
        filtered = prods.filter(p => {
          if (p.es_vendible) return (dispMap.get(p.id)?.disponibilidad ?? 0) <= 0;
          return p.stock_actual <= 0;
        });
      }

      setProductos(filtered);
      if (cats !== categorias) setCategorias(cats);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally { setLoading(false); }
  }, [searchTerm, filterCategoria, filterEstado, filterStock]);

  useEffect(() => { loadData(); }, [filterCategoria, filterEstado, filterStock]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await productosService.delete(deleteTarget.id); setDeleteTarget(null); loadData(); }
    catch (err) { console.error('Error al eliminar:', err); }
    finally { setDeleting(false); }
  };

  const getStockStatus = (p: Producto) => {
    if (p.stock_actual <= 0)              return { label: 'Agotado',    cls: 'bg-red-100 text-red-700 border border-red-200'       };
    if (p.stock_actual <= p.stock_minimo) return { label: 'Stock Bajo', cls: 'bg-amber-100 text-amber-700 border border-amber-200' };
    return                                       { label: 'OK',         cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' };
  };

  const getStockEfectivo = (p: Producto) =>
    p.es_vendible ? (disponibilidades.get(p.id)?.disponibilidad ?? p.stock_actual) : p.stock_actual;

  const statsData = [
    { label: 'Total',      value: productos.length,                                                                                               icon: <Package     className="w-5 h-5" />, color: 'from-blue-500 to-blue-600'       },
    { label: 'Activos',    value: productos.filter(p => p.estado === ESTADOS.ACTIVO).length,                                                      icon: <Check       className="w-5 h-5" />, color: 'from-emerald-500 to-emerald-600' },
    { label: 'Stock Bajo', value: productos.filter(p => { const s = getStockEfectivo(p); return s <= p.stock_minimo && s > 0; }).length,           icon: <AlertCircle className="w-5 h-5" />, color: 'from-amber-500 to-amber-600'     },
    { label: 'Agotados',   value: productos.filter(p => getStockEfectivo(p) <= 0).length,                                                         icon: <Archive     className="w-5 h-5" />, color: 'from-red-500 to-red-600'         },
  ];

  // Agrupar productos en 3 secciones
  const matPrima      = productos.filter(p => p.tipo_materia === 'prima');
  const matProcesada  = productos.filter(p => p.tipo_materia === 'procesada' && !p.es_vendible);
  const prodTerminado = productos.filter(p => p.es_vendible);

  const CABECERAS = ['Producto', 'SKU', 'Categoría', 'Stock', 'Disponibilidad', 'Precio', 'Estado', 'Acciones'];

  const renderFila = (producto: Producto) => {
    const esTerminado = producto.es_vendible;
    const dispInfo    = esTerminado ? disponibilidades.get(producto.id) : undefined;

    // Para terminados: estado basado en disponibilidad calculada; para los demás: basado en stock_actual
    const stock = esTerminado
      ? (() => {
          if (dispInfo === undefined) return { label: '...', cls: 'bg-slate-100 text-slate-500 border border-slate-200' };
          if (dispInfo.disponibilidad <= 0)                   return { label: 'Agotado',    cls: 'bg-red-100 text-red-700 border border-red-200'       };
          if (dispInfo.disponibilidad <= producto.stock_minimo) return { label: 'Stock Bajo', cls: 'bg-amber-100 text-amber-700 border border-amber-200' };
          return { label: 'OK', cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' };
        })()
      : getStockStatus(producto);

    return (
      <tr key={producto.id} className="hover:bg-slate-50/80 transition-colors group">
        <td className="px-5 py-4">
          <div>
            <p className="font-semibold text-slate-800 text-sm">{producto.nombre}</p>
            <span className="text-xs text-slate-400 capitalize">{producto.unidad_medida}</span>
          </div>
        </td>
        <td className="px-5 py-4">
          <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">{producto.sku}</span>
        </td>
        <td className="px-5 py-4">
          <span className="text-sm text-slate-600">{producto.categoria?.nombre || <span className="text-slate-400 italic">Sin categoría</span>}</span>
        </td>
        <td className="px-5 py-4">
          {esTerminado ? (
            /* Stock calculado desde ingredientes (sin necesidad de lotes) */
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${stock.cls}`}>{stock.label}</span>
              {dispInfo !== undefined ? (
                <span className="text-xs text-slate-500">
                  {dispInfo.disponibilidad}/{producto.stock_minimo}
                </span>
              ) : (
                <RefreshCw className="w-3 h-3 text-slate-300 animate-spin" />
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${stock.cls}`}>{stock.label}</span>
              <span className="text-xs text-slate-500">{producto.stock_actual}/{producto.stock_minimo}</span>
            </div>
          )}
        </td>
        <td className="px-5 py-4">
          {esTerminado ? (
            <button
              onClick={() => setDisponibilidadTarget(producto)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-xs font-semibold transition-colors border border-teal-200"
              title="Ver desglose de ingredientes">
              <Calculator className="w-3.5 h-3.5" /> Ver desglose
            </button>
          ) : (
            <span className="text-xs text-slate-300">—</span>
          )}
        </td>
        <td className="px-5 py-4">
          <span className="text-sm font-semibold text-slate-700">{formatCurrency(producto.precio_unitario)}</span>
        </td>
        <td className="px-5 py-4">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${producto.estado === ESTADOS.ACTIVO ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
            {producto.estado}
          </span>
        </td>
        <td className="px-5 py-4">
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Configurar precio de venta: solo para MP y MPP */}
            {(producto.tipo_materia === 'prima' || (producto.tipo_materia === 'procesada' && !producto.es_vendible)) && (
              <button onClick={() => setPrecioVentaTarget(producto)}
                className="p-2 text-violet-600 hover:bg-violet-50 rounded-lg transition-colors" title="Configurar precio de venta">
                <Calculator className="w-4 h-4" />
              </button>
            )}
            {showVariantes && (
              <button onClick={() => setVariantesTarget(producto)}
                className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Variantes / presentaciones">
                <Layers className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => setMovimientoTarget(producto)}
              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Registrar movimiento">
              <TruckIcon className="w-4 h-4" />
            </button>
            <button onClick={() => { setSelectedProducto(producto); setModalMode('edit'); }}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={() => setDeleteTarget(producto)}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const renderSeccion = (
    titulo: string,
    colorHeader: string,
    colorCount: string,
    icono: React.ReactNode,
    lista: Producto[],
    sectionId: string
  ) => {
    if (lista.length === 0) return null;
    return (
      <div id={sectionId} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden scroll-mt-4">
        <div className={`px-5 py-3.5 flex items-center gap-3 border-b ${colorHeader}`}>
          <div className="flex items-center gap-2 flex-1">
            {icono}
            <h3 className="font-bold text-slate-700 text-sm">{titulo}</h3>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${colorCount}`}>
            {lista.length} producto{lista.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100">
                {CABECERAS.map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lista.map(renderFila)}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/50 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Valor total: {formatCurrency(lista.reduce((s, p) => s + p.precio_unitario * p.stock_actual, 0))}
          </span>
          <span className="text-xs text-slate-400">
            {lista.filter(p => p.estado === ESTADOS.ACTIVO).length} activos
          </span>
        </div>
      </div>
    );
  };

  if (loading && productos.length === 0) return (
    <div style={{ padding: 24 }}>
      <TableSkeleton rows={8} cols={6} />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100">

      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Inventario</h1>
            <p className="text-slate-500 text-sm mt-0.5">Gestión de productos y control de stock</p>
          </div>
          <button
            onClick={() => { setSelectedProducto(null); setModalMode('create'); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg text-sm">
            <Plus className="w-4 h-4" /> Nuevo Producto
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statsData.map((s, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className={`bg-gradient-to-br ${s.color} p-3 rounded-xl shadow-lg`}><div className="text-white">{s.icon}</div></div>
              <div><p className="text-sm text-slate-500">{s.label}</p><p className="text-2xl font-bold text-slate-800">{s.value}</p></div>
            </div>
          ))}
        </div>

        {/* Búsqueda y filtros */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <form onSubmit={e => { e.preventDefault(); loadData(); }} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar por nombre o SKU..."
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
            </div>
            <button type="button" onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium transition-colors ${showFilters ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <Filter className="w-4 h-4" /> Filtros <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            <button type="submit" className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all">Buscar</button>
            <button type="button" onClick={loadData} className="p-2.5 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors"><RefreshCw className="w-4 h-4" /></button>
          </form>
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select value={filterCategoria} onChange={e => setFilterCategoria(e.target.value)} className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">Todas las categorías</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">Todos los estados</option>
                <option value={ESTADOS.ACTIVO}>Activo</option>
                <option value={ESTADOS.INACTIVO}>Inactivo</option>
              </select>
              <select value={filterStock} onChange={e => setFilterStock(e.target.value)} className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">Stock: Todos</option>
                <option value="bajo">Stock Bajo</option>
                <option value="agotado">Agotados</option>
              </select>
            </div>
          )}
        </div>

        {/* ── Tabs de sección ── */}
        {productos.length > 0 && (() => {
          const tabs = [
            { key: 'all',       label: 'Todos',              count: productos.length,    icon: <LayoutGrid  className="w-4 h-4" />, active: 'bg-slate-800 text-white',   inactive: 'text-slate-600 hover:bg-slate-50',   badge: 'bg-white/20 text-white' },
            { key: 'prima',     label: 'Materias Primas',    count: matPrima.length,     icon: <Package     className="w-4 h-4" />, active: 'bg-blue-600 text-white',    inactive: 'text-blue-700 hover:bg-blue-50',     badge: 'bg-white/20 text-white', hidden: matPrima.length === 0 },
            { key: 'procesada', label: 'Procesadas',         count: matProcesada.length, icon: <Layers      className="w-4 h-4" />, active: 'bg-violet-600 text-white',  inactive: 'text-violet-700 hover:bg-violet-50', badge: 'bg-white/20 text-white', hidden: matProcesada.length === 0 },
            { key: 'terminado', label: 'Prod. Terminados',   count: prodTerminado.length,icon: <ShoppingBag className="w-4 h-4" />, active: 'bg-emerald-600 text-white', inactive: 'text-emerald-700 hover:bg-emerald-50',badge: 'bg-white/20 text-white', hidden: prodTerminado.length === 0 },
          ].filter(t => !t.hidden);
          return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-1.5 flex gap-1 flex-wrap">
              {tabs.map(tab => {
                const isActive = seccionActiva === tab.key;
                return (
                  <button key={tab.key} onClick={() => setSeccionActiva(tab.key as typeof seccionActiva)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${isActive ? tab.active : tab.inactive}`}>
                    {tab.icon}
                    {tab.label}
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full transition-all ${isActive ? tab.badge : 'bg-slate-100 text-slate-500'}`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })()}

        {/* ── Tabla en 3 secciones ── */}
        {productos.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <EmptyState
              message="No se encontraron productos"
              description="Crea tu primer producto para comenzar"
              actionLabel="+ Crear primer producto"
              onAction={() => setModalMode('create')}
            />
          </div>
        ) : (
          <>
            {(seccionActiva === 'all' || seccionActiva === 'prima') && renderSeccion(
              'Materias Primas',
              'bg-blue-50/80',
              'bg-blue-100 text-blue-700',
              <Package className="w-4 h-4 text-blue-600" />,
              matPrima,
              'seccion-prima'
            )}
            {(seccionActiva === 'all' || seccionActiva === 'procesada') && renderSeccion(
              'Materias Primas Procesadas',
              'bg-violet-50/80',
              'bg-violet-100 text-violet-700',
              <Layers className="w-4 h-4 text-violet-600" />,
              matProcesada,
              'seccion-procesada'
            )}
            {(seccionActiva === 'all' || seccionActiva === 'terminado') && renderSeccion(
              'Productos Terminados',
              'bg-emerald-50/80',
              'bg-emerald-100 text-emerald-700',
              <ShoppingBag className="w-4 h-4 text-emerald-600" />,
              prodTerminado,
              'seccion-terminado'
            )}
          </>
        )}

        {/* Footer global */}
        {productos.length > 0 && (
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-sm text-slate-500">
              <span className="font-semibold text-slate-700">{productos.length}</span> productos en total
            </p>
            <div className="flex items-center gap-1.5">
              <BarChart2 className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400">
                Valor inventario: {formatCurrency(productos.reduce((s, p) => s + p.precio_unitario * p.stock_actual, 0))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Modales */}
      {modalMode && (
        <ProductoModal
          mode={modalMode}
          producto={selectedProducto}
          categorias={categorias}
          onClose={() => { setModalMode(null); setSelectedProducto(null); }}
          onSave={(nuevoTerminadoId) => {
            setModalMode(null);
            setSelectedProducto(null);
            if (nuevoTerminadoId) {
              // Redirigir a Recetas para configurar la receta del producto terminado
              navigate('/recetas', { state: { nuevoProductoId: nuevoTerminadoId } });
            } else {
              loadData();
            }
          }}
        />
      )}

      {movimientoTarget && (
        <MovimientoModal
          producto={movimientoTarget}
          onClose={() => setMovimientoTarget(null)}
          onSave={() => { setMovimientoTarget(null); loadData(); }}
        />
      )}

      {disponibilidadTarget && (
        <DisponibilidadModal
          producto={disponibilidadTarget}
          onClose={() => setDisponibilidadTarget(null)}
        />
      )}

      {precioVentaTarget && (
        <PrecioVentaModal
          producto={precioVentaTarget}
          onClose={() => setPrecioVentaTarget(null)}
          onSave={() => { setPrecioVentaTarget(null); loadData(); }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar producto"
        message={`¿Estás seguro? Vas a eliminar "${deleteTarget?.nombre}". Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        confirmColor="error"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />

      {variantesTarget && (
        <VariantesDrawer
          producto={variantesTarget}
          onClose={() => setVariantesTarget(null)}
        />
      )}
    </div>
  );
};
