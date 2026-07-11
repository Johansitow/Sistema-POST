/**
 * MODAL DEVOLUCIÓN — pérdida ligada a un lote (se entrega producto nuevo al cliente)
 *
 * Se usa desde dos lugares:
 * - LotesTab: acción rápida por fila de un lote (prop `lote` fijo).
 * - DevolucionesTab: botón "Nueva Devolución" (sin `lote`, se elige producto y lote).
 */

import React, { useState, useEffect } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { ErrorAlert } from '../../components/common';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { Z_INDEX } from '../../lib/zIndex';
import { inventarioService } from '../../services/inventario.service';
import { productosService, type Producto } from '../../services/productos.service';
import type { Lote } from './shared';

interface DevolucionModalProps {
  /** Si viene de la fila de un lote, ya está fijo (solo Cantidad + Motivo). Si no, hay que elegir Producto y Lote. */
  lote?: Lote;
  onClose: () => void;
  onSaved: () => void;
}

export const DevolucionModal: React.FC<DevolucionModalProps> = ({ lote, onClose, onSaved }) => {
  useEscapeKey(onClose);
  const [productos, setProductos]               = useState<Producto[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(!lote);
  const [idProducto, setIdProducto]             = useState<number | null>(lote?.id_producto ?? null);
  const [lotesActivos, setLotesActivos]         = useState<any[]>([]);
  const [loadingLotes, setLoadingLotes]         = useState(false);
  const [idLote, setIdLote]                     = useState<number | null>(lote?.id ?? null);
  const [cantidad, setCantidad]                 = useState('');
  const [motivo, setMotivo]                     = useState('');
  const [saving, setSaving]                     = useState(false);
  const [error, setError]                       = useState<string | null>(null);

  // Sin lote preseleccionado: cargar el catálogo de productos para elegir
  useEffect(() => {
    if (lote) return;
    productosService.getAll({ estado: 'activo', limit: 500 })
      .then(setProductos)
      .catch(() => {})
      .finally(() => setLoadingProductos(false));
  }, [lote]);

  // Al elegir un producto (sin lote fijo), cargar sus lotes activos.
  // Si `lote` viene fijo desde una fila, no se toca nada aquí (idLote ya quedó
  // inicializado a lote.id y no depende de este efecto).
  useEffect(() => {
    if (lote) return;
    if (!idProducto) { setLotesActivos([]); setIdLote(null); return; }
    setLoadingLotes(true);
    inventarioService.getLotesActivos(idProducto)
      .then(setLotesActivos)
      .catch(() => setLotesActivos([]))
      .finally(() => setLoadingLotes(false));
  }, [idProducto, lote]);

  const unidad = lote?.producto.unidad_medida ?? productos.find(p => p.id === idProducto)?.unidad_medida ?? '';

  const handleSubmit = async () => {
    if (!idProducto) { setError('Selecciona un producto'); return; }
    if (!idLote)      { setError('Selecciona el lote afectado'); return; }
    if (!cantidad || parseFloat(cantidad) <= 0) { setError('La cantidad debe ser mayor a 0'); return; }
    if (!motivo.trim()) { setError('El motivo es obligatorio'); return; }

    setSaving(true); setError(null);
    try {
      await inventarioService.registrarMovimiento({
        id_producto:     idProducto,
        tipo_movimiento: 'devolucion',
        cantidad:        parseFloat(cantidad),
        motivo:          motivo.trim(),
        id_lote:         idLote,
      });
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Error al registrar la devolución');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: Z_INDEX.MODAL_BASE }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs mb-0.5">{lote ? lote.numero_lote : 'Devolución'}</p>
            <h2 className="text-white font-bold text-base">
              {lote ? `Devolución — ${lote.producto.nombre}` : 'Registrar devolución'}
            </h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/15 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && <ErrorAlert message={error} />}

          {!lote && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Producto <span className="text-red-500">*</span>
              </label>
              {loadingProductos ? (
                <p className="text-xs text-slate-400">Cargando productos...</p>
              ) : (
                <select value={idProducto ?? ''} onChange={e => setIdProducto(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-violet-400">
                  <option value="">— Selecciona un producto —</option>
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {!lote && idProducto && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Lote afectado <span className="text-red-500">*</span>
              </label>
              {loadingLotes ? (
                <p className="text-xs text-slate-400">Cargando lotes...</p>
              ) : lotesActivos.length > 0 ? (
                <select value={idLote ?? ''} onChange={e => setIdLote(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-violet-400">
                  <option value="">— Selecciona un lote —</option>
                  {lotesActivos.map((l: any) => (
                    <option key={l.id} value={l.id}>
                      {l.numero_lote}{l.fecha_vencimiento ? ` · vence ${new Date(l.fecha_vencimiento).toLocaleDateString('es-CO')}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-slate-500">Este producto no tiene lotes activos registrados.</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Cantidad {unidad && `(${unidad})`} <span className="text-red-500">*</span>
            </label>
            <input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)}
              placeholder="Ej: 1" min="0" step="0.01"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-400" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Motivo <span className="text-red-500">*</span>
            </label>
            <textarea rows={2} value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Ej: Cliente devolvió el producto, se le entregó uno nuevo"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-violet-400" />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 bg-slate-50/80">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-[2] py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 shadow-sm">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {saving ? 'Registrando...' : 'Registrar Devolución'}
          </button>
        </div>
      </div>
    </div>
  );
};
