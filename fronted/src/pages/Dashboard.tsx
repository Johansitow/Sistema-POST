import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardService, DashboardStats } from '../services/dashboard.service';
import { grupoNegocioService, type GrupoNegocio, type GrupoDashboard } from '../services/grupo-negocio.service';
import { useRestauranteStore } from '../store/restauranteStore';
import { useAuthStore } from '../store/useStore';
import {
  Package,
  ShoppingCart,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Calendar,
  ArrowUpRight,
  Building2,
  Users,
} from 'lucide-react';

// ← CAMBIO 1: importar desde utils en lugar de definir inline
import { formatCurrency, formatDate } from '../utils';
import { CardSkeleton, TableSkeleton } from '../components/common';

// ── Vista consolidada del grupo (solo super admin) ───────────────────────────

function VistaCons({ grupo }: { grupo: GrupoNegocio }) {
  const [data, setData]       = useState<GrupoDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    grupoNegocioService.dashboard(grupo.id)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [grupo.id]);

  if (loading) return (
    <div className="animate-pulse bg-white rounded-2xl border border-slate-200 p-4 h-24" />
  );
  if (!data) return null;

  const { totales, restaurantes } = data;
  const fmt = (n: number) => formatCurrency(n);

  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden mb-6">
      {/* Header del grupo */}
      <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-slate-100">
        <Building2 className="w-5 h-5 text-indigo-600" />
        <div>
          <p className="font-semibold text-slate-800">{grupo.nombre}</p>
          <p className="text-xs text-slate-500">
            Plan {grupo.plan} · {grupo._count.restaurantes} sede{grupo._count.restaurantes !== 1 ? 's' : ''}
          </p>
        </div>
        {/* Totales del grupo */}
        <div className="ml-auto flex gap-6 text-right">
          <div>
            <p className="text-xs text-slate-500">Ventas hoy</p>
            <p className="font-bold text-emerald-600">{fmt(totales.ventas_hoy)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Ventas mes</p>
            <p className="font-bold text-blue-600">{fmt(totales.ventas_mes)}</p>
          </div>
          {totales.alertas_stock > 0 && (
            <div>
              <p className="text-xs text-slate-500">Alertas stock</p>
              <p className="font-bold text-red-600">{totales.alertas_stock}</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabla por sede */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-6 py-2 font-medium">Sede</th>
              <th className="text-right px-4 py-2 font-medium">Ventas hoy</th>
              <th className="text-right px-4 py-2 font-medium">Ventas mes</th>
              <th className="text-right px-4 py-2 font-medium">Órd. activas</th>
              <th className="text-right px-4 py-2 font-medium">Stock crítico</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {restaurantes.map(m => (
              <tr key={m.restaurante.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-3">
                  <p className="font-medium text-slate-800">{m.restaurante.nombre}</p>
                  {m.restaurante.ciudad && (
                    <p className="text-xs text-slate-500">{m.restaurante.ciudad}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                  {fmt(m.ventas_hoy)}
                  <span className="block text-xs text-slate-400 font-normal">{m.ordenes_hoy} órd.</span>
                </td>
                <td className="px-4 py-3 text-right text-slate-700">
                  {fmt(m.ventas_mes)}
                  <span className="block text-xs text-slate-400">{m.ordenes_mes} órd.</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                    m.ordenes_activas > 0 ? 'bg-blue-100 text-blue-700' : 'text-slate-400'
                  }`}>
                    {m.ordenes_activas}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {m.alertas_stock > 0 ? (
                    <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" /> {m.alertas_stock}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Dashboard principal ───────────────────────────────────────────────────────

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<GrupoNegocio[]>([]);
  const { activo: restauranteActivo } = useRestauranteStore();

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dashboardService.getStats(restauranteActivo?.id);
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar estadísticas');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Cargar grupos para super admin (vista consolidada)
  useEffect(() => {
    if (!isSuperAdmin()) return;
    grupoNegocioService.listar({ limit: 50 })
      .then(r => setGrupos(r.data))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recargar cuando cambia el restaurante activo
  useEffect(() => {
    cargarDatos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restauranteActivo?.id]);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <CardSkeleton count={4} />
        <div style={{ marginTop: 32 }}>
          <TableSkeleton rows={5} cols={5} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border border-red-100">
          <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 text-center mb-2">
            Error al cargar
          </h2>
          <p className="text-slate-600 text-center mb-6">{error}</p>
          <button
            onClick={cargarDatos}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-6 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // ← ELIMINADO: const formatCurrency = ...  (viene de utils/format.ts)
  // ← ELIMINADO: const formatDate = ...       (viene de utils/format.ts)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 pt-2 pb-8">

        {/* Sub-header: fecha + restaurante activo + botón actualizar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4 text-slate-500">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span className="text-sm capitalize">{formatDate()}</span>
            </div>
            {restauranteActivo && (
              <span className="text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-1 shadow-sm">
                📍 {restauranteActivo.nombre}
              </span>
            )}
          </div>
          <button
            onClick={cargarDatos}
            disabled={loading}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2 px-4 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">

          {/* Productos → Inventario */}
          <div
            onClick={() => navigate('/inventario')}
            className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-100 overflow-hidden group cursor-pointer"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                  Inventario
                </span>
              </div>
              <h3 className="text-sm font-medium text-slate-600 mb-1">Productos</h3>
              {/* ← CAMBIO 4: optional chaining (?.) previene crash si stats llega con undefined */}
              <p className="text-3xl font-bold text-slate-800">
                {stats?.productos?.toLocaleString() ?? 0}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                <span className="text-xs">{stats?.productosActivos ?? 0} activos</span>
              </div>
            </div>
          </div>

          {/* Órdenes Hoy → Ordenes */}
          <div
            onClick={() => navigate('/ordenes')}
            className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-100 overflow-hidden group cursor-pointer"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-3 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <ShoppingCart className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center gap-1 text-emerald-600 text-sm font-semibold">
                  <TrendingUp className="w-4 h-4" />
                  <span>12%</span>
                </div>
              </div>
              <h3 className="text-sm font-medium text-slate-600 mb-1">Órdenes Hoy</h3>
              <p className="text-3xl font-bold text-slate-800">
                {stats?.ordenesHoy?.toLocaleString() ?? 0}
              </p>
              <div className="mt-4 text-xs text-slate-500">vs ayer</div>
            </div>
          </div>

          {/* Alertas → Inventario */}
          <div
            onClick={() => navigate('/inventario')}
            className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-100 overflow-hidden group cursor-pointer"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-3 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
                {(stats?.alertas ?? 0) > 0 && (
                  <span className="text-sm font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-full animate-pulse">
                    ¡Atención!
                  </span>
                )}
              </div>
              <h3 className="text-sm font-medium text-slate-600 mb-1">Alertas</h3>
              <p className="text-3xl font-bold text-slate-800">
                {stats?.alertas?.toLocaleString() ?? 0}
              </p>
              <div className="mt-4 text-xs text-slate-500">Stock bajo</div>
            </div>
          </div>

          {/* Ventas Hoy → Reportes */}
          <div
            onClick={() => navigate('/reportes')}
            className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-100 overflow-hidden group cursor-pointer"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-gradient-to-br from-violet-500 to-violet-600 p-3 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center gap-1 text-violet-600 text-sm font-semibold">
                  <TrendingUp className="w-4 h-4" />
                  <span>8%</span>
                </div>
              </div>
              <h3 className="text-sm font-medium text-slate-600 mb-1">Ventas Hoy</h3>
              <p className="text-2xl font-bold text-slate-800">
                {formatCurrency(stats?.ventasHoy ?? 0)}
              </p>
              <div className="mt-4 text-xs text-slate-500">vs ayer</div>
            </div>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

          {/* Stock Bajo → Inventario */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Productos con Stock Bajo</h2>
                <span className="bg-white/20 text-white px-3 py-1 rounded-full text-sm font-semibold">
                  {stats?.stockBajo?.length ?? 0}
                </span>
              </div>
            </div>
            <div className="p-6">
              {(stats?.stockBajo?.length ?? 0) === 0 ? (
                <div className="text-center py-8">
                  <div className="bg-emerald-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                    <Package className="w-8 h-8 text-emerald-600" />
                  </div>
                  <p className="text-slate-600 font-medium">¡Todo en orden!</p>
                  <p className="text-slate-400 text-sm mt-1">No hay productos con stock bajo</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {stats?.stockBajo?.slice(0, 5).map((producto) => (
                    <div
                      key={producto.id}
                      onClick={() => navigate('/inventario')}
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-amber-50 transition-colors duration-200 cursor-pointer"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-slate-800">{producto.nombre}</p>
                        <p className="text-sm text-slate-500">SKU: {producto.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-amber-600">
                          Stock: {producto.stock_actual}
                        </p>
                        <p className="text-xs text-slate-400">Mín: {producto.stock_minimo}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Top Productos → Reportes */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            <div className="bg-gradient-to-r from-violet-500 to-violet-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Top 5 Productos Vendidos</h2>
                <span className="bg-white/20 text-white px-3 py-1 rounded-full text-sm font-semibold">
                  {stats?.topProductos?.length ?? 0}
                </span>
              </div>
            </div>
            <div className="p-6">
              {(stats?.topProductos?.length ?? 0) === 0 ? (
                <div className="text-center py-8">
                  <div className="bg-slate-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                    <ShoppingCart className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-slate-600 font-medium">Sin ventas aún</p>
                  <p className="text-slate-400 text-sm mt-1">Los productos más vendidos aparecerán aquí</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {stats?.topProductos?.map((producto, index) => (
                    <div
                      key={producto.producto_id}
                      onClick={() => navigate('/reportes')}
                      className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl hover:bg-violet-50 transition-colors duration-200 cursor-pointer"
                    >
                      <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-violet-500 to-violet-600 text-white font-bold rounded-lg shadow-lg">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-800">
                          {producto.nombre || 'Producto sin nombre'}
                        </p>
                        <p className="text-sm text-slate-500">
                          {producto.cantidad_vendida} unidades vendidas
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-violet-600">
                          {formatCurrency(producto.total_vendido)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Acciones Rápidas</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => navigate('/inventario')}
              className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl hover:from-blue-100 hover:to-blue-200 transition-all duration-200 border border-blue-200 group"
            >
              <div className="bg-blue-600 p-2 rounded-lg group-hover:scale-110 transition-transform">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-800">Nuevo Producto</p>
                <p className="text-xs text-slate-600">Agregar al inventario</p>
              </div>
              <ArrowUpRight className="w-5 h-5 text-blue-600 ml-auto" />
            </button>

            <button
              onClick={() => navigate('/ordenes')}
              className="flex items-center gap-3 p-4 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-xl hover:from-emerald-100 hover:to-emerald-200 transition-all duration-200 border border-emerald-200 group"
            >
              <div className="bg-emerald-600 p-2 rounded-lg group-hover:scale-110 transition-transform">
                <ShoppingCart className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-800">Nueva Orden</p>
                <p className="text-xs text-slate-600">Registrar venta</p>
              </div>
              <ArrowUpRight className="w-5 h-5 text-emerald-600 ml-auto" />
            </button>

            <button
              onClick={() => navigate('/reportes')}
              className="flex items-center gap-3 p-4 bg-gradient-to-r from-violet-50 to-violet-100 rounded-xl hover:from-violet-100 hover:to-violet-200 transition-all duration-200 border border-violet-200 group"
            >
              <div className="bg-violet-600 p-2 rounded-lg group-hover:scale-110 transition-transform">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-800">Ver Reportes</p>
                <p className="text-xs text-slate-600">Análisis de ventas</p>
              </div>
              <ArrowUpRight className="w-5 h-5 text-violet-600 ml-auto" />
            </button>
          </div>
        </div>

        {/* ── Vista consolidada por grupo (solo super admin) ───────────── */}
        {isSuperAdmin() && grupos.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-slate-800">Vista consolidada por grupo</h2>
              <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full ml-1">
                Super Admin
              </span>
            </div>
            {grupos.map(g => <VistaCons key={g.id} grupo={g} />)}
          </div>
        )}

      </div>
    </div>
  );
};