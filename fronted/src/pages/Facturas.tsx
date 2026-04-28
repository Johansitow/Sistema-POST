/**
 * Facturas - Historial de facturas generadas
 */

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Receipt, DollarSign, Clock, CheckCircle, XCircle, Eye, Filter, Printer } from 'lucide-react';
import { facturaService, Factura } from '../services/servicios-gestion';
import { useRestauranteActivo }    from '../store/restauranteStore';
import api from '../services/api';
import { formatCurrency, formatDateTime } from '../utils';
import { EmptyState, LoadingScreen } from '../components/common';
import { printFactura } from '../utils/print';

const ESTADO_CFG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pendiente: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700 border border-amber-200',      icon: <Clock       className="w-3.5 h-3.5" /> },
  pagada:    { label: 'Pagada',    cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  anulada:   { label: 'Anulada',   cls: 'bg-red-100 text-red-700 border border-red-200',             icon: <XCircle     className="w-3.5 h-3.5" /> },
};

// Modal detalle factura
const DetalleFactura: React.FC<{ factura: Factura; onClose: () => void }> = ({ factura, onClose }) => {
  const cfg = ESTADO_CFG[factura.estado_factura] || ESTADO_CFG.pendiente;
  const [ordenFull, setOrdenFull] = useState<any | null>(null);

  useEffect(() => {
    api.get(`/ordenes/${factura.id_orden}`)
      .then(r => setOrdenFull(r.data.data ?? r.data.orden ?? r.data))
      .catch(() => {});
  }, [factura.id_orden]);

  const handlePrint = () => {
    const detalles = (ordenFull?.detalles ?? []).map((d: any) => ({
      nombre:          d.producto?.nombre ?? 'Producto',
      cantidad:        d.cantidad,
      precio_unitario: d.precio_unitario,
      notas:           d.notas,
    }));
    const pagos = (ordenFull?.pagos ?? []).map((p: any) => ({
      metodo: p.metodo_pago?.nombre ?? 'Pago',
      monto:  p.monto,
    }));
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
        total:             factura.total,
        detalles,
      },
      pagos,
      { nombre: 'Cocina Oculta' },
      factura.numero_factura,
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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

export const Facturas: React.FC = () => {
  const idRestaurante             = useRestauranteActivo();
  const [facturas, setFacturas]   = useState<Factura[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [showFiltros, setShowFiltros] = useState(false);
  const [detalle, setDetalle]     = useState<Factura | null>(null);
  const [meta, setMeta]           = useState<any>(null);
  const [page, setPage]           = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await facturaService.getAll({
        page, limit: 20,
        estado_factura: filtroEstado || undefined,
        fecha_desde:    fechaDesde || undefined,
        fecha_hasta:    fechaHasta || undefined,
        id_restaurante: idRestaurante,
      });
      setFacturas(res.data); setMeta(res.meta);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, filtroEstado, fechaDesde, fechaHasta, idRestaurante]);

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

        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
          <div className="flex gap-3">
            <button onClick={() => setShowFiltros(!showFiltros)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium transition-colors ${showFiltros ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <Filter className="w-4 h-4" /> Filtros
            </button>
            <button onClick={loadData} className="p-2.5 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors"><RefreshCw className="w-4 h-4" /></button>
          </div>
          {showFiltros && (
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100">
              <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPage(1); }}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-violet-500 outline-none">
                <option value="">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="pagada">Pagada</option>
                <option value="anulada">Anulada</option>
              </select>
              <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none" />
              <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none" />
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
                      <td className="px-5 py-4"><span className="text-sm text-slate-600 font-mono">{f.orden?.numero_orden || `#${f.id_orden}`}</span></td>
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
          {meta && meta.totalPages > 1 && (
            <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <p className="text-sm text-slate-500"><span className="font-semibold">{meta.total}</span> facturas</p>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition-colors">Anterior</button>
                <span className="px-3 py-1.5 text-xs text-slate-600">{page} / {meta.totalPages}</span>
                <button disabled={page === meta.totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition-colors">Siguiente</button>
              </div>
            </div>
          )}
        </div>
      </div>
      {detalle && <DetalleFactura factura={detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
};
