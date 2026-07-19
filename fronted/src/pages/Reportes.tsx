/**
 * Reportes - Análisis y estadísticas del negocio
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Download, TrendingUp, TrendingDown, DollarSign, Package,
  ShoppingCart, BarChart3, RefreshCw, Calendar, Store, MapPin,
  ArrowUpRight, ArrowDownRight, AlertTriangle, Users, Trash2, Clock,
  Building2, Layers, Globe,
} from 'lucide-react';
import { dashboardService, DashboardStats } from '../services/dashboard.service';
import { ordenesService } from '../services/ordenes.service';
import { reportesService } from '../services/reportes.service';
import { useAuthStore } from '../store/useStore';
import { useRestauranteStore } from '../store/restauranteStore';
import { buildDateParams } from '../utils';

type ScopeReporte = 'restaurante' | 'grupo' | 'super';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v);

export const Reportes: React.FC = () => {
  const [dateRange,    setDateRange]    = useState('today');
  const [customDesde,  setCustomDesde]  = useState('');
  const [customHasta,  setCustomHasta]  = useState('');
  const [stats,        setStats]        = useState<DashboardStats | null>(null);
  const [estadisticas, setEstadisticas] = useState<any>(null);
  const [loading,      setLoading]      = useState(true);

  const [valorMerma,     setValorMerma]     = useState<any[]>([]);
  const [tendencias,     setTendencias]     = useState<any[]>([]);
  const [topClientes,    setTopClientes]    = useState<any[]>([]);
  const [lotesPorVencer, setLotesPorVencer] = useState<any[]>([]);
  const [loadingExtra,   setLoadingExtra]   = useState(true);

  // Scope: sede individual | grupo consolidado | super (SA, todos los grupos)
  // Se persiste en sessionStorage: al cambiar de sucursal el <main key={sede}>
  // re-monta esta página, y quien estaba viendo "consolidado" debe seguir ahí.
  const [scope, setScopeState] = useState<ScopeReporte>(() => {
    const guardado = sessionStorage.getItem('reportes-scope');
    return guardado === 'grupo' || guardado === 'super' ? guardado : 'restaurante';
  });
  const setScope = useCallback((s: ScopeReporte) => {
    sessionStorage.setItem('reportes-scope', s);
    setScopeState(s);
  }, []);
  const [consolidado,     setConsolidado]     = useState<any>(null);
  const [superData,       setSuperData]       = useState<any>(null);
  const [loadingConsol,   setLoadingConsol]   = useState(false);
  const [loadingSuper,    setLoadingSuper]    = useState(false);

  const { user, isSuperAdmin } = useAuthStore();
  const { activo, grupoActivo } = useRestauranteStore();
  const esSuperAdmin = isSuperAdmin();

  // id_grupo: usa grupoActivo del store primero (cambia cuando SA cambia de grupo),
  // fallback al id_grupo del restaurante activo en el JWT.
  const id_grupo = useMemo(
    () => grupoActivo?.id ?? user?.restaurantes.find(r => r.id === activo?.id)?.id_grupo,
    [grupoActivo, user, activo],
  );

  // Mostrar selector de scope si tiene múltiples restaurantes o es SA
  const puedeVerGrupo = (user?.restaurantes.length ?? 0) > 1 || esSuperAdmin;

  const loadConsolidado = useCallback(async () => {
    if (!id_grupo) return;
    setLoadingConsol(true);
    try {
      const [resumen, productos, pagos, clientes] = await Promise.all([
        reportesService.getVentasConsolidado(id_grupo).catch(() => null),
        reportesService.getProductosConsolidado(id_grupo).catch(() => []),
        reportesService.getPagosConsolidado(id_grupo).catch(() => []),
        reportesService.getClientesConsolidado(id_grupo).catch(() => []),
      ]);
      setConsolidado({ resumen, productos, pagos, clientes });
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingConsol(false);
    }
  }, [id_grupo]);

  const loadSuperConsolidado = useCallback(async () => {
    setLoadingSuper(true);
    try {
      const data = await reportesService.getSuperConsolidado();
      setSuperData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSuper(false);
    }
  }, []);

  // Parámetros de fecha activos (recalculados cuando cambia el rango o las fechas custom)
  const dateParams = useMemo(
    () => buildDateParams(dateRange, customDesde, customHasta),
    [dateRange, customDesde, customHasta],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashStats, ordStats] = await Promise.all([
        dashboardService.getStats(),
        ordenesService.getEstadisticas(),
      ]);
      setStats(dashStats);
      setEstadisticas(ordStats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadExtraData = useCallback(async () => {
    setLoadingExtra(true);
    try {
      const [merma, tend, clientes, lotes] = await Promise.all([
        reportesService.getValorMerma(dateParams).catch(() => []),
        reportesService.getTendenciasConsumo().catch(() => []),
        reportesService.getTopClientes(10).catch(() => []),
        reportesService.getLotesPorVencer(30).catch(() => []),
      ]);
      setValorMerma(merma);
      setTendencias(tend);
      setTopClientes(clientes);
      setLotesPorVencer(lotes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingExtra(false);
    }
  }, [dateParams]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadExtraData(); }, [loadExtraData]);
  useEffect(() => {
    if (scope === 'grupo')  loadConsolidado();
    if (scope === 'super')  loadSuperConsolidado();
  }, [scope, loadConsolidado, loadSuperConsolidado]);

  // Guard del scope rehidratado de sessionStorage: si el usuario ya no puede
  // ver ese scope (p. ej. dejó de ser SA o tiene una sola sede), volver a sede.
  useEffect(() => {
    if ((scope === 'super' && !esSuperAdmin) || (scope !== 'restaurante' && !puedeVerGrupo)) {
      setScope('restaurante');
    }
  }, [scope, esSuperAdmin, puedeVerGrupo, setScope]);

  const kpis = [
    {
      label: 'Ventas Hoy',
      value: formatCurrency(stats?.ventasHoy || 0),
      change: '+8%',
      positive: true,
      icon: <DollarSign className="w-5 h-5" />,
      color: 'from-violet-500 to-violet-600',
    },
    {
      label: 'Órdenes Hoy',
      value: stats?.ordenesHoy || 0,
      change: '+12%',
      positive: true,
      icon: <ShoppingCart className="w-5 h-5" />,
      color: 'from-blue-500 to-blue-600',
    },
    {
      label: 'Productos Activos',
      value: stats?.productosActivos || 0,
      change: '',
      positive: true,
      icon: <Package className="w-5 h-5" />,
      color: 'from-emerald-500 to-emerald-600',
    },
    {
      label: 'Alertas Stock',
      value: stats?.alertas || 0,
      change: '',
      positive: false,
      icon: <BarChart3 className="w-5 h-5" />,
      color: 'from-amber-500 to-amber-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/20 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Reportes</h1>
              <p className="text-slate-500 text-sm mt-0.5">Análisis y estadísticas del negocio</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { loadData(); loadExtraData(); if (scope === 'grupo') loadConsolidado(); if (scope === 'super') loadSuperConsolidado(); }}
                className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                <RefreshCw className={`w-4 h-4 ${loading || loadingExtra ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
              <button className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold hover:from-violet-700 hover:to-purple-700 transition-all shadow-lg text-sm">
                <Download className="w-4 h-4" />
                Exportar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* Selector de scope */}
        {puedeVerGrupo && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-slate-500">Vista:</span>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setScope('restaurante')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${scope === 'restaurante' ? 'bg-white shadow-sm text-violet-700' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Building2 className="w-3.5 h-3.5" />
                {activo?.nombre ?? 'Este restaurante'}
              </button>
              {/* Opción grupo — solo cuando hay un grupo activo seleccionado (o no es SA) */}
              {(!esSuperAdmin || grupoActivo) && (
                <button
                  onClick={() => setScope('grupo')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${scope === 'grupo' ? 'bg-white shadow-sm text-violet-700' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  {grupoActivo?.nombre ?? 'Consolidado del grupo'}
                </button>
              )}
              {/* Opción super — solo para SA sin grupo activo (ve todos los grupos) */}
              {esSuperAdmin && (
                <button
                  onClick={() => setScope('super')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${scope === 'super' ? 'bg-white shadow-sm text-amber-700' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  Todos los grupos
                </button>
              )}
            </div>
            {scope === 'grupo' && !id_grupo && (
              <span className="text-xs text-amber-600">Selecciona un grupo en el selector del AppBar para ver datos consolidados.</span>
            )}
          </div>
        )}

        {/* ── Vista: super-consolidado (SA, todos los grupos) ── */}
        {scope === 'super' && (
          <div className="space-y-6">
            {loadingSuper ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
              </div>
            ) : !superData ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10 text-center text-slate-400">
                <Globe className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Sin datos disponibles.</p>
              </div>
            ) : (
              <>
                {/* KPIs globales */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Total grupos',   value: superData.total_grupos,                                                                    color: 'from-amber-500 to-orange-500' },
                    { label: 'Total órdenes',  value: superData.totales_globales?.total_ordenes ?? 0,                                            color: 'from-violet-500 to-purple-500' },
                    { label: 'Total ventas',   value: formatCurrency(superData.totales_globales?.total_ventas ?? 0),                             color: 'from-emerald-500 to-teal-500'  },
                    { label: 'Ticket prom.',   value: formatCurrency(superData.totales_globales?.ticket_promedio ?? 0),                          color: 'from-blue-500 to-cyan-500'     },
                  ].map((k, i) => (
                    <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${k.color} flex items-center justify-center mb-3`}>
                        <Globe className="w-5 h-5 text-white" />
                      </div>
                      <p className="text-xs text-slate-500 mb-1">{k.label}</p>
                      <p className="text-xl font-bold text-slate-800">{k.value}</p>
                    </div>
                  ))}
                </div>

                {/* Ranking por grupo */}
                {superData.por_grupo?.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Layers className="w-5 h-5 text-amber-500" />
                      Ventas por grupo de negocio
                    </h3>
                    <div className="space-y-3">
                      {superData.por_grupo.map((g: any, i: number) => {
                        const maxVal = superData.totales_globales?.total_ventas ?? 1;
                        const pct    = maxVal > 0 ? (Number(g.total_ventas ?? 0) / maxVal) * 100 : 0;
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-xs font-bold flex-shrink-0">{i + 1}</div>
                            <span className="text-xs text-slate-600 w-40 flex-shrink-0 truncate font-medium">{g.nombre_grupo}</span>
                            <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }} />
                            </div>
                            <div className="text-right w-40 flex-shrink-0">
                              <p className="text-sm font-bold text-slate-800">{formatCurrency(g.total_ventas ?? 0)}</p>
                              <p className="text-xs text-slate-400">{g.total_ordenes} órdenes · {g.plan}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Vista: consolidado por grupo ── */}
        {scope === 'grupo' && (
          <div className="space-y-6">
            {loadingConsol ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 text-violet-500 animate-spin" />
              </div>
            ) : !consolidado ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10 text-center text-slate-400">
                <Layers className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Sin datos consolidados disponibles.</p>
              </div>
            ) : (
              <>
                {/* Ventas por restaurante — usa por_restaurante (snake_case del backend) */}
                {consolidado.resumen?.por_restaurante?.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-violet-500" />
                      Ventas por restaurante
                    </h3>
                    <div className="space-y-3">
                      {consolidado.resumen.por_restaurante.map((r: any, i: number) => {
                        const maxVal = Math.max(...consolidado.resumen.por_restaurante.map((x: any) => Number(x.total ?? 0)));
                        const pct    = maxVal > 0 ? (Number(r.total ?? 0) / maxVal) * 100 : 0;
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-xs text-slate-500 w-36 flex-shrink-0 truncate">{r.restaurante}</span>
                            <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-sm font-semibold text-slate-700 w-32 text-right">
                              {formatCurrency(Number(r.total ?? 0))}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {/* Usa totales_globales (snake_case del backend) */}
                    {consolidado.resumen.totales_globales && (
                      <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between text-sm font-bold text-slate-700">
                        <span>Total grupo · {consolidado.resumen.totales_globales.total_ordenes} órdenes</span>
                        <span>{formatCurrency(Number(consolidado.resumen.totales_globales.total_ventas ?? 0))}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Top productos + Top clientes */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Package className="w-5 h-5 text-violet-500" />
                      Top productos del grupo
                    </h3>
                    {!consolidado.productos?.length ? (
                      <div className="h-36 flex flex-col items-center justify-center text-slate-400">
                        <Package className="w-8 h-8 mb-2 opacity-40" />
                        <p className="text-sm">Sin datos</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {consolidado.productos.slice(0, 8).map((p: any, i: number) => (
                          <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0 ${
                              i === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                              i === 1 ? 'bg-gradient-to-br from-slate-400 to-slate-500' :
                              'bg-gradient-to-br from-violet-400 to-violet-500'
                            }`}>{i + 1}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-700 truncate">{p.nombre}</p>
                              <p className="text-xs text-slate-400">{p.cantidad_vendida} uds</p>
                            </div>
                            <span className="text-sm font-bold text-violet-600">{formatCurrency(Number(p.total_vendido ?? 0))}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-500" />
                      Top clientes del grupo
                    </h3>
                    {!consolidado.clientes?.length ? (
                      <div className="h-36 flex flex-col items-center justify-center text-slate-400">
                        <Users className="w-8 h-8 mb-2 opacity-40" />
                        <p className="text-sm">Sin datos</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {consolidado.clientes.map((c: any, i: number) => (
                          <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0 ${
                              i === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                              i === 1 ? 'bg-gradient-to-br from-slate-400 to-slate-500' :
                              'bg-gradient-to-br from-indigo-400 to-indigo-500'
                            }`}>{i + 1}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-700 truncate">{c.nombre_completo ?? c.nombre ?? `Cliente #${c.id ?? i + 1}`}</p>
                              <p className="text-xs text-slate-400">{c.total_ordenes ?? 0} órdenes</p>
                            </div>
                            <span className="text-sm font-bold text-indigo-600">{formatCurrency(c.total_gastado ?? 0)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Métodos de pago */}
                {consolidado.pagos?.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-emerald-500" />
                      Métodos de pago del grupo
                    </h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {consolidado.pagos.map((p: any, i: number) => (
                        <div key={i} className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                          <p className="text-xs text-slate-500 font-medium uppercase mb-1">{p.metodo}</p>
                          <p className="text-lg font-bold text-emerald-700">{formatCurrency(Number(p.total ?? 0))}</p>
                          <p className="text-xs text-slate-400">{p.transacciones} transacciones</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Vista individual por restaurante */}
        {scope === 'restaurante' && (<>

        {/* Selector período */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-slate-500">
            <Calendar className="w-4 h-4" />
            <span className="text-sm font-medium">Período:</span>
          </div>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { value: 'today', label: 'Hoy' },
              { value: 'week', label: 'Semana' },
              { value: 'month', label: 'Mes' },
              { value: 'custom', label: 'Personalizado' },
            ].map(opt => (
              <button key={opt.value} onClick={() => setDateRange(opt.value)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${dateRange === opt.value ? 'bg-white shadow-sm text-violet-700' : 'text-slate-500 hover:text-slate-700'}`}>
                {opt.label}
              </button>
            ))}
          </div>
          {dateRange === 'custom' && (
            <div className="flex gap-3 flex-1">
              <input
                type="date"
                value={customDesde}
                onChange={e => setCustomDesde(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none"
              />
              <input
                type="date"
                value={customHasta}
                onChange={e => setCustomHasta(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none"
              />
            </div>
          )}
        </div>

        {/* KPIs */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-violet-500 animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {kpis.map((kpi, i) => (
                <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`bg-gradient-to-br ${kpi.color} p-2.5 rounded-xl shadow-lg`}>
                      <div className="text-white">{kpi.icon}</div>
                    </div>
                    {kpi.change && (
                      <div className={`flex items-center gap-1 text-xs font-semibold ${kpi.positive ? 'text-emerald-600' : 'text-red-500'}`}>
                        {kpi.positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {kpi.change}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mb-1">{kpi.label}</p>
                  <p className="text-2xl font-bold text-slate-800">{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Dos columnas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Ventas por semana */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-violet-500" />
                  Ventas Últimos 7 Días
                </h3>
                {stats?.ventasSemana && stats.ventasSemana.length > 0 ? (
                  <div className="space-y-3">
                    {stats.ventasSemana.map((v, i) => {
                      const maxVal = Math.max(...stats.ventasSemana.map(x => x.total));
                      const pct = maxVal > 0 ? (v.total / maxVal) * 100 : 0;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs text-slate-500 w-20 flex-shrink-0">
                            {new Date(v.fecha).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' })}
                          </span>
                          <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-sm font-semibold text-slate-700 w-28 text-right">{formatCurrency(v.total)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-40 flex flex-col items-center justify-center text-slate-400">
                    <BarChart3 className="w-10 h-10 mb-2" />
                    <p className="text-sm">Sin datos disponibles</p>
                  </div>
                )}
              </div>

              {/* Top productos */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-violet-500" />
                  Top 5 Productos Vendidos
                </h3>
                {stats?.topProductos && stats.topProductos.length > 0 ? (
                  <div className="space-y-3">
                    {stats.topProductos.map((p, i) => (
                      <div key={p.producto_id} className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                          i === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                          i === 1 ? 'bg-gradient-to-br from-slate-400 to-slate-500' :
                          i === 2 ? 'bg-gradient-to-br from-orange-700 to-orange-800' :
                          'bg-gradient-to-br from-violet-500 to-violet-600'
                        }`}>{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-700 truncate">{p.nombre || `Producto #${p.producto_id}`}</p>
                          <p className="text-xs text-slate-400">{p.cantidad_vendida} unidades</p>
                        </div>
                        <span className="text-sm font-bold text-violet-600">{formatCurrency(p.total_vendido)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-40 flex flex-col items-center justify-center text-slate-400">
                    <Package className="w-10 h-10 mb-2" />
                    <p className="text-sm">Sin ventas registradas</p>
                  </div>
                )}
              </div>
            </div>

            {/* Estadísticas órdenes */}
            {estadisticas && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Por tipo */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Órdenes por Tipo</h3>
                  <div className="space-y-3">
                    {estadisticas.porTipo?.map((t: any, i: number) => (
                      <div key={i} className={`flex items-center justify-between p-4 rounded-xl ${t.tipo_orden === 'local' ? 'bg-emerald-50 border border-emerald-100' : 'bg-blue-50 border border-blue-100'}`}>
                        <div className="flex items-center gap-3">
                          {t.tipo_orden === 'local' ? <Store className="w-5 h-5 text-emerald-600" /> : <MapPin className="w-5 h-5 text-blue-600" />}
                          <div>
                            <p className="font-semibold text-slate-700 capitalize">{t.tipo_orden}</p>
                            <p className="text-xs text-slate-500">{t._count} órdenes</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${t.tipo_orden === 'local' ? 'text-emerald-700' : 'text-blue-700'}`}>{t._count}</p>
                        </div>
                      </div>
                    )) || (
                      <p className="text-slate-400 text-sm text-center py-6">Sin datos</p>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between">
                    <span className="text-sm text-slate-500">Total órdenes</span>
                    <span className="text-sm font-bold text-slate-700">{estadisticas.total || 0}</span>
                  </div>
                </div>

                {/* Stock Bajo */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-amber-500" />
                    Productos con Stock Bajo
                  </h3>
                  {stats?.stockBajo && stats.stockBajo.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {stats.stockBajo.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100">
                          <div>
                            <p className="text-sm font-semibold text-slate-700">{p.nombre}</p>
                            <p className="text-xs text-slate-400">{p.sku}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-amber-600">{p.stock_actual}</p>
                            <p className="text-xs text-slate-400">mín: {p.stock_minimo}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-40 flex flex-col items-center justify-center text-emerald-500">
                      <Package className="w-10 h-10 mb-2" />
                      <p className="text-sm font-medium">¡Todo el stock en orden!</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Resumen financiero */}
            <div className="bg-gradient-to-br from-violet-600 to-purple-700 rounded-2xl shadow-lg p-6 text-white">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Resumen Financiero del Día
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Ventas Brutas', value: formatCurrency(stats?.ventasHoy || 0) },
                  { label: 'Órdenes Procesadas', value: stats?.ordenesHoy || 0 },
                  { label: 'Ticket Promedio', value: stats?.ordenesHoy ? formatCurrency((stats?.ventasHoy || 0) / stats.ordenesHoy) : '$0' },
                  { label: 'Alertas Activas', value: stats?.alertas || 0 },
                ].map((item, i) => (
                  <div key={i} className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                    <p className="text-violet-200 text-xs font-medium mb-1">{item.label}</p>
                    <p className="text-white text-xl font-bold">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ================================================================
                NUEVAS SECCIONES - Merma, Tendencias, Top Clientes, Lotes
                ================================================================ */}
            {loadingExtra ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 text-violet-400 animate-spin mr-2" />
                <span className="text-slate-500 text-sm">Cargando reportes adicionales...</span>
              </div>
            ) : (
              <>
                {/* Valor de Merma + Tendencias */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  {/* Valor de Merma */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Trash2 className="w-5 h-5 text-red-400" />
                      Valor Económico de Merma
                    </h3>
                    {valorMerma.length === 0 ? (
                      <div className="h-36 flex flex-col items-center justify-center text-slate-400">
                        <Trash2 className="w-8 h-8 mb-2 opacity-40" />
                        <p className="text-sm">Sin datos de merma</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {valorMerma.slice(0, 8).map((item: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
                            <div>
                              <p className="text-sm font-semibold text-slate-700">{item.nombre || `Lote ${item.id_lote}`}</p>
                              <p className="text-xs text-slate-400">Merma: {Number(item.merma_cantidad).toFixed(1)} unidades</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-red-600">{formatCurrency(item.valor_merma_estimado ?? 0)}</p>
                              <p className="text-xs text-slate-400">en riesgo</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tendencias de Consumo */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-teal-500" />
                      Tendencias de Consumo
                    </h3>
                    {tendencias.length === 0 ? (
                      <div className="h-36 flex flex-col items-center justify-center text-slate-400">
                        <BarChart3 className="w-8 h-8 mb-2 opacity-40" />
                        <p className="text-sm">Sin datos de tendencias</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {tendencias.slice(0, 8).map((t: any, i: number) => {
                          const tendencia = t.tendencia ?? 'estable';
                          return (
                            <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-700 truncate">{t.nombre}</p>
                                <p className="text-xs text-slate-400">
                                  {Number(t.consumo_actual ?? 0).toFixed(1)} vs {Number(t.consumo_anterior ?? 0).toFixed(1)} uds/día
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {tendencia === 'creciente'
                                  ? <span className="flex items-center gap-0.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg"><ArrowUpRight className="w-3 h-3" />Sube</span>
                                  : tendencia === 'decreciente'
                                    ? <span className="flex items-center gap-0.5 text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-lg"><ArrowDownRight className="w-3 h-3" />Baja</span>
                                    : <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">Estable</span>
                                }
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Top Clientes + Lotes por Vencer */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  {/* Top Clientes */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-500" />
                      Top 10 Clientes
                    </h3>
                    {topClientes.length === 0 ? (
                      <div className="h-36 flex flex-col items-center justify-center text-slate-400">
                        <Users className="w-8 h-8 mb-2 opacity-40" />
                        <p className="text-sm">Sin datos de clientes</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {topClientes.map((c: any, i: number) => (
                          <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0 ${
                              i === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                              i === 1 ? 'bg-gradient-to-br from-slate-400 to-slate-500' :
                              i === 2 ? 'bg-gradient-to-br from-orange-600 to-orange-700' :
                              'bg-gradient-to-br from-indigo-400 to-indigo-500'
                            }`}>{i + 1}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-700 truncate">{c.nombre ?? c.nombre_cliente ?? `Cliente #${c.id_cliente ?? i+1}`}</p>
                              <p className="text-xs text-slate-400">{c.total_ordenes ?? 0} órdenes · T. promedio: {formatCurrency(c.ticket_promedio ?? 0)}</p>
                            </div>
                            <span className="text-sm font-bold text-indigo-600">{formatCurrency(c.total_gastado)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Lotes por Vencer */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      Lotes por Vencer (30 días)
                    </h3>
                    {lotesPorVencer.length === 0 ? (
                      <div className="h-36 flex flex-col items-center justify-center text-emerald-500">
                        <Package className="w-8 h-8 mb-2" />
                        <p className="text-sm font-medium">¡Sin lotes próximos a vencer!</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {lotesPorVencer.map((lote: any, i: number) => {
                          const dias = Number(lote.dias_restantes ?? 0);
                          const urgente = dias <= 7;
                          const pronto  = dias <= 15;
                          return (
                            <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${urgente ? 'bg-red-50 border-red-200' : pronto ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                              <div>
                                <p className="text-sm font-semibold text-slate-700">{lote.producto?.nombre ?? lote.numero_lote}</p>
                                <p className="text-xs text-slate-400 font-mono">{lote.numero_lote}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span className={`text-xs font-semibold ${urgente ? 'text-red-600' : pronto ? 'text-amber-600' : 'text-slate-500'}`}>
                                    {dias} días restantes
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={`text-sm font-bold ${urgente ? 'text-red-600' : pronto ? 'text-amber-600' : 'text-slate-600'}`}>
                                  {formatCurrency(lote.valor_en_riesgo ?? 0)}
                                </p>
                                <p className="text-xs text-slate-400">en riesgo</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
        </>)}
      </div>
    </div>
  );
};