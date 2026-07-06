/**
 * LoteRentabilidad — Desglose de rentabilidad real de un lote
 * Usa merma real desde Movimiento (tipo='merma'), no estimada.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import api from '../../services/api';
import { formatCurrency } from '../../utils';

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface RentabilidadLote {
  lote_id:               number;
  numero_lote:           string;
  producto:              string;
  cantidad_producida:    number;
  merma_real_cantidad:   number;
  merma_real_porcentaje: number;
  cantidad_vendida:      number;
  costo_ingredientes:    number;
  costo_con_merma:       number;
  perdida_merma:         number;
  precio_venta:          number | null;
  ingresos:              number | null;
  ganancia_neta:         number | null;
  margen_porcentaje:     number | null;
  tiene_receta:          boolean;
  advertencias:          { ingrediente: string; mensaje: string }[];
}

interface Props {
  loteId: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function MargenChip({ margen }: { margen: number | null }) {
  if (margen === null) return <span className="text-slate-400 text-sm">—</span>;
  if (margen >= 30)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium">
        <TrendingUp className="w-3.5 h-3.5" /> {margen.toFixed(1)}%
      </span>
    );
  if (margen >= 0)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-sm font-medium">
        <Minus className="w-3.5 h-3.5" /> {margen.toFixed(1)}%
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-sm font-medium">
      <TrendingDown className="w-3.5 h-3.5" /> {margen.toFixed(1)}%
    </span>
  );
}

function Fila({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-medium font-mono ${className ?? ''}`}>{value}</span>
    </div>
  );
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function LoteRentabilidad({ loteId }: Props) {
  const [data, setData] = useState<RentabilidadLote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.get(`/inventario/lotes/${loteId}/rentabilidad`)
      .then(r => setData(r.data.data))
      .catch(() => setError('No se pudo cargar la rentabilidad del lote.'))
      .finally(() => setLoading(false));
  }, [loteId]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
        Calculando rentabilidad…
      </div>
    );

  if (error)
    return (
      <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
        <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
      </div>
    );

  if (!data) return null;

  const sinReceta = !data.tiene_receta;

  return (
    <div className="space-y-4">
      {/* Sin receta */}
      {sinReceta && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Este producto no tiene receta activa. El costo de ingredientes no está disponible.</span>
        </div>
      )}

      {/* Advertencias de proveedores */}
      {data.advertencias.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
          {data.advertencias.map((a, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span><strong>{a.ingrediente}:</strong> {a.mensaje}</span>
            </div>
          ))}
        </div>
      )}

      {/* Merma real */}
      <div className="bg-slate-50 rounded-lg p-4">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Merma real (histórica)</h4>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xl font-bold text-slate-800">{Number(data.cantidad_producida).toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-0.5">Producidas</p>
          </div>
          <div>
            <p className="text-xl font-bold text-red-600">{Number(data.merma_real_cantidad).toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-0.5">Merma ({data.merma_real_porcentaje.toFixed(1)}%)</p>
          </div>
          <div>
            <p className="text-xl font-bold text-emerald-700">{Number(data.cantidad_vendida).toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-0.5">Vendidas</p>
          </div>
        </div>
      </div>

      {/* Costos */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Costos</h4>
        <Fila label="Costo de ingredientes"    value={formatCurrency(data.costo_ingredientes)} />
        <Fila label="Pérdida por merma"        value={formatCurrency(data.perdida_merma)} className="text-red-600" />
        <Fila label="Costo total (con merma)"  value={formatCurrency(data.costo_con_merma)} />
        <Fila label="Precio de venta unitario" value={data.precio_venta != null ? formatCurrency(data.precio_venta) : '—'} />
        <Fila label="Ingresos totales"         value={data.ingresos != null ? formatCurrency(data.ingresos) : '—'} />
      </div>

      {/* Resultado */}
      <div className={`rounded-lg p-4 border ${
        data.ganancia_neta === null
          ? 'bg-slate-50 border-slate-200'
          : data.ganancia_neta >= 0
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ganancia neta</p>
            <p className={`text-2xl font-bold mt-1 ${
              data.ganancia_neta === null
                ? 'text-slate-400'
                : data.ganancia_neta >= 0 ? 'text-emerald-700' : 'text-red-700'
            }`}>
              {data.ganancia_neta != null ? formatCurrency(data.ganancia_neta) : '—'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Margen</p>
            <MargenChip margen={data.margen_porcentaje} />
          </div>
        </div>

        {data.ganancia_neta !== null && data.ganancia_neta < 0 && (
          <div className="mt-3 flex items-start gap-2 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Lote no rentable. Revisa la receta, los precios o el proceso de producción para reducir merma.</span>
          </div>
        )}
      </div>
    </div>
  );
}
