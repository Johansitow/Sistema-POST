/**
 * Cocina (KDS — Kitchen Display System)
 *
 * Vista operacional para el personal de cocina.
 * Muestra las OrdenSede activas del restaurante del usuario,
 * agrupadas por estado, con avance de estado en un solo clic.
 *
 * Flujo de estado por sede:
 *   PENDIENTE → EN_PREPARACION → LISTA
 *   (el pago lo maneja el cajero desde /ordenes)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, ChefHat, CheckCircle2, RefreshCw, Package, ArrowRight } from 'lucide-react';
import { ordenesService, type OrdenSede } from '../services/ordenes.service';
import { formatDateTime, formatCurrency } from '../utils';
import { LoadingScreen } from '../components/common';
import { useSocket } from '../hooks/useSocket';
import { toast } from '../store/uiStore';
import { clasesEstado } from '../theme/estados';

// ─── Helpers visuales ────────────────────────────────────────────────────────

// Los colores salen de theme/estados.ts (mismo vocabulario que Órdenes y las
// insignias de estado del resto de la app). Lo que se queda aquí es lo propio
// del KDS: la etiqueta de columna, el texto del botón de avance y el ícono —
// una cocina no habla de "Pendiente" sino de "Nuevas".
const ESTADO_CFG = {
  PENDIENTE: {
    label:   'Nuevas',
    dot:     clasesEstado('PENDIENTE').punto,
    card:    clasesEstado('PENDIENTE').tarjeta,
    header:  'bg-alerta-100 text-alerta-800',
    btn:     'bg-alerta-500 hover:bg-alerta-600 text-white',
    btnText: 'Iniciar preparación',
    icon:    <Clock className="w-5 h-5" />,
    priority: 0,
  },
  EN_PREPARACION: {
    label:   'En preparación',
    dot:     clasesEstado('EN_PREPARACION').punto,
    card:    clasesEstado('EN_PREPARACION').tarjeta,
    header:  'bg-info-100 text-info-800',
    btn:     'bg-info-500 hover:bg-info-600 text-white',
    btnText: 'Marcar lista',
    icon:    <ChefHat className="w-5 h-5" />,
    priority: 1,
  },
  LISTA: {
    label:   'Listas para cobro',
    dot:     clasesEstado('LISTA').punto,
    card:    clasesEstado('LISTA').tarjeta,
    header:  'bg-exito-100 text-exito-800',
    btn:     null,
    btnText: '',
    icon:    <CheckCircle2 className="w-5 h-5" />,
    priority: 2,
  },
} as const;

type EstadoActivo = keyof typeof ESTADO_CFG;
const ESTADOS_ACTIVOS: EstadoActivo[] = ['PENDIENTE', 'EN_PREPARACION', 'LISTA'];

// ─── Ticker de tiempo transcurrido ──────────────────────────────────────────

const Elapsed: React.FC<{ desde: string }> = ({ desde }) => {
  const [secs, setSecs] = useState(() =>
    Math.floor((Date.now() - new Date(desde).getTime()) / 1000)
  );

  useEffect(() => {
    const id = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const mins = Math.floor(secs / 60);
  const urgent = mins >= 15;
  const warn   = mins >= 8 && !urgent;

  return (
    <span className={`text-xs font-mono tabular-nums font-semibold ${urgent ? 'text-red-600' : warn ? 'text-amber-600' : 'text-slate-500'}`}>
      {mins}:{String(secs % 60).padStart(2, '0')}
    </span>
  );
};

// ─── Tarjeta de sede ────────────────────────────────────────────────────────

const SedeCard: React.FC<{
  sede:       OrdenSede;
  onAvanzar:  (id: number) => Promise<void>;
}> = ({ sede, onAvanzar }) => {
  const [loading, setLoading] = useState(false);
  const estado = sede.estado as EstadoActivo;
  const cfg    = ESTADO_CFG[estado] ?? ESTADO_CFG.PENDIENTE;

  const handleAvanzar = async () => {
    setLoading(true);
    try { await onAvanzar(sede.id); }
    finally { setLoading(false); }
  };

  return (
    <div className={`rounded-2xl border-2 overflow-hidden shadow-sm hover:shadow-md transition-shadow ${cfg.card}`}>

      {/* Header */}
      <div className={`px-4 py-3 flex items-center justify-between ${cfg.header}`}>
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm">#{sede.sufijo}</span>
          {sede.restaurante && (
            <span className="text-xs opacity-75 truncate max-w-[120px]">
              {sede.restaurante.nombre}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {sede.iniciado_en && <Elapsed desde={sede.iniciado_en} />}
          <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
        </div>
      </div>

      {/* Items */}
      <div className="px-4 py-3 space-y-2">
        {sede.items.map(item => (
          <div key={item.id} className="flex items-start gap-2.5">
            <div className="mt-0.5 w-6 h-6 rounded-lg bg-white shadow-sm flex items-center justify-center flex-shrink-0">
              <Package className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-1">
                <p className="text-sm font-semibold text-slate-800 leading-tight truncate">
                  {item.cantidad > 1 && (
                    <span className="text-slate-500 font-normal mr-1">{item.cantidad}×</span>
                  )}
                  {item.producto?.nombre || `Producto #${item.id_producto}`}
                </p>
              </div>
              {item.notas && (
                <p className="text-xs text-amber-700 bg-amber-100 rounded px-1.5 mt-0.5 inline-block">
                  {item.notas}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-black/5 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {formatCurrency(sede.total)}
        </span>
        {cfg.btn ? (
          <button
            onClick={handleAvanzar}
            disabled={loading}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all disabled:opacity-50 ${cfg.btn}`}
          >
            {loading
              ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              : <ArrowRight className="w-3.5 h-3.5" />
            }
            {cfg.btnText}
          </button>
        ) : (
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" /> Lista
          </span>
        )}
      </div>
    </div>
  );
};

// ─── Componente principal ────────────────────────────────────────────────────

export const Cocina: React.FC = () => {
  const [sedes, setSedes]           = useState<OrdenSede[]>([]);
  const [loading, setLoading]       = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const cargar = useCallback(async () => {
    try {
      const res = await ordenesService.listarSedes({ limit: 100 });
      setSedes(res.data.filter(s => ESTADOS_ACTIVOS.includes(s.estado as EstadoActivo)));
      setLastUpdate(new Date());
    } catch (e) {
      console.error('KDS error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga inicial + polling cada 30s
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const id = setInterval(cargar, 30_000);
    return () => clearInterval(id);
  }, [cargar]);

  // WebSocket: recargar en eventos de nueva orden o cambio de estado
  useSocket('cocina', {
    onNuevaOrden:     () => { cargar(); },
    onEstadoOrden:    () => { cargar(); },
    onOrdenCancelada: () => { cargar(); },
  });

  const handleAvanzar = async (id: number) => {
    try {
      await ordenesService.avanzarSede(id);
      await cargar();
    } catch (e: any) {
      toast.error(e.message || 'No se pudo avanzar el estado de la orden');
    }
  };

  const totalActivas = sedes.filter(s => s.estado !== 'LISTA').length;

  if (loading) return <LoadingScreen message="Cargando órdenes de cocina..." />;

  return (
    <div className="min-h-screen bg-slate-900 text-white">

      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500 p-2 rounded-xl">
              <ChefHat className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Pantalla de Cocina</h1>
              <p className="text-slate-400 text-xs">
                {totalActivas > 0
                  ? `${totalActivas} sede${totalActivas !== 1 ? 's' : ''} en preparación`
                  : 'Sin pedidos activos'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-xs">
              Actualizado {formatDateTime(lastUpdate.toISOString())}
            </span>
            <button
              onClick={cargar}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-xl transition-colors"
              title="Recargar"
            >
              <RefreshCw className="w-4 h-4 text-slate-300" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid de columnas por estado */}
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        {sedes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
            <ChefHat className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-xl font-semibold">Cocina al día</p>
            <p className="text-sm mt-1">No hay pedidos pendientes en este momento</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {ESTADOS_ACTIVOS.map(estado => {
              const cfg   = ESTADO_CFG[estado];
              const grupo = sedes.filter(s => s.estado === estado);
              return (
                <div key={estado}>
                  {/* Encabezado de columna */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-3 h-3 rounded-full ${cfg.dot}`} />
                    <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
                      {cfg.label}
                    </h2>
                    <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                      grupo.length > 0
                        ? `bg-white/10 text-white`
                        : 'bg-slate-700 text-slate-500'
                    }`}>
                      {grupo.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-3">
                    {grupo.length === 0 ? (
                      <div className="rounded-2xl border-2 border-dashed border-slate-700 p-6 text-center text-slate-600 text-sm">
                        Sin pedidos
                      </div>
                    ) : (
                      grupo.map(sede => (
                        <SedeCard
                          key={sede.id}
                          sede={sede}
                          onAvanzar={handleAvanzar}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
