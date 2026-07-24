/**
 * Facturas - Historial de facturas generadas
 */

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Receipt, DollarSign, Clock, CheckCircle, XCircle, Eye, Filter, Printer, Search } from 'lucide-react';
import { facturaService, Factura } from '../services/servicios-gestion';
import { useRestauranteActivo }    from '../store/restauranteStore';
import api from '../services/api';
import { formatCurrency, formatDateTime, buildDateParams } from '../utils';
import { EmptyState, LoadingScreen } from '../components/common';
import { printFactura, type PrintTemplateConfig } from '../utils/print';
import { cargarConfigImpresion } from '../lib/plantillas/negocio';
import { plantillasService } from '../services/plantillas.service';
import { Z_INDEX } from '../lib/zIndex';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { clasesEstado, definirEstado } from '../theme/estados';

// Color y etiqueta vienen de theme/estados.ts (dominio 'factura'); aquí solo
// queda el ícono, que es lo propio de esta pantalla.
const ESTADO_CFG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pendiente: { ...definirEstado('pendiente', 'factura'), cls: clasesEstado('pendiente', 'factura').insignia, icon: <Clock       className="w-3.5 h-3.5" /> },
  pagada:    { ...definirEstado('pagada',    'factura'), cls: clasesEstado('pagada',    'factura').insignia, icon: <CheckCircle className="w-3.5 h-3.5" /> },
  anulada:   { ...definirEstado('anulada',   'factura'), cls: clasesEstado('anulada',   'factura').insignia, icon: <XCircle     className="w-3.5 h-3.5" /> },
};

// Resuelve las líneas de producto de una orden, sin importar si es legado (orden.detalles)
// o de arquitectura nueva (orden.sedes[].items) — misma forma en ambos casos.
const resolverItemsFactura = (ordenFull: any): Array<{ nombre: string; cantidad: number; precio_unitario: number; notas?: string }> => {
  if (ordenFull?.sedes?.length) {
    return ordenFull.sedes.flatMap((s: any) => s.items ?? []).map((i: any) => ({
      nombre:          i.producto?.nombre ?? 'Producto',
      cantidad:        i.cantidad,
      precio_unitario: i.precio_unitario,
      notas:           i.notas,
    }));
  }
  return (ordenFull?.detalles ?? []).map((d: any) => ({
    nombre:          d.producto?.nombre ?? 'Producto',
    cantidad:        d.cantidad,
    precio_unitario: d.precio_unitario,
    notas:           d.notas,
  }));
};

// Modal detalle factura
const DetalleFactura: React.FC<{ factura: Factura; onClose: () => void }> = ({ factura, onClose }) => {
  const cfg = ESTADO_CFG[factura.estado_factura] || ESTADO_CFG.pendiente;
  const [ordenFull, setOrdenFull] = useState<any | null>(null);
  useEscapeKey(onClose);

  useEffect(() => {
    api.get(`/ordenes/${factura.id_orden}`)
      .then(r => setOrdenFull(r.data.data ?? r.data.orden ?? r.data))
      .catch(() => {});
  }, [factura.id_orden]);

  const items = resolverItemsFactura(ordenFull);

  const handlePrint = async () => {
    const detalles = items;
    const pagos = (ordenFull?.pagos ?? []).map((p: any) => ({
      metodo: p.metodo_pago?.nombre ?? 'Pago',
      monto:  p.monto,
    }));
    const [def, cfgImpr] = await Promise.all([
      plantillasService.obtenerDefault('ticket').catch(() => null),
      cargarConfigImpresion(),
    ]);
    const cfgPl = def?.plantilla as any;
    const tmpl: PrintTemplateConfig = {
      paperWidth: cfgPl?.config?.paperWidth,
      fontSize:   cfgPl?.config?.fontSize,
      showLogo:   cfgPl?.config?.showLogo,
      sections:   cfgPl?.sections,
      footerText: cfgImpr.pieTicket,
    };
    printFactura(
      {
        numero_orden:      ordenFull?.numero_orden ?? factura.orden?.numero_orden ?? `#${factura.id_orden}`,
        tipo_orden:        ordenFull?.tipo_orden ?? 'local',
        fecha_apertura:    ordenFull?.fecha_apertura ?? factura.fecha_emision,
        nombre_contacto:   ordenFull?.nombre_contacto,
        telefono:          ordenFull?.telefono,
        direccion_entrega: ordenFull?.direccion_entrega,
        costo_domicilio:   ordenFull?.costo_domicilio,
        observaciones:     ordenFull?.observaciones,
        subtotal:          factura.subtotal,
        impuestos:         factura.impuestos,
        impuesto_tipo:     ordenFull?.impuesto_tipo,
        total:             factura.total,
        detalles,
      },
      pagos,
      cfgImpr.negocio,
      factura.numero_factura,
      tmpl,
    );
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: Z_INDEX.MODAL_BASE }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-violet-200 text-xs">Factura</p>
            <h2 className="text-white font-bold text-lg">{factura.numero_factura}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              title="Imprimir factura"
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimir
            </button>
            <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/20 transition-colors">✕</button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl ${cfg.cls}`}>
            {cfg.icon}<span className="text-sm font-semibold">{cfg.label}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500 mb-1">Orden</p><p className="font-semibold text-slate-700 text-sm">{factura.orden?.numero_orden || `#${factura.id_orden}`}</p></div>
            <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500 mb-1">Emisión</p><p className="font-semibold text-slate-700 text-sm">{formatDateTime(factura.fecha_emision)}</p></div>
          </div>
          {factura.fecha_pago && (
            <div className="bg-emerald-50 rounded-xl p-3"><p className="text-xs text-emerald-600 mb-1">Fecha de Pago</p><p className="font-semibold text-emerald-700 text-sm">{formatDateTime(factura.fecha_pago)}</p></div>
          )}
          {items.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
              <p className="text-xs text-slate-500 mb-1">Productos</p>
              {items.map((it, idx) => (
                <div key={idx} className="flex justify-between text-sm text-slate-700">
                  <span>{it.cantidad}× {it.nombre}</span>
                  <span>{formatCurrency(it.cantidad * it.precio_unitario)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm text-slate-600"><span>Subtotal</span><span>{formatCurrency(factura.subtotal)}</span></div>
            <div className="flex justify-between text-sm text-slate-600"><span>Impuestos</span><span>{formatCurrency(factura.impuestos)}</span></div>
            <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-800">
              <span>Total</span><span className="text-lg">{formatCurrency(factura.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PAGE_SIZE_OPTS = [20, 50, 100];

const DATE_RANGE_OPTS = [
  { value: 'all',    label: 'Todo' },
  { value: 'today',  label: 'Hoy' },
  { value: 'week',   label: 'Semana' },
  { value: 'month',  label: 'Mes' },
  { value: 'custom', label: 'Personalizado' },
];

export const Facturas: React.FC = () => {
  const idRestaurante             = useRestauranteActivo();
  const [facturas, setFacturas]   = useState<Factura[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [dateRange, setDateRange]   = useState('all');
  const [customDesde, setCustomDesde] = useState('');
  const [customHasta, setCustomHasta] = useState('');
  const [showFiltros, setShowFiltros] = useState(false);
  const [detalle, setDetalle]     = useState<Factura | null>(null);
  const [meta, setMeta]           = useState<any>(null);
  const [page, setPage]           = useState(1);
  const [limit, setLimit]         = useState(20);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm]   = useState('');

  // Búsqueda con debounce por número de factura, número de orden o cliente
  useEffect(() => {
    const timer = setTimeout(() => { setSearchTerm(searchInput); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { fecha_desde, fecha_hasta } = buildDateParams(dateRange, customDesde, customHasta);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await facturaService.getAll({
        page, limit,
        estado_factura: filtroEstado || undefined,
        fecha_desde, fecha_hasta,
        search:         searchTerm || undefined,
        id_restaurante: idRestaurante,
      });
      setFacturas(res.data); setMeta(res.meta);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, limit, filtroEstado, fecha_desde, fecha_hasta, searchTerm, idRestaurante]);

  useEffect(() => { loadData(); }, [loadData]);

  const stats = {
    total:     facturas.length,
    pendientes: facturas.filter(f => f.estado_factura === 'pendiente').length,
    pagadas:    facturas.filter(f => f.estado_factura === 'pagada').length,
    totalPagado: facturas.filter(f => f.estado_factura === 'pagada').reduce((s, f) => s + f.total, 0),
  };

  if (loading && facturas.length === 0) return <LoadingScreen message="Cargando facturas..." />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/20 to-slate-100">
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <h1 className="text-2xl font-bold text-slate-800">Facturas</h1>
          <p className="text-slate-500 text-sm mt-0.5">Historial de facturas generadas automáticamente</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total',        value: meta?.total || stats.total,     icon: <Receipt     className="w-5 h-5" />, color: 'from-violet-500 to-violet-600'   },
            { label: 'Pendientes',   value: stats.pendientes,               icon: <Clock       className="w-5 h-5" />, color: 'from-amber-500 to-amber-600'     },
            { label: 'Pagadas',      value: stats.pagadas,                  icon: <CheckCircle className="w-5 h-5" />, color: 'from-emerald-500 to-emerald-600' },
            { label: 'Total Cobrado',value: formatCurrency(stats.totalPagado), icon: <DollarSign className="w-5 h-5" />, color: 'from-blue-500 to-blue-600'   },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-4">
              <div className={`bg-gradient-to-br ${s.color} p-3 rounded-xl shadow-lg`}><div className="text-white">{s.icon}</div></div>
              <div><p className="text-xs text-slate-500">{s.label}</p><p className="text-xl font-bold text-slate-800">{s.value}</p></div>
            </div>
          ))}
        </div>

        {/* Buscador + Filtros */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Buscar por N° factura, N° orden o cliente..."
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none"
              />
            </div>
            <button onClick={() => setShowFiltros(!showFiltros)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium transition-colors ${showFiltros ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <Filter className="w-4 h-4" /> Filtros
            </button>
            <button onClick={loadData} className="p-2.5 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors"><RefreshCw className="w-4 h-4" /></button>
          </div>
          {showFiltros && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-3">
                <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPage(1); }}
                  className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-violet-500 outline-none">
                  <option value="">Todos los estados</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="pagada">Pagada</option>
                  <option value="anulada">Anulada</option>
                </select>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                  {DATE_RANGE_OPTS.map(opt => (
                    <button key={opt.value} onClick={() => { setDateRange(opt.value); setPage(1); }}
                      className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${dateRange === opt.value ? 'bg-white shadow-sm text-violet-700' : 'text-slate-500 hover:text-slate-700'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {dateRange === 'custom' && (
                <div className="flex gap-3">
                  <input type="date" value={customDesde} onChange={e => { setCustomDesde(e.target.value); setPage(1); }}
                    className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none" />
                  <input type="date" value={customHasta} onChange={e => { setCustomHasta(e.target.value); setPage(1); }}
                    className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                  {['# Factura', 'Orden', 'Emisión', 'Pago', 'Subtotal', 'Total', 'Estado', ''].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {facturas.length === 0 ? (
                  <tr><td colSpan={8}><EmptyState message="No hay facturas" description="Las facturas se generan automáticamente cuando una orden pasa a En Preparación" /></td></tr>
                ) : facturas.map(f => {
                  const cfg = ESTADO_CFG[f.estado_factura] || ESTADO_CFG.pendiente;
                  return (
                    <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4"><span className="font-mono text-sm font-bold text-violet-600">{f.numero_factura}</span></td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-slate-600 font-mono block">{f.orden?.numero_orden || `#${f.id_orden}`}</span>
                        {f.orden?.cliente?.nombre_completo && (
                          <span className="text-xs text-slate-400">{f.orden.cliente.nombre_completo}</span>
                        )}
                      </td>
                      <td className="px-5 py-4"><span className="text-sm text-slate-600">{formatDateTime(f.fecha_emision)}</span></td>
                      <td className="px-5 py-4"><span className="text-sm text-slate-500">{f.fecha_pago ? formatDateTime(f.fecha_pago) : '—'}</span></td>
                      <td className="px-5 py-4"><span className="text-sm text-slate-600">{formatCurrency(f.subtotal)}</span></td>
                      <td className="px-5 py-4"><span className="text-sm font-bold text-slate-800">{formatCurrency(f.total)}</span></td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 w-fit ${cfg.cls}`}>
                          {cfg.icon}{cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <button onClick={() => setDetalle(f)} className="p-2 text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"><Eye className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {meta && meta.total > 0 && (
            <div className="px-5 py-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
              <p className="text-sm text-slate-500">
                Mostrando <span className="font-semibold">{(page - 1) * limit + 1}</span>–
                <span className="font-semibold">{Math.min(page * limit, meta.total)}</span> de{' '}
                <span className="font-semibold">{meta.total}</span> facturas
              </p>
              <div className="flex items-center gap-3">
                <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-violet-500 outline-none">
                  {PAGE_SIZE_OPTS.map(n => <option key={n} value={n}>{n} / página</option>)}
                </select>
                {meta.totalPages > 1 && (
                  <div className="flex gap-2">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition-colors">Anterior</button>
                    <span className="px-3 py-1.5 text-xs text-slate-600">{page} / {meta.totalPages}</span>
                    <button disabled={page === meta.totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition-colors">Siguiente</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {detalle && <DetalleFactura factura={detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
};
