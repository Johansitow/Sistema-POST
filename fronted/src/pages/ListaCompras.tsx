/**
 * ListaCompras - Gestión de listas de compras automáticas
 *
 * Funcionalidades:
 * - Lista de todas las listas con filtros (estado, fecha)
 * - Detalle de cada lista con items y proveedor
 * - Acciones: marcar enviada, registrar recepción, cancelar
 * - Botón "Generar ahora" para trigger manual
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart, Plus, RefreshCw, X, Check, AlertCircle,
  ChevronDown, Filter, Package, Building2, Calendar, Eye,
  Send, Truck, Ban, ArrowRight, PencilLine, Trash2, Search,
} from 'lucide-react';
import { listaComprasService, type ListaCompras as ListaComprasData, EstadoListaCompras } from '../services/lista-compras.service';
import { productosService, type Producto } from '../services/productos.service';
import { useRestauranteActivo } from '../store/restauranteStore';
import { formatCurrency } from '../utils';
import { EmptyState, LoadingScreen, EstadoListaBadge as EstadoBadge, ESTADO_LISTA_CFG as ESTADO_CFG, ConfirmDialog, ErrorAlert } from '../components/common';
import { toast } from '../store/uiStore';
import { Z_INDEX } from '../lib/zIndex';
import { useEscapeKey } from '../hooks/useEscapeKey';

const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ============================================================================
// MODAL DETALLE
// ============================================================================
const DetalleModal: React.FC<{
  lista: ListaComprasData;
  onClose: () => void;
  onRefresh: () => void;
}> = ({ lista: initialLista, onClose, onRefresh }) => {
  const [lista, setLista]         = useState<ListaComprasData>(initialLista);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [cantidades, setCantidades] = useState<Record<number, string>>({});
  const [confirmCancelar, setConfirmCancelar] = useState(false);
  useEscapeKey(onClose);

  useEffect(() => {
    // Cargar detalle completo con items
    setLoading(true);
    listaComprasService.obtener(lista.id)
      .then(setLista)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [lista.id]);

  const cambiarEstado = async (estado: EstadoListaCompras) => {
    setSaving(true); setError(null);
    try {
      const updated = await listaComprasService.cambiarEstado(lista.id, estado);
      setLista(updated);
      toast.success(
        estado === 'enviada' ? 'Lista marcada como enviada'
        : estado === 'cancelada' ? 'Lista cancelada'
        : 'Estado actualizado'
      );
      onRefresh();
    } catch (e: any) {
      const msg = e.message || 'Error al cambiar estado';
      setError(msg);
      toast.error(msg);
    }
    finally { setSaving(false); }
  };

  const registrarRecepcion = async () => {
    setSaving(true); setError(null);
    try {
      // Actualizar cantidad recibida para cada item que tenga valor
      const updates = Object.entries(cantidades).filter(([, v]) => v !== '');
      for (const [idItem, val] of updates) {
        await listaComprasService.actualizarItem(lista.id, Number(idItem), { cantidad_recibida: parseFloat(val) });
      }
      // Cambiar estado a recibida o parcial
      const todosCompletos = (lista.items ?? []).every(item => {
        const rec = cantidades[item.id];
        return rec && parseFloat(rec) >= item.cantidad_sugerida;
      });
      await cambiarEstado(todosCompletos ? 'recibida' : 'parcial');
    } catch (e: any) {
      const msg = e.message || 'Error al registrar recepción';
      setError(msg);
      toast.error(msg);
    }
    finally { setSaving(false); }
  };

  const esEditable = lista.estado === 'generada' || lista.estado === 'enviada';

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: Z_INDEX.MODAL_BASE }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-indigo-200 text-xs font-mono">{lista.numero_lista}</p>
            <h2 className="text-white font-bold text-lg">Lista de Compras</h2>
            <div className="flex items-center gap-3 mt-1">
              <EstadoBadge estado={lista.estado} />
              {lista.proveedor_asignado && (
                <span className="text-indigo-200 text-xs flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> {lista.proveedor_asignado.razon_social}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/20 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && <ErrorAlert message={error} />}

          {/* Meta info */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Generada', value: fmt(lista.fecha_generacion) },
              { label: 'Enviada',  value: fmt(lista.fecha_envio) },
              { label: 'Recibida', value: fmt(lista.fecha_recepcion) },
            ].map(m => (
              <div key={m.label} className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500">{m.label}</p>
                <p className="text-sm font-semibold text-slate-700">{m.value}</p>
              </div>
            ))}
          </div>

          {/* Total estimado */}
          {lista.total_estimado != null && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
              <span className="text-sm text-indigo-700 font-medium">Total estimado</span>
              <span className="text-lg font-black text-indigo-800">{formatCurrency(lista.total_estimado)}</span>
            </div>
          )}

          {/* Notas */}
          {lista.notas && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">Notas</p>
              <p className="text-sm text-amber-800">{lista.notas}</p>
            </div>
          )}

          {/* Items */}
          {loading ? (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Cargando items...
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Items ({(lista.items ?? []).length})
              </p>
              <div className="space-y-2">
                {(lista.items ?? []).map(item => (
                  <div key={item.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{item.producto?.nombre}</p>
                        <p className="text-xs text-slate-400">{item.producto?.sku} · {item.producto?.unidad_medida}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Stock: <span className="font-semibold">{item.producto?.stock_actual ?? '?'}</span>
                          {item.producto?.stock_minimo && <> / Mín: {item.producto.stock_minimo}</>}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Sugerido</p>
                        <p className="text-base font-bold text-indigo-700">{item.cantidad_sugerida}</p>
                        {item.precio_estimado && (
                          <p className="text-xs text-slate-400">{formatCurrency(item.precio_estimado)}</p>
                        )}
                      </div>
                    </div>

                    {/* Campo de cantidad recibida (solo cuando está en estado enviada y recibiendo) */}
                    {(lista.estado === 'enviada' || lista.estado === 'generada') && (
                      <div className="flex items-center gap-2 mt-2">
                        <p className="text-xs text-slate-500 flex-shrink-0">Recibido:</p>
                        <input
                          type="number" min="0"
                          value={cantidades[item.id] ?? item.cantidad_recibida ?? ''}
                          onChange={e => setCantidades(prev => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder={`de ${item.cantidad_sugerida}`}
                          className="w-28 px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                        <span className="text-xs text-slate-400">{item.producto?.unidad_medida}</span>
                      </div>
                    )}

                    {/* Mostrar cantidad ya recibida */}
                    {lista.estado === 'recibida' || lista.estado === 'parcial' ? (
                      <p className="text-xs text-emerald-600 mt-1 font-semibold">
                        Recibido: {item.cantidad_recibida ?? '—'} / {item.cantidad_sugerida}
                      </p>
                    ) : null}

                    {item.observaciones && (
                      <p className="text-xs text-slate-400 mt-1 italic">{item.observaciones}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer con acciones */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-2 justify-between">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
            Cerrar
          </button>
          <div className="flex gap-2">
            {lista.estado === 'generada' && (
              <button onClick={() => cambiarEstado('enviada')} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Marcar enviada
              </button>
            )}
            {(lista.estado === 'enviada' || lista.estado === 'generada') && (
              <button onClick={registrarRecepcion} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                Registrar recepción
              </button>
            )}
            {esEditable && (
              <button onClick={() => setConfirmCancelar(true)} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
                <Ban className="w-4 h-4" /> Cancelar lista
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmCancelar}
        title="Cancelar lista de compras"
        message={`¿Cancelar la lista ${lista.numero_lista}? No podrás enviarla ni recibirla después.`}
        confirmText="Sí, cancelar"
        cancelText="No, volver"
        confirmColor="error"
        onConfirm={() => cambiarEstado('cancelada')}
        onClose={() => setConfirmCancelar(false)}
      />
    </div>
  );
};

// ============================================================================
// MODAL: NUEVA LISTA MANUAL
// ============================================================================
interface ItemManual { id_producto: number; nombre: string; unidad: string; cantidad: string; }

const NuevaListaModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState('');
  const [notas, setNotas]         = useState('');
  const [items, setItems]         = useState<ItemManual[]>([]);
  useEscapeKey(onClose);

  useEffect(() => {
    setLoading(true);
    productosService.getAll({ estado: 'activo', limit: 500 })
      .then(setProductos)
      .catch(() => setError('No se pudieron cargar los productos'))
      .finally(() => setLoading(false));
  }, []);

  const agregar = (p: Producto) => {
    if (items.some(it => it.id_producto === p.id)) return;
    setItems(prev => [...prev, { id_producto: p.id, nombre: p.nombre, unidad: p.unidad_medida, cantidad: '1' }]);
  };
  const quitar = (id: number) => setItems(prev => prev.filter(it => it.id_producto !== id));
  const setCantidad = (id: number, v: string) =>
    setItems(prev => prev.map(it => it.id_producto === id ? { ...it, cantidad: v } : it));

  const disponibles = productos.filter(p =>
    !items.some(it => it.id_producto === p.id) &&
    (search === '' || p.nombre.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))
  );

  const guardar = async () => {
    const validos = items
      .map(it => ({ ...it, cant: parseFloat(it.cantidad) }))
      .filter(it => it.cant > 0);
    if (validos.length === 0) { setError('Agrega al menos un producto con cantidad mayor a 0'); return; }

    setSaving(true); setError(null);
    try {
      await listaComprasService.crearManual({
        notas: notas.trim() || undefined,
        items: validos.map(it => ({ id_producto: it.id_producto, cantidad_sugerida: it.cant })),
      });
      toast.success('Lista creada');
      onCreated();
    } catch (e: any) {
      const msg = e.message || 'Error al crear la lista';
      setError(msg); toast.error(msg);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: Z_INDEX.MODAL_BASE }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">Nueva lista de compras</h2>
            <p className="text-indigo-200 text-xs mt-0.5">Elige los productos y las cantidades a pedir</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/20 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && <ErrorAlert message={error} />}

          {/* Buscador de productos */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Agregar producto</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre o SKU..."
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            {loading ? (
              <p className="text-sm text-slate-400 mt-2">Cargando productos...</p>
            ) : search && (
              <div className="mt-2 max-h-40 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50">
                {disponibles.slice(0, 20).map(p => (
                  <button key={p.id} onClick={() => { agregar(p); setSearch(''); }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-indigo-50 transition-colors text-left">
                    <span className="text-sm text-slate-700">{p.nombre} <span className="text-slate-400 text-xs">· {p.sku}</span></span>
                    <Plus className="w-4 h-4 text-indigo-600" />
                  </button>
                ))}
                {disponibles.length === 0 && <p className="text-sm text-slate-400 px-3 py-2">Sin resultados</p>}
              </div>
            )}
          </div>

          {/* Items elegidos */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Productos en la lista ({items.length})</p>
            {items.length === 0 ? (
              <p className="text-sm text-slate-400 bg-slate-50 rounded-xl px-4 py-6 text-center">
                Aún no has agregado productos. Búscalos arriba.
              </p>
            ) : (
              <div className="space-y-2">
                {items.map(it => (
                  <div key={it.id_producto} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{it.nombre}</p>
                    </div>
                    <input
                      type="number" min="0" step="any"
                      value={it.cantidad}
                      onChange={e => setCantidad(it.id_producto, e.target.value)}
                      className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    <span className="text-xs text-slate-400 w-14">{it.unidad}</span>
                    <button onClick={() => quitar(it.id_producto)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Notas <span className="text-slate-400 font-normal normal-case">(opcional)</span></label>
            <textarea rows={2} value={notas} onChange={e => setNotas(e.target.value)}
              placeholder="Ej: pedido urgente para el fin de semana..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
            Cancelar
          </button>
          <button onClick={guardar} disabled={saving || items.length === 0}
            className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-violet-700 transition-all disabled:opacity-50">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Crear lista
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export const ListaCompras: React.FC = () => {
  const idRestaurante                   = useRestauranteActivo();
  const [listas, setListas]             = useState<ListaComprasData[]>([]);
  const [loading, setLoading]           = useState(true);
  const [generating, setGenerating]     = useState(false);
  const [filterEstado, setFilterEstado] = useState<EstadoListaCompras | ''>('');
  const [showFilters, setShowFilters]   = useState(false);
  const [detalleTarget, setDetalleTarget] = useState<ListaComprasData | null>(null);
  const [showNueva, setShowNueva]       = useState(false);
  const [pagination, setPagination]     = useState<any>({});
  const [page, setPage]                 = useState(1);
  const [genMsg, setGenMsg]             = useState<{ type: 'ok' | 'warn'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listaComprasService.listar({
        page,
        limit:          20,
        estado:         filterEstado || undefined,
        id_restaurante: idRestaurante,
      });
      setListas(res.data);
      setPagination(res.pagination);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, filterEstado, idRestaurante]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleGenerar = async () => {
    setGenerating(true); setGenMsg(null);
    try {
      const res = await listaComprasService.generarAutomatico(
        `Generada manualmente — ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`
      );
      if (res.lista) {
        setGenMsg({ type: 'ok', text: `✓ Lista ${res.lista.numero_lista} creada con ${res.total_items} items.` });
        loadData();
      } else {
        setGenMsg({ type: 'warn', text: 'No hay productos con stock bajo en este momento.' });
      }
    } catch (e: any) {
      setGenMsg({ type: 'warn', text: e.message || 'Error al generar la lista' });
    } finally {
      setGenerating(false);
      setTimeout(() => setGenMsg(null), 6000);
    }
  };

  const statsCount = (estado: EstadoListaCompras) => listas.filter(l => l.estado === estado).length;

  if (loading && listas.length === 0) return <LoadingScreen message="Cargando listas de compras..." />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-slate-100">

      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Lista de Compras</h1>
            <p className="text-slate-500 text-sm mt-0.5">Gestión automática de compras por stock bajo</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNueva(true)}
              className="flex items-center gap-2 px-5 py-2.5 border border-indigo-200 text-indigo-700 bg-white rounded-xl font-semibold hover:bg-indigo-50 transition-all text-sm">
              <PencilLine className="w-4 h-4" />
              Nueva lista
            </button>
            <button onClick={handleGenerar} disabled={generating}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg text-sm disabled:opacity-60">
              {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {generating ? 'Generando...' : 'Generar automática'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">

        {/* Banner de resultado de generación */}
        {genMsg && (
          <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border text-sm font-medium ${genMsg.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
            {genMsg.type === 'ok' ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {genMsg.text}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Total',     value: listas.length,          color: 'from-slate-500 to-slate-600' },
            { label: 'Generadas', value: statsCount('generada'),  color: 'from-blue-500 to-blue-600'   },
            { label: 'Enviadas',  value: statsCount('enviada'),   color: 'from-amber-500 to-amber-600' },
            { label: 'Recibidas', value: statsCount('recibida'),  color: 'from-emerald-500 to-emerald-600' },
            { label: 'Canceladas',value: statsCount('cancelada'), color: 'from-red-400 to-red-500'     },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className={`bg-gradient-to-br ${s.color} w-9 h-9 rounded-xl flex items-center justify-center shadow`}>
                <ShoppingCart className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="text-xl font-bold text-slate-800">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex gap-3 items-center">
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium transition-colors ${showFilters ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <Filter className="w-4 h-4" /> Filtrar por estado
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
          {filterEstado && (
            <button onClick={() => setFilterEstado('')}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors">
              <X className="w-3.5 h-3.5" /> Limpiar
            </button>
          )}
          <button onClick={loadData} className="ml-auto p-2.5 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {showFilters && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="flex flex-wrap gap-2">
              {(['generada', 'enviada', 'recibida', 'parcial', 'cancelada'] as EstadoListaCompras[]).map(est => {
                const cfg = ESTADO_CFG[est];
                return (
                  <button key={est} onClick={() => setFilterEstado(filterEstado === est ? '' : est)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${filterEstado === est ? `${cfg.cls}` : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-slate-50'}`}>
                    {cfg.icon} {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabla */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                  {['Número', 'Estado', 'Proveedor', 'Items', 'Total Estimado', 'Generada', 'Acciones'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listas.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        message="No hay listas de compras"
                        description='Genera una lista automáticamente al hacer clic en "Generar ahora"'
                        actionLabel="Generar ahora"
                        onAction={handleGenerar}
                      />
                    </td>
                  </tr>
                ) : listas.map(lista => (
                  <tr key={lista.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                          <ShoppingCart className="w-4 h-4 text-indigo-600" />
                        </div>
                        <span className="font-mono text-sm font-bold text-slate-700">{lista.numero_lista}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <EstadoBadge estado={lista.estado} />
                    </td>
                    <td className="px-5 py-4">
                      {lista.proveedor_asignado ? (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-sm text-slate-600">{lista.proveedor_asignado.razon_social}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm italic">Sin asignar</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                        <Package className="w-3 h-3" /> {lista._count?.items ?? (lista.items?.length ?? 0)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {lista.total_estimado != null
                        ? <span className="text-sm font-semibold text-slate-700">{formatCurrency(lista.total_estimado)}</span>
                        : <span className="text-slate-400 text-sm">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-slate-500">
                        <Calendar className="w-3.5 h-3.5" />
                        {fmt(lista.fecha_generacion)}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setDetalleTarget(lista)}
                          className="flex items-center gap-1 p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors text-xs font-semibold"
                          title="Ver detalle">
                          <Eye className="w-4 h-4" />
                        </button>
                        {lista.estado === 'generada' && (
                          <button
                            onClick={async () => {
                              try {
                                await listaComprasService.cambiarEstado(lista.id, 'enviada');
                                toast.success('Lista marcada como enviada');
                                loadData();
                              } catch (e: any) { toast.error(e.message || 'Error al cambiar estado'); }
                            }}
                            className="flex items-center gap-1 p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Marcar enviada">
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                        {lista.estado === 'enviada' && (
                          <button
                            onClick={() => setDetalleTarget(lista)}
                            className="flex items-center gap-1 p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Registrar recepción">
                            <Truck className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <p className="text-sm text-slate-500">
                <span className="font-semibold">{pagination.total}</span> listas
              </p>
              <div className="flex items-center gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition-colors">
                  Anterior
                </button>
                <span className="text-xs text-slate-600">{page} / {pagination.totalPages}</span>
                <button disabled={page === pagination.totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition-colors">
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Info auto-generación */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <ArrowRight className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-700 text-sm">Cómo se arma la lista automática</p>
            <p className="text-slate-500 text-sm mt-1">
              Al generar automáticamente, el sistema incluye los productos <strong>agotados</strong>, los que están
              <strong> bajo su mínimo</strong>, y los de <strong>alta rotación</strong> cuyo stock quedó por debajo del ideal
              calculado según la tendencia de consumo de las últimas semanas. La cantidad sugerida lleva cada producto
              hasta ese stock ideal, y se asigna el mejor proveedor disponible. Cada ítem indica el motivo por el que entró.
            </p>
          </div>
        </div>
      </div>

      {detalleTarget && (
        <DetalleModal
          lista={detalleTarget}
          onClose={() => setDetalleTarget(null)}
          onRefresh={() => { setDetalleTarget(null); loadData(); }}
        />
      )}

      {showNueva && (
        <NuevaListaModal
          onClose={() => setShowNueva(false)}
          onCreated={() => { setShowNueva(false); loadData(); }}
        />
      )}
    </div>
  );
};
