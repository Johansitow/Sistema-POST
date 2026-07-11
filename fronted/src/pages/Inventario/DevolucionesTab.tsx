/**
 * DevolucionesTab — historial de devoluciones (pérdida ligada a un lote cuando se
 * le entrega un producto nuevo al cliente) + registro de una nueva devolución.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { LoadingScreen, EmptyState } from '../../components/common';
import { inventarioService, type Movimiento } from '../../services/inventario.service';
import { DevolucionModal } from './DevolucionModal';

const LIMIT = 20;

interface DevolucionesHistorialProps {
  devoluciones: Movimiento[];
  loading: boolean;
  page: number;
  meta: any;
  onPageChange: (page: number) => void;
  onNuevaDevolucion: () => void;
}

const DevolucionesHistorial: React.FC<DevolucionesHistorialProps> = ({
  devoluciones, loading, page, meta, onPageChange, onNuevaDevolucion,
}) => {
  if (loading && devoluciones.length === 0) return <LoadingScreen message="Cargando devoluciones..." />;

  if (devoluciones.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <EmptyState
          message="No hay devoluciones registradas"
          description="Cuando se le entregue un producto nuevo a un cliente por una devolución, regístralo aquí para descontarlo del lote correspondiente"
          actionLabel="Nueva Devolución"
          onAction={onNuevaDevolucion}
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-100">
              {['Fecha', 'Producto', 'Lote', 'Cantidad', 'Motivo'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {devoluciones.map(mov => (
              <tr key={mov.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-5 py-4 text-sm text-slate-600 whitespace-nowrap">
                  {new Date(mov.fecha_movimiento).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })}
                </td>
                <td className="px-5 py-4">
                  <p className="text-sm font-semibold text-slate-800">{mov.producto?.nombre ?? '—'}</p>
                  <p className="text-xs text-slate-400 font-mono">{mov.producto?.sku}</p>
                </td>
                <td className="px-5 py-4">
                  {mov.lote ? (
                    <span className="font-mono text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-lg">
                      {mov.lote.numero_lote}
                    </span>
                  ) : <span className="text-xs text-slate-300">—</span>}
                </td>
                <td className="px-5 py-4 text-sm font-bold text-violet-700">
                  -{Number(mov.cantidad).toFixed(2)}
                </td>
                <td className="px-5 py-4 text-sm text-slate-600 max-w-xs truncate" title={mov.motivo}>{mov.motivo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <p className="text-xs text-slate-500">
            Página <strong>{page}</strong> de <strong>{meta.totalPages}</strong>
            {meta.total && ` · ${meta.total} devoluciones`}
          </p>
          <div className="flex items-center gap-2">
            <button disabled={page === 1} onClick={() => onPageChange(page - 1)}
              className="p-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1.5 text-xs text-slate-600">{page} / {meta.totalPages}</span>
            <button disabled={page === meta.totalPages} onClick={() => onPageChange(page + 1)}
              className="p-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const DevolucionesTab: React.FC = () => {
  const [devoluciones, setDevoluciones]               = useState<Movimiento[]>([]);
  const [loadingDevoluciones, setLoadingDevoluciones] = useState(true);
  const [devolucionesPage, setDevolucionesPage]       = useState(1);
  const [devolucionesMeta, setDevolucionesMeta]       = useState<any>(null);
  const [showNuevaDevolucion, setShowNuevaDevolucion] = useState(false);

  const loadDevoluciones = useCallback(() => {
    setLoadingDevoluciones(true);
    inventarioService.getMovimientos({ tipo: 'devolucion', page: devolucionesPage, limit: LIMIT })
      .then(res => { setDevoluciones(res.data); setDevolucionesMeta(res.pagination); })
      .catch(() => { setDevoluciones([]); setDevolucionesMeta(null); })
      .finally(() => setLoadingDevoluciones(false));
  }, [devolucionesPage]);

  useEffect(() => { loadDevoluciones(); }, [loadDevoluciones]);

  return (
    <>
      {/* Sub-header: subtítulo + acción principal de esta pestaña */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <p className="text-slate-500 text-sm">
            Pérdida ligada a un lote cuando se le entrega un producto nuevo al cliente
          </p>
          <button onClick={() => setShowNuevaDevolucion(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:from-violet-700 hover:to-purple-700 transition-all shadow-sm">
            <Plus className="w-4 h-4" /> Nueva Devolución
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <DevolucionesHistorial
          devoluciones={devoluciones}
          loading={loadingDevoluciones}
          page={devolucionesPage}
          meta={devolucionesMeta}
          onPageChange={setDevolucionesPage}
          onNuevaDevolucion={() => setShowNuevaDevolucion(true)}
        />
      </div>

      {showNuevaDevolucion && (
        <DevolucionModal
          onClose={() => setShowNuevaDevolucion(false)}
          onSaved={() => { setShowNuevaDevolucion(false); loadDevoluciones(); }}
        />
      )}
    </>
  );
};
