/**
 * Lotes — Gestión de lotes de producción y entradas de inventario
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertCircle, RefreshCw, Search, Filter, ChevronDown,
  ChevronLeft, ChevronRight, Hash, Calendar, Users, DollarSign,
  AlertTriangle, CheckCircle2, Archive, Layers, Clock, BarChart2, X,
} from 'lucide-react';
import api from '../services/api';
import { useRestauranteActivo } from '../store/restauranteStore';
import { formatCurrency } from '../utils';
import { LoadingScreen, EmptyState } from '../components/common';
import LoteRentabilidad from '../components/lotes/LoteRentabilidad';
import { Z_INDEX } from '../lib/zIndex';
import { inventarioService, type VidaUtilPromedio } from '../services/inventario.service';

// ── Tipos ────────────────────────────────────────────────────────────────────

type EstadoLote = 'activo' | 'vencido' | 'agotado' | 'en_produccion';

interface Lote {
  id:                     number;
  numero_lote:            string;
  id_producto:            number;
  id_usuario_responsable: number | null;
  cantidad_producida:     number | string;
  merma_cantidad:         number | string;
  merma_porcentaje:       number | string;
  fecha_produccion:       string;
  fecha_vencimiento:      string | null;
  fecha_cierre:           string | null;
  vida_util_dias:         number | null;
  estado_lote:            EstadoLote;
  costo_produccion:       number | string | null;
  observaciones:          string | null;
  producto: {
    id:           number;
    nombre:       string;
    sku:          string;
    unidad_medida: string;
    tipo_materia: string;
  };
  responsable: {
    id:             number;
    nombre_completo: string | null;
    usuario:         string;
  } | null;
}

// ── Configuración por estado ──────────────────────────────────────────────────

const ESTADO_CONFIG: Record<EstadoLote, {
  label: string; icon: React.ReactNode;
  badge: string; row: string;
}> = {
  activo: {
    label: 'Activo',
    icon:  <CheckCircle2 className="w-3.5 h-3.5" />,
    badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    row:   '',
  },
  vencido: {
    label: 'Vencido',
    icon:  <AlertTriangle className="w-3.5 h-3.5" />,
    badge: 'bg-red-100 text-red-700 border border-red-200',
    row:   'bg-red-50/40',
  },
  agotado: {
    label: 'Agotado',
    icon:  <Archive className="w-3.5 h-3.5" />,
    badge: 'bg-slate-100 text-slate-600 border border-slate-200',
    row:   'opacity-60',
  },
  en_produccion: {
    label: 'En producción',
    icon:  <Layers className="w-3.5 h-3.5" />,
    badge: 'bg-blue-100 text-blue-700 border border-blue-200',
    row:   '',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function diasHastaVencer(fecha: string | null): number | null {
  if (!fecha) return null;
  return Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000);
}

function formatFecha(fecha: string | null): string {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: '2-digit',
  });
}

// ── Componente principal ──────────────────────────────────────────────────────

export const Lotes: React.FC = () => {
  const idRestaurante               = useRestauranteActivo();
  const [lotes, setLotes]           = useState<Lote[]>([]);
  const [meta, setMeta]             = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState('');
  const [filterEstado, setFilterEstado] = useState<EstadoLote | ''>('');
  const [showFilters, setShowFilters]   = useState(false);
  const [rentabilidadLote, setRentabilidadLote] = useState<Lote | null>(null);
  const [vidaUtilPromedio, setVidaUtilPromedio] = useState<VidaUtilPromedio[]>([]);

  const LIMIT = 20;

  const loadLotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page:  String(page),
        limit: String(LIMIT),
      });
      if (filterEstado)  params.append('estado_lote',    filterEstado);
      if (idRestaurante) params.append('id_restaurante', String(idRestaurante));

      const res = await api.get(`/inventario/lotes?${params.toString()}`);
      const raw: Lote[] = res.data?.data ?? [];

      // Filtro de búsqueda local (numero_lote o nombre producto)
      const filtrado = search.trim()
        ? raw.filter(l =>
            l.numero_lote.toLowerCase().includes(search.toLowerCase()) ||
            l.producto?.nombre?.toLowerCase().includes(search.toLowerCase()) ||
            l.producto?.sku?.toLowerCase().includes(search.toLowerCase())
          )
        : raw;

      setLotes(filtrado);
      setMeta(res.data?.meta ?? null);
    } catch (e) {
      console.error('Error al cargar lotes:', e);
    } finally {
      setLoading(false);
    }
  }, [page, filterEstado, idRestaurante]);

  useEffect(() => { loadLotes(); }, [filterEstado, page]);

  useEffect(() => {
    inventarioService.getVidaUtilPromedio()
      .then(setVidaUtilPromedio)
      .catch(() => setVidaUtilPromedio([]));
  }, [idRestaurante]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadLotes();
  };

  // ── Stats ──
  const activos        = lotes.filter(l => l.estado_lote === 'activo').length;
  const proxVencer     = lotes.filter(l => {
    const d = diasHastaVencer(l.fecha_vencimiento);
    return d !== null && d >= 0 && d <= 7;
  }).length;
  const vencidos       = lotes.filter(l => l.estado_lote === 'vencido').length;

  const statsData = [
    { label: 'Total lotes',     value: lotes.length,  icon: <Hash     className="w-5 h-5" />, color: 'from-blue-500 to-blue-600'     },
    { label: 'Activos',         value: activos,        icon: <CheckCircle2 className="w-5 h-5" />, color: 'from-emerald-500 to-emerald-600' },
    { label: 'Próx. a vencer',  value: proxVencer,     icon: <Clock    className="w-5 h-5" />, color: 'from-amber-500 to-amber-600'   },
    { label: 'Vencidos',        value: vencidos,       icon: <AlertTriangle className="w-5 h-5" />, color: 'from-red-500 to-red-600'  },
  ];

  if (loading && lotes.length === 0) return <LoadingScreen message="Cargando lotes..." />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100">

      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Hash className="w-6 h-6 text-indigo-600" /> Lotes
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">Control de lotes de producción y entradas de inventario</p>
          </div>
          <button onClick={loadLotes}
            className="p-2.5 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors" title="Actualizar">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statsData.map((s, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className={`bg-gradient-to-br ${s.color} p-3 rounded-xl shadow-lg`}>
                <div className="text-white">{s.icon}</div>
              </div>
              <div>
                <p className="text-sm text-slate-500">{s.label}</p>
                <p className="text-2xl font-bold text-slate-800">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Búsqueda y filtros */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por N° lote, producto o SKU..."
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
            </div>
            <button type="button" onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium transition-colors ${showFilters ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <Filter className="w-4 h-4" /> Filtros
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            <button type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-blue-700 transition-all">
              Buscar
            </button>
          </form>
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <select value={filterEstado} onChange={e => { setFilterEstado(e.target.value as any); setPage(1); }}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="">Todos los estados</option>
                <option value="activo">Activo</option>
                <option value="en_produccion">En producción</option>
                <option value="vencido">Vencido</option>
                <option value="agotado">Agotado</option>
              </select>
            </div>
          )}
        </div>

        {/* Alerta de reconteo — lotes próximos a vencer */}
        {proxVencer > 0 && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              <strong>{proxVencer} lote{proxVencer > 1 ? 's' : ''}</strong> vence{proxVencer > 1 ? 'n' : ''} en los próximos 7 días.
              Haz un reconteo para verificar si {proxVencer > 1 ? 'se están dañando' : 'se está dañando'} antes de tiempo.
            </p>
          </div>
        )}

        {/* Vida útil promedio de productos caseros/almacenados */}
        {vidaUtilPromedio.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <p className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-indigo-600" /> Vida útil promedio (productos almacenados)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {vidaUtilPromedio.map(v => (
                <div key={v.id_producto} className="border border-slate-100 rounded-xl px-3.5 py-3">
                  <p className="text-sm font-semibold text-slate-700 truncate">{v.nombre}</p>
                  {v.dias_reales_promedio != null ? (
                    <p className="text-lg font-bold text-emerald-600">
                      {v.dias_reales_promedio}d <span className="text-xs font-normal text-slate-400">real ({v.muestras_reales} lote{v.muestras_reales > 1 ? 's' : ''})</span>
                    </p>
                  ) : v.dias_estimados_promedio != null ? (
                    <p className="text-lg font-bold text-slate-500">
                      {v.dias_estimados_promedio}d <span className="text-xs font-normal text-slate-400">estimado — aún sin datos reales</span>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-300">Sin datos suficientes</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabla */}
        {lotes.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <EmptyState
              message="No se encontraron lotes"
              description="Los lotes se registran opcionalmente al agregar cantidad en Inventario, marcando 'Registrar lote'"
              actionLabel="Ir a Inventario"
              onAction={() => window.location.href = '/inventario'}
            />
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    {['N° Lote', 'Producto', 'Cantidad', 'Producción', 'Vencimiento', 'Estado', 'Responsable', 'Costo', ''].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lotes.map(lote => {
                    const cfg     = ESTADO_CONFIG[lote.estado_lote] ?? ESTADO_CONFIG.activo;
                    const dias    = diasHastaVencer(lote.fecha_vencimiento);
                    const urgente = dias !== null && dias >= 0 && dias <= 7;
                    const vencido = dias !== null && dias < 0;

                    return (
                      <tr key={lote.id} className={`hover:bg-slate-50/60 transition-colors ${cfg.row}`}>
                        {/* N° Lote */}
                        <td className="px-5 py-4">
                          <span className="font-mono text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-lg">
                            {lote.numero_lote}
                          </span>
                        </td>

                        {/* Producto */}
                        <td className="px-5 py-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{lote.producto?.nombre ?? '—'}</p>
                            <p className="text-xs text-slate-400 font-mono">{lote.producto?.sku}</p>
                          </div>
                        </td>

                        {/* Cantidad */}
                        <td className="px-5 py-4">
                          <div>
                            <p className="text-sm font-bold text-slate-700">
                              {Number(lote.cantidad_producida).toFixed(2)}
                              <span className="text-xs font-normal text-slate-400 ml-1">{lote.producto?.unidad_medida}</span>
                            </p>
                            {Number(lote.merma_cantidad) > 0 && (
                              <p className="text-xs text-amber-600">
                                Merma: {Number(lote.merma_cantidad).toFixed(2)} ({Number(lote.merma_porcentaje).toFixed(1)}%)
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Fecha producción */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 text-sm text-slate-600">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {formatFecha(lote.fecha_produccion)}
                          </div>
                        </td>

                        {/* Vencimiento */}
                        <td className="px-5 py-4">
                          {lote.fecha_vencimiento ? (
                            <div>
                              <p className={`text-sm font-medium ${vencido ? 'text-red-600' : urgente ? 'text-amber-600' : 'text-slate-700'}`}>
                                {formatFecha(lote.fecha_vencimiento)}
                              </p>
                              <p className={`text-xs ${vencido ? 'text-red-500' : urgente ? 'text-amber-500' : 'text-slate-400'}`}>
                                {vencido
                                  ? `Vencido hace ${Math.abs(dias!)}d`
                                  : urgente
                                    ? `⚠ Vence en ${dias}d`
                                    : `En ${dias}d`}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">Sin fecha</span>
                          )}
                          {lote.fecha_cierre && (
                            <p className="text-xs text-indigo-600 mt-0.5">
                              Real: {Math.round((new Date(lote.fecha_cierre).getTime() - new Date(lote.fecha_produccion).getTime()) / 86400000)}d
                            </p>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badge}`}>
                            {cfg.icon} {cfg.label}
                          </span>
                        </td>

                        {/* Responsable */}
                        <td className="px-5 py-4">
                          {lote.responsable ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center">
                                <Users className="w-3 h-3 text-indigo-600" />
                              </div>
                              <span className="text-xs text-slate-600">
                                {lote.responsable.nombre_completo ?? lote.responsable.usuario}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>

                        {/* Costo */}
                        <td className="px-5 py-4">
                          {lote.costo_produccion != null ? (
                            <div className="flex items-center gap-1 text-sm font-semibold text-slate-700">
                              <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                              {formatCurrency(Number(lote.costo_produccion))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>

                        {/* Rentabilidad */}
                        <td className="px-5 py-4">
                          <button
                            onClick={() => setRentabilidadLote(lote)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium hover:bg-indigo-100 transition-colors"
                            title="Ver rentabilidad real"
                          >
                            <BarChart2 className="w-3.5 h-3.5" /> Rentabilidad
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {meta && meta.totalPages > 1 && (
              <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                <p className="text-xs text-slate-500">
                  Página <strong>{page}</strong> de <strong>{meta.totalPages}</strong>
                  {meta.total && ` · ${meta.total} lotes`}
                </p>
                <div className="flex items-center gap-2">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                    className="p-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1.5 text-xs text-slate-600">{page} / {meta.totalPages}</span>
                  <button disabled={page === meta.totalPages} onClick={() => setPage(p => p + 1)}
                    className="p-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Nota */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
          <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            Los lotes se registran opcionalmente al marcar <strong>"Registrar lote"</strong> en un movimiento de Entrada o Producción del módulo de Inventario — solo aplica a productos que se almacenan.
            Cada lote tiene un número único y trazabilidad completa del producto.
          </p>
        </div>

      </div>

      {/* Indicador de carga superpuesto */}
      {loading && lotes.length > 0 && (
        <div className="fixed bottom-6 right-6 bg-white rounded-xl shadow-lg border border-slate-200 px-4 py-2.5 flex items-center gap-2 z-50">
          <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" />
          <span className="text-sm text-slate-600">Actualizando...</span>
        </div>
      )}

      {/* Modal rentabilidad */}
      {rentabilidadLote && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
          style={{ zIndex: Z_INDEX.MODAL_BASE }}
          onClick={() => setRentabilidadLote(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <p className="text-white/70 text-xs mb-0.5">{rentabilidadLote.numero_lote}</p>
                <h2 className="text-white font-bold">{rentabilidadLote.producto.nombre} — Rentabilidad real</h2>
              </div>
              <button
                onClick={() => setRentabilidadLote(null)}
                className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <LoteRentabilidad loteId={rentabilidadLote.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
