/**
 * LotesTab — vistas "Lotes" y "Producción" del módulo Inventario.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertCircle, RefreshCw, Search, Filter, ChevronDown,
  ChevronLeft, ChevronRight, Hash, Calendar, Users, DollarSign,
  AlertTriangle, CheckCircle2, Layers, Clock, BarChart2, X,
  Plus, ClipboardCheck, Trash2, RotateCcw, Check,
} from 'lucide-react';
import api from '../../services/api';
import { useRestauranteActivo } from '../../store/restauranteStore';
import { formatCurrency } from '../../utils';
import { LoadingScreen, EmptyState, ErrorAlert } from '../../components/common';
import LoteRentabilidad from '../../components/lotes/LoteRentabilidad';
import { Z_INDEX } from '../../lib/zIndex';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { toast } from '../../store/uiStore';
import { inventarioService, type VidaUtilPromedio } from '../../services/inventario.service';
import { productosService, type Producto } from '../../services/productos.service';
import { proveedorService, type Proveedor } from '../../services/servicios-gestion';
import { usuariosService } from '../../services/usuarios.service';
import { type Lote, type EstadoLote, ESTADO_CONFIG, diasHastaVencer, formatFecha } from './shared';
import { DevolucionModal } from './DevolucionModal';

interface LotesTabProps {
  /** true = pestaña "Producción" (solo productos elaborados con receta interna) */
  soloProduccion: boolean;
}

// ── Componente principal ──────────────────────────────────────────────────────

export const LotesTab: React.FC<LotesTabProps> = ({ soloProduccion }) => {
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
  const [showNuevoLote, setShowNuevoLote]       = useState(false);
  const [reconteoLote, setReconteoLote]         = useState<Lote | null>(null);
  const [frecuenciaReconteo, setFrecuenciaReconteo] = useState<number>(7);
  const [savingFrecuencia, setSavingFrecuencia] = useState(false);
  const [mermaLote, setMermaLote]               = useState<Lote | null>(null);
  // Devolución: acción rápida por lote (lote preseleccionado)
  const [devolucionLote, setDevolucionLote]     = useState<Lote | null>(null);

  useEscapeKey(() => setRentabilidadLote(null), rentabilidadLote !== null);

  const LIMIT = 20;

  const loadVidaUtil = useCallback(() => {
    inventarioService.getVidaUtilPromedio()
      .then(setVidaUtilPromedio)
      .catch(() => setVidaUtilPromedio([]));
  }, []);

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

  useEffect(() => { loadVidaUtil(); }, [idRestaurante, loadVidaUtil]);

  // Frecuencia de reconteo configurada para la sede (default 7 días).
  useEffect(() => {
    inventarioService.getFrecuenciaReconteo()
      .then(setFrecuenciaReconteo)
      .catch(() => setFrecuenciaReconteo(7));
  }, [idRestaurante]);

  const cambiarFrecuencia = async (dias: number) => {
    setSavingFrecuencia(true);
    try {
      const guardado = await inventarioService.setFrecuenciaReconteo(dias);
      setFrecuenciaReconteo(guardado);
      toast.success(`Reconteo permitido cada ${guardado} día(s)`);
    } catch (e: any) {
      toast.error(e.message || 'No se pudo actualizar la frecuencia');
    } finally {
      setSavingFrecuencia(false);
    }
  };

  /**
   * Gate de reconteo por lote calculado en el cliente con la frecuencia de la
   * sede y el último reconteo del lote — evita una llamada por lote.
   */
  const reconteoGate = (lote: Lote): { permitido: boolean; proximo: Date | null } => {
    if (!lote.fecha_ultimo_reconteo) return { permitido: true, proximo: null };
    const proximo = new Date(new Date(lote.fecha_ultimo_reconteo).getTime() + frecuenciaReconteo * 86_400_000);
    return { permitido: Date.now() >= proximo.getTime(), proximo };
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadLotes();
  };

  /** Refresca la tabla y la analítica tras crear/actualizar un lote */
  const refrescarTodo = () => {
    loadLotes();
    loadVidaUtil();
  };

  // ── Stats ──
  const activos        = lotes.filter(l => l.estado_lote === 'activo').length;
  const proxVencer     = lotes.filter(l => {
    const d = diasHastaVencer(l.fecha_vencimiento);
    return d !== null && d >= 0 && d <= 7;
  }).length;
  const vencidos       = lotes.filter(l => l.estado_lote === 'vencido').length;

  // La pestaña Producción solo muestra lotes de productos que se elaboran con receta interna
  const lotesVista = soloProduccion
    ? lotes.filter(l => l.producto?.tipo_materia === 'procesada')
    : lotes;

  const statsData = [
    { label: 'Total lotes',     value: lotes.length,  icon: <Hash     className="w-5 h-5" />, color: 'from-blue-500 to-blue-600'     },
    { label: 'Activos',         value: activos,        icon: <CheckCircle2 className="w-5 h-5" />, color: 'from-emerald-500 to-emerald-600' },
    { label: 'Próx. a vencer',  value: proxVencer,     icon: <Clock    className="w-5 h-5" />, color: 'from-amber-500 to-amber-600'   },
    { label: 'Vencidos',        value: vencidos,       icon: <AlertTriangle className="w-5 h-5" />, color: 'from-red-500 to-red-600'  },
  ];

  if (loading && lotes.length === 0) return <LoadingScreen message="Cargando lotes..." />;

  return (
    <>
      {/* Sub-header: subtítulo + acción principal de esta pestaña */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <p className="text-slate-500 text-sm">
            {soloProduccion
              ? 'Registra qué elaboraste internamente (con receta), su caducidad y su merma esperada'
              : 'Control de fechas de caducidad y reconteo de productos almacenados'}
          </p>
          <div className="flex items-center gap-2">
            {!soloProduccion && (
              <label className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 bg-white"
                title="Cada cuántos días se permite hacer reconteo de un lote">
                <ClipboardCheck className="w-4 h-4 text-amber-500" />
                <span className="hidden sm:inline">Reconteo cada</span>
                <select
                  value={frecuenciaReconteo}
                  disabled={savingFrecuencia}
                  onChange={e => cambiarFrecuencia(Number(e.target.value))}
                  className="bg-transparent font-semibold text-slate-700 outline-none cursor-pointer disabled:opacity-50">
                  {[2, 3, 7, 15, 30].map(d => <option key={d} value={d}>{d} días</option>)}
                </select>
              </label>
            )}
            <button onClick={() => setShowNuevoLote(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-blue-700 transition-all shadow-sm">
              <Plus className="w-4 h-4" /> {soloProduccion ? 'Nueva Producción' : 'Nuevo Lote'}
            </button>
            <button onClick={refrescarTodo}
              className="p-2.5 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors" title="Actualizar">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
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
        {lotesVista.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <EmptyState
              message={soloProduccion ? 'No hay producciones registradas' : 'No se encontraron lotes'}
              description={soloProduccion
                ? 'Registra una producción para llevar el lote, la caducidad y la merma de un producto elaborado internamente'
                : "Crea un lote para llevar control de fecha de caducidad y reconteo de un producto que se almacena"}
              actionLabel={soloProduccion ? 'Nueva Producción' : 'Nuevo Lote'}
              onAction={() => setShowNuevoLote(true)}
            />
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    {['N° Lote', 'Producto', 'Cantidad', 'Producción', 'Vencimiento', 'Estado', 'Responsable', 'Costo', 'Acciones'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lotesVista.map(lote => {
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

                        {/* Acciones */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {lote.estado_lote !== 'agotado' && (() => {
                              const gate = reconteoGate(lote);
                              return (
                                <button
                                  onClick={() => setReconteoLote(lote)}
                                  disabled={!gate.permitido}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                    gate.permitido
                                      ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                  }`}
                                  title={gate.permitido
                                    ? 'Registrar reconteo'
                                    : `Próximo reconteo: ${gate.proximo?.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}`}
                                >
                                  <ClipboardCheck className="w-3.5 h-3.5" /> Reconteo
                                </button>
                              );
                            })()}
                            {(lote.estado_lote === 'activo' || lote.estado_lote === 'en_produccion') && (
                              <button
                                onClick={() => setMermaLote(lote)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 transition-colors"
                                title="Registrar merma de este lote"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Merma
                              </button>
                            )}
                            {(lote.estado_lote === 'activo' || lote.estado_lote === 'en_produccion') && (
                              <button
                                onClick={() => setDevolucionLote(lote)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 text-xs font-medium hover:bg-violet-100 transition-colors"
                                title="Registrar devolución de este lote"
                              >
                                <RefreshCw className="w-3.5 h-3.5" /> Devolución
                              </button>
                            )}
                            <button
                              onClick={() => setRentabilidadLote(lote)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium hover:bg-indigo-100 transition-colors"
                              title="Ver rentabilidad real"
                            >
                              <BarChart2 className="w-3.5 h-3.5" /> Rentabilidad
                            </button>
                          </div>
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
            Pestaña <strong>Lotes</strong>: entradas de proveedor, reconteo y merma de cualquier producto almacenado.
            Pestaña <strong>Producción</strong>: registra qué elaboraste internamente (con receta), su caducidad y su merma esperada.
            Pestaña <strong>Devoluciones</strong>: pérdida ligada a un lote cuando se le entrega un producto nuevo al cliente.
            En Inventario solo se hace conteo/ajuste — si el conteo no coincide, se justifica aquí como entrada nueva o como pérdida.
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
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

      {/* Modal Nuevo Lote / Nueva Producción */}
      {showNuevoLote && (
        <NuevoLoteModal
          soloProduccion={soloProduccion}
          onClose={() => setShowNuevoLote(false)}
          onSaved={() => { setShowNuevoLote(false); refrescarTodo(); }}
        />
      )}

      {/* Modal Reconteo */}
      {reconteoLote && (
        <ReconteoModal
          lote={reconteoLote}
          onClose={() => setReconteoLote(null)}
          onSaved={() => { setReconteoLote(null); refrescarTodo(); }}
        />
      )}

      {/* Modal Merma vinculada a lote */}
      {mermaLote && (
        <MermaLoteModal
          lote={mermaLote}
          onClose={() => setMermaLote(null)}
          onSaved={() => { setMermaLote(null); refrescarTodo(); }}
        />
      )}

      {/* Modal Devolución — acción rápida desde la fila de un lote (lote fijo) */}
      {devolucionLote && (
        <DevolucionModal
          lote={devolucionLote}
          onClose={() => setDevolucionLote(null)}
          onSaved={() => { setDevolucionLote(null); refrescarTodo(); }}
        />
      )}
    </>
  );
};

// ============================================================================
// MODAL NUEVO LOTE — crea un lote (entrada o producción) para un producto almacenable
// ============================================================================

interface NuevoLoteModalProps {
  onClose: () => void;
  onSaved: () => void;
  /** Cuando viene de la pestaña Producción: solo productos elaborados con receta, sin toggle de tipo */
  soloProduccion?: boolean;
}

const NuevoLoteModal: React.FC<NuevoLoteModalProps> = ({ onClose, onSaved, soloProduccion }) => {
  useEscapeKey(onClose);
  const [productos, setProductos]           = useState<Producto[]>([]);
  const [loadingDatos, setLoadingDatos]      = useState(true);
  const [idProducto, setIdProducto]         = useState<number | null>(null);
  const [tipo, setTipo]                     = useState<'entrada' | 'produccion'>('produccion');
  const [cantidad, setCantidad]             = useState('');
  const [motivo, setMotivo]                 = useState('');
  const [proveedores, setProveedores]       = useState<Proveedor[]>([]);
  const [idProveedor, setIdProveedor]       = useState<number | null>(null);
  const [usuarios, setUsuarios]             = useState<any[]>([]);
  const [idResponsable, setIdResponsable]   = useState<number | null>(null);
  const [fechaVenc, setFechaVenc]           = useState('');
  const [vidaUtil, setVidaUtil]             = useState('');
  const [costoProd, setCostoProd]           = useState('');
  const [mermaCantidad, setMermaCantidad]   = useState('');
  const [mermaPorcentaje, setMermaPorcentaje] = useState('');
  const [observaciones, setObservaciones]   = useState('');
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoadingDatos(true);
      try {
        const [prods, provRes, userRes] = await Promise.all([
          productosService.getAll({ es_vendible: false, estado: 'activo', limit: 500 }),
          proveedorService.getAll({ estado: 'activo', limit: 100 }),
          usuariosService.listar({ estado: 'activo', limit: 100 }),
        ]);
        setProductos(soloProduccion ? prods.filter(p => p.tipo_materia === 'procesada') : prods);
        setProveedores(provRes.data);
        setUsuarios(userRes.data ?? []);
      } catch { /* silencioso */ }
      finally { setLoadingDatos(false); }
    };
    load();
  }, []);

  const productoSel = productos.find(p => p.id === idProducto) ?? null;
  const esProduccion = tipo === 'produccion';

  const handleSubmit = async () => {
    if (!idProducto) { setError('Selecciona un producto'); return; }
    if (!cantidad || parseFloat(cantidad) <= 0) { setError('La cantidad debe ser mayor a 0'); return; }
    if (!motivo.trim()) { setError('El motivo es obligatorio'); return; }

    setSaving(true); setError(null);
    try {
      await inventarioService.registrarMovimiento({
        id_producto:      idProducto,
        tipo_movimiento:  tipo,
        cantidad:         parseFloat(cantidad),
        motivo:           motivo.trim(),
        generar_lote:     true,
        ...(tipo === 'entrada' && idProveedor    && { id_proveedor: idProveedor }),
        ...(fechaVenc            && { fecha_vencimiento: new Date(fechaVenc).toISOString() }),
        ...(vidaUtil              && { vida_util_dias: parseInt(vidaUtil) }),
        ...(costoProd             && { costo_produccion: parseFloat(costoProd) }),
        ...(idResponsable         && { id_usuario_responsable: idResponsable }),
        ...(esProduccion && mermaCantidad   && { merma_cantidad: parseFloat(mermaCantidad) }),
        ...(esProduccion && mermaPorcentaje && { merma_porcentaje: parseFloat(mermaPorcentaje) }),
        ...(observaciones         && { observaciones_lote: observaciones }),
      });
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Error al registrar el lote');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: Z_INDEX.MODAL_BASE }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">

        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs font-medium uppercase tracking-wider">Lotes</p>
            <h2 className="text-white font-bold text-base">{soloProduccion ? 'Nueva Producción' : 'Nuevo Lote'}</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/15 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <ErrorAlert message={error} />
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Producto <span className="text-red-500">*</span>
            </label>
            {loadingDatos ? (
              <div className="flex items-center gap-2 px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-400">
                <RefreshCw className="w-4 h-4 animate-spin" /> Cargando productos...
              </div>
            ) : productos.length === 0 ? (
              <div className="px-3 py-2.5 border border-amber-200 bg-amber-50 rounded-xl text-sm text-amber-700">
                {soloProduccion
                  ? 'No hay productos elaborados con receta interna registrados.'
                  : 'No hay productos almacenables activos (materias primas o procesados no vendibles).'}
              </div>
            ) : (
              <select value={idProducto ?? ''} onChange={e => setIdProducto(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="">— Selecciona un producto —</option>
                {productos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre} ({p.sku})</option>
                ))}
              </select>
            )}
          </div>

          {!soloProduccion && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Origen del lote</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setTipo('produccion')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${tipo === 'produccion' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  <Layers className="w-4 h-4" /> Producción
                </button>
                <button onClick={() => setTipo('entrada')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${tipo === 'entrada' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  <RotateCcw className="w-4 h-4 rotate-180" /> Entrada
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Cantidad {productoSel ? `(${productoSel.unidad_medida})` : ''} <span className="text-red-500">*</span>
            </label>
            <input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)}
              placeholder="Ej: 10" min="0" step="0.01"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>

          {tipo === 'entrada' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Proveedor <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <select value={idProveedor ?? ''} onChange={e => setIdProveedor(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="">— Selecciona un proveedor —</option>
                {proveedores.map(p => (
                  <option key={p.id} value={p.id}>{p.razon_social}</option>
                ))}
              </select>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 p-3.5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Responsable</label>
                <select value={idResponsable ?? ''} onChange={e => setIdResponsable(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="">— Seleccionar —</option>
                  {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre_completo ?? u.usuario}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Vida útil (días)</label>
                <input type="number" value={vidaUtil} onChange={e => setVidaUtil(e.target.value)}
                  placeholder="Ej: 7" min="1"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Fecha Vencimiento <span className="text-slate-400 font-normal">(recomendado)</span>
                </label>
                <input type="date" value={fechaVenc} onChange={e => setFechaVenc(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Costo Producción</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">$</span>
                  <input type="number" value={costoProd} onChange={e => setCostoProd(e.target.value)}
                    placeholder="0" min="0"
                    className="w-full pl-6 pr-2 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
              </div>
            </div>
            {esProduccion && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Merma esperada (cant.)</label>
                  <input type="number" value={mermaCantidad} onChange={e => setMermaCantidad(e.target.value)}
                    placeholder="0" min="0" step="0.01"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Merma esperada (%)</label>
                  <input type="number" value={mermaPorcentaje} onChange={e => setMermaPorcentaje(e.target.value)}
                    placeholder="0" min="0" max="100" step="0.1"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones del lote</label>
              <textarea rows={2} value={observaciones} onChange={e => setObservaciones(e.target.value)}
                placeholder="Notas adicionales del lote..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none resize-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Motivo <span className="text-red-500">*</span>
            </label>
            <textarea rows={2} value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder={esProduccion ? 'Ej: Producción del día, Lote matutino...' : 'Ej: Compra semanal, Reposición de stock...'}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-indigo-400" />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 bg-slate-50/80">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-[2] py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 shadow-sm">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Registrando...' : 'Crear Lote'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MODAL RECONTEO — actualiza estado/fecha/observaciones de un lote existente
// ============================================================================

interface ReconteoModalProps {
  lote: Lote;
  onClose: () => void;
  onSaved: () => void;
}

const ReconteoModal: React.FC<ReconteoModalProps> = ({ lote, onClose, onSaved }) => {
  useEscapeKey(onClose);
  const [estado, setEstado]             = useState<EstadoLote>(lote.estado_lote);
  const [fechaVenc, setFechaVenc]       = useState(lote.fecha_vencimiento ? lote.fecha_vencimiento.split('T')[0] : '');
  const [observaciones, setObservaciones] = useState(lote.observaciones ?? '');
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const handleSubmit = async () => {
    setSaving(true); setError(null);
    try {
      await inventarioService.actualizarEstadoLote(lote.id, {
        estado_lote: estado,
        ...(fechaVenc && { fecha_vencimiento: new Date(fechaVenc).toISOString() }),
        ...(observaciones && { observaciones }),
        es_reconteo: true,   // sujeto al gate de frecuencia; estampa fecha_ultimo_reconteo
      });
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Error al actualizar el lote');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: Z_INDEX.MODAL_BASE }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs mb-0.5">{lote.numero_lote}</p>
            <h2 className="text-white font-bold text-base">Reconteo — {lote.producto.nombre}</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/15 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <ErrorAlert message={error} />
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Estado del lote</label>
            <select value={estado} onChange={e => setEstado(e.target.value as EstadoLote)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-amber-400">
              <option value="activo">Activo — en buen estado</option>
              <option value="en_produccion">En producción</option>
              <option value="vencido">Vencido — se está dañando</option>
              <option value="agotado">Agotado — ya no queda</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Fecha Vencimiento <span className="text-slate-400 font-normal">(opcional, actualizar si cambió)</span>
            </label>
            <input type="date" value={fechaVenc} onChange={e => setFechaVenc(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-amber-400" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Observaciones del reconteo <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <textarea rows={2} value={observaciones} onChange={e => setObservaciones(e.target.value)}
              placeholder="Ej: Se revisó físicamente, buen estado, quedan 3kg..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-amber-400" />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 bg-slate-50/80">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-[2] py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 shadow-sm">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
            {saving ? 'Guardando...' : 'Guardar Reconteo'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MODAL MERMA DE LOTE — registra una salida por daño vinculada a un lote existente
// ============================================================================

interface MermaLoteModalProps {
  lote: Lote;
  onClose: () => void;
  onSaved: () => void;
}

const MermaLoteModal: React.FC<MermaLoteModalProps> = ({ lote, onClose, onSaved }) => {
  useEscapeKey(onClose);
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo]     = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!cantidad || parseFloat(cantidad) <= 0) { setError('La cantidad debe ser mayor a 0'); return; }
    if (!motivo.trim()) { setError('El motivo es obligatorio'); return; }

    setSaving(true); setError(null);
    try {
      await inventarioService.registrarMovimiento({
        id_producto:     lote.id_producto,
        tipo_movimiento: 'merma',
        cantidad:        parseFloat(cantidad),
        motivo:          motivo.trim(),
        id_lote:         lote.id,
      });
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Error al registrar la merma');
    } finally {
      setSaving(false);
    }
  };

  const disponible = Number(lote.cantidad_producida) - Number(lote.merma_cantidad);

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: Z_INDEX.MODAL_BASE }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-r from-red-600 to-rose-600 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs mb-0.5">{lote.numero_lote}</p>
            <h2 className="text-white font-bold text-base">Merma — {lote.producto.nombre}</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/15 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <ErrorAlert message={error} />
          )}

          <p className="text-xs text-slate-500">
            Disponible en este lote: <strong>{disponible.toFixed(2)} {lote.producto.unidad_medida}</strong>
          </p>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Cantidad dañada ({lote.producto.unidad_medida}) <span className="text-red-500">*</span>
            </label>
            <input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)}
              placeholder="Ej: 2" min="0" step="0.01"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-400" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Motivo <span className="text-red-500">*</span>
            </label>
            <textarea rows={2} value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Ej: Producto caducado, derrame, mal olor..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-red-400" />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 bg-slate-50/80">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-[2] py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 shadow-sm">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {saving ? 'Registrando...' : 'Registrar Merma'}
          </button>
        </div>
      </div>
    </div>
  );
};
