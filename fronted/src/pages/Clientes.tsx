/**
 * Clientes.tsx
 * Módulo completo de gestión de clientes para Cocina Oculta POS
 *
 * Secciones:
 * - Stats cards (total, activos, frecuentes, VIP)
 * - Tabla paginada con búsqueda y filtros
 * - Modal crear/editar cliente
 * - Modal detalle: historial de órdenes + sistema de puntos
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, UserPlus, Star, TrendingUp, Search, Filter, RefreshCw,
  Eye, Edit2, ToggleLeft, ToggleRight, Phone, Mail, MapPin,
  ShoppingBag, Gift, ChevronLeft, ChevronRight, X,
  Award, Crown, Building2, Bike, User, Plus, Minus, Package,
} from 'lucide-react';
import { clienteService } from '../services/cliente.service';
import api, { getErrorMessage } from '../services/api';
import { formatCurrency, formatDateTime, formatDateShort } from '../utils';
import { LoadingScreen, EmptyState, ConfirmDialog, ClienteFormModal } from '../components/common';
import { toast } from '../store/uiStore';
import { Z_INDEX } from '../lib/zIndex';
import { useEscapeKey } from '../hooks/useEscapeKey';

// ─── Tipos locales ────────────────────────────────────────────────────────────

interface Cliente {
  id:                number;
  uuid:              string;
  nombre_completo:   string;
  email?:            string;
  telefono?:         string;
  telefono_alterno?: string;
  tipo_documento?:   string;
  numero_documento?: string;
  direccion?:        string;
  ciudad?:           string;
  tipo_cliente:      'regular' | 'frecuente' | 'vip' | 'corporativo' | 'delivery';
  estado:            'activo' | 'inactivo' | 'eliminado';
  puntos_acumulados: number;
  total_gastado:     number;
  total_ordenes:     number;
  notas?:            string;
  canal_adquisicion?: string;
  fecha_nacimiento?: string;
  fecha_creacion:    string;
  ultima_visita?:    string;
  direcciones?:      any[];
}

interface Orden {
  id:            number;
  numero_orden:  string;
  total:         number;
  estado?:       { nombre: string; color?: string };
  fecha_apertura: string;
  detalles?:     any[];
}

interface Punto {
  id:           number;
  tipo:         string;
  puntos:       number;
  descripcion:  string;
  saldo_antes:  number;
  saldo_despues: number;
  fecha:        string;
  orden?:       { numero_orden: string; total: number } | null;
}

// ─── Configuración visual por tipo ───────────────────────────────────────────

const TIPO_CFG: Record<string, { label: string; cls: string; icon: React.ReactNode; gradient: string }> = {
  regular:     { label: 'Regular',     cls: 'bg-slate-100 text-slate-600 border border-slate-200',      icon: <User       className="w-3 h-3" />, gradient: 'from-slate-400 to-slate-500'    },
  frecuente:   { label: 'Frecuente',   cls: 'bg-blue-100 text-blue-700 border border-blue-200',         icon: <TrendingUp className="w-3 h-3" />, gradient: 'from-blue-500 to-blue-600'      },
  vip:         { label: 'VIP',         cls: 'bg-amber-100 text-amber-700 border border-amber-200',      icon: <Crown      className="w-3 h-3" />, gradient: 'from-amber-400 to-amber-500'    },
  corporativo: { label: 'Corporativo', cls: 'bg-purple-100 text-purple-700 border border-purple-200',   icon: <Building2  className="w-3 h-3" />, gradient: 'from-purple-500 to-purple-600'  },
  delivery:    { label: 'Delivery',    cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200',icon: <Bike       className="w-3 h-3" />, gradient: 'from-emerald-500 to-emerald-600' },
};

const TIPO_PUNTO_CFG: Record<string, { cls: string; sign: string }> = {
  ganado:      { cls: 'text-emerald-600', sign: '+' },
  canjeado:    { cls: 'text-red-500',     sign: '-' },
  ajuste:      { cls: 'text-blue-600',    sign: '±' },
  vencimiento: { cls: 'text-slate-400',   sign: '-' },
  bienvenida:  { cls: 'text-violet-600',  sign: '+' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getInitials = (nombre: string) =>
  nombre.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

const getAvatarGradient = (tipo: string) => {
  const map: Record<string, string> = {
    regular:     'from-slate-400 to-slate-600',
    frecuente:   'from-blue-400 to-blue-600',
    vip:         'from-amber-400 to-orange-500',
    corporativo: 'from-purple-400 to-purple-600',
    delivery:    'from-emerald-400 to-emerald-600',
  };
  return map[tipo] || 'from-slate-400 to-slate-600';
};

// ─── Modal Detalle ────────────────────────────────────────────────────────────

const DetalleCliente: React.FC<{ cliente: Cliente; onClose: () => void; onEdit: () => void }> = ({
  cliente, onClose, onEdit,
}) => {
  const [tab, setTab]           = useState<'ordenes' | 'puntos'>('ordenes');
  const [ordenes, setOrdenes]   = useState<Orden[]>([]);
  const [puntos, setPuntos]     = useState<Punto[]>([]);
  const [loadingTab, setLoadingTab] = useState(false);
  const [metaOrdenes, setMetaOrdenes] = useState<any>(null);
  const [metaPuntos, setMetaPuntos]   = useState<any>(null);
  const [pageO, setPageO]       = useState(1);
  const [pageP, setPageP]       = useState(1);
  const [canjeando, setCanjeando] = useState(false);
  const [puntosACanjear, setPuntosACanjear] = useState('');
  const [ordenDetalle, setOrdenDetalle]   = useState<any | null>(null);
  const [loadingOrden, setLoadingOrden]   = useState(false);
  // ESC cierra el panel de orden si está abierto; si no, cierra el detalle del cliente
  useEscapeKey(() => setOrdenDetalle(null), ordenDetalle !== null);
  useEscapeKey(onClose, ordenDetalle === null);

  const cfg = TIPO_CFG[cliente.tipo_cliente] || TIPO_CFG.regular;

  const verOrden = async (id: number) => {
    setLoadingOrden(true);
    try {
      const res = await api.get(`/ordenes/${id}`);
      setOrdenDetalle(res.data.data ?? res.data.orden ?? res.data);
    } catch { /* silencioso */ }
    finally { setLoadingOrden(false); }
  };

  const loadOrdenes = useCallback(async () => {
    setLoadingTab(true);
    try {
      const res = await clienteService.getOrdenes(cliente.id, { page: pageO, limit: 10 });
      setOrdenes(res.data || []);
      setMetaOrdenes(res.meta);
    } catch { /* silencioso */ }
    finally { setLoadingTab(false); }
  }, [cliente.id, pageO]);

  const loadPuntos = useCallback(async () => {
    setLoadingTab(true);
    try {
      const res = await clienteService.getPuntos(cliente.id, { page: pageP, limit: 15 });
      setPuntos(res.data || []);
      setMetaPuntos(res.meta);
    } catch { /* silencioso */ }
    finally { setLoadingTab(false); }
  }, [cliente.id, pageP]);

  useEffect(() => { if (tab === 'ordenes') loadOrdenes(); }, [tab, loadOrdenes]);
  useEffect(() => { if (tab === 'puntos')  loadPuntos();  }, [tab, loadPuntos]);

  const handleCanjear = async () => {
    const n = parseInt(puntosACanjear);
    if (!n || n <= 0) return;
    setCanjeando(true);
    try {
      await clienteService.canjearPuntos(cliente.id, n);
      setPuntosACanjear('');
      loadPuntos();
      toast.success('Puntos canjeados correctamente');
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    } finally { setCanjeando(false); }
  };

  return (
    <>
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: Z_INDEX.MODAL_BASE }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header con gradiente según tipo */}
        <div className={`bg-gradient-to-r ${getAvatarGradient(cliente.tipo_cliente)} px-6 py-5`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-white font-bold text-xl shadow-lg">
                {getInitials(cliente.nombre_completo)}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-white font-bold text-xl">{cliente.nombre_completo}</h2>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 bg-white/20 text-white border border-white/30`}>
                    {cfg.icon}{cfg.label}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-white/70 text-sm">
                  {cliente.email    && <span className="flex items-center gap-1"><Mail  className="w-3.5 h-3.5" />{cliente.email}</span>}
                  {cliente.telefono && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{cliente.telefono}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onEdit} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs rounded-lg transition-colors flex items-center gap-1">
                <Edit2 className="w-3.5 h-3.5" /> Editar
              </button>
              <button onClick={onClose} className="p-1.5 text-white/70 hover:text-white hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Mini stats */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: 'Total gastado',  value: formatCurrency(cliente.total_gastado) },
              { label: 'Órdenes',        value: cliente.total_ordenes.toString()       },
              { label: 'Puntos',         value: cliente.puntos_acumulados.toLocaleString() },
            ].map(s => (
              <div key={s.label} className="bg-white/15 backdrop-blur rounded-xl px-4 py-2.5 text-center">
                <p className="text-white/60 text-xs">{s.label}</p>
                <p className="text-white font-bold text-base">{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Info rápida */}
        <div className="px-6 py-3 border-b border-slate-100 flex flex-wrap gap-4 text-sm text-slate-500">
          {cliente.ciudad      && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" />{cliente.ciudad}</span>}
          {cliente.ultima_visita && <span className="flex items-center gap-1.5"><ShoppingBag className="w-3.5 h-3.5 text-slate-400" />Última visita: {formatDateShort(cliente.ultima_visita)}</span>}
          {cliente.canal_adquisicion && <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-slate-400" />Vía: {cliente.canal_adquisicion}</span>}
          {cliente.notas && <span className="flex items-center gap-1.5 italic text-slate-400">"{cliente.notas}"</span>}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6 shrink-0">
          {([
            { id: 'ordenes', label: 'Historial de órdenes', icon: <ShoppingBag className="w-4 h-4" /> },
            { id: 'puntos',  label: 'Puntos',               icon: <Gift         className="w-4 h-4" /> },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="overflow-y-auto flex-1">
          {loadingTab ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-6 h-6 animate-spin text-teal-500" />
            </div>
          ) : tab === 'ordenes' ? (
            <div>
              {ordenes.length === 0 ? (
                <EmptyState message="Sin órdenes" description="Este cliente aún no tiene órdenes registradas" />
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {['# Orden', 'Fecha', 'Items', 'Total', 'Estado', ''].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {ordenes.map(o => (
                      <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3.5">
                          <span className="font-mono text-sm font-bold text-teal-600">{o.numero_orden}</span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-500">{formatDateTime(o.fecha_apertura)}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">{o.detalles?.length ?? '—'} items</td>
                        <td className="px-5 py-3.5 text-sm font-bold text-slate-800">{formatCurrency(o.total)}</td>
                        <td className="px-5 py-3.5">
                          {o.estado && (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                              {o.estado.nombre}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => verOrden(o.id)}
                            disabled={loadingOrden}
                            className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors disabled:opacity-40"
                            title="Ver detalle del pedido"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {metaOrdenes?.totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                  <span className="text-xs text-slate-500">{metaOrdenes.total} órdenes</span>
                  <div className="flex gap-1">
                    <button disabled={pageO === 1} onClick={() => setPageO(p => p - 1)} className="p-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="px-3 py-1.5 text-xs text-slate-600">{pageO}/{metaOrdenes.totalPages}</span>
                    <button disabled={pageO === metaOrdenes.totalPages} onClick={() => setPageO(p => p + 1)} className="p-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Canjear puntos */}
              <div className="m-5 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-violet-800 flex items-center gap-1.5">
                      <Award className="w-4 h-4" /> Canjear puntos
                    </p>
                    <p className="text-xs text-violet-600 mt-0.5">
                      Saldo disponible: <span className="font-bold">{cliente.puntos_acumulados.toLocaleString()} pts</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={puntosACanjear}
                      onChange={e => setPuntosACanjear(e.target.value)}
                      placeholder="Pts"
                      min="1"
                      max={cliente.puntos_acumulados}
                      className="w-24 px-3 py-2 border border-violet-300 rounded-xl text-sm text-center outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                    />
                    <button
                      onClick={handleCanjear}
                      disabled={canjeando || !puntosACanjear}
                      className="px-4 py-2 bg-violet-600 text-white text-sm rounded-xl font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {canjeando ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Minus className="w-3.5 h-3.5" />}
                      Canjear
                    </button>
                  </div>
                </div>
              </div>

              {/* Historial */}
              {puntos.length === 0 ? (
                <EmptyState message="Sin movimientos" description="No hay transacciones de puntos registradas" />
              ) : (
                <div className="divide-y divide-slate-50">
                  {puntos.map(p => {
                    const cfg = TIPO_PUNTO_CFG[p.tipo] || TIPO_PUNTO_CFG.ajuste;
                    return (
                      <div key={p.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold
                            ${p.puntos > 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                            {p.puntos > 0 ? <Plus className="w-4 h-4 text-emerald-600" /> : <Minus className="w-4 h-4 text-red-500" />}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-700">{p.descripcion}</p>
                            <p className="text-xs text-slate-400">{formatDateTime(p.fecha)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${cfg.cls}`}>
                            {cfg.sign}{Math.abs(p.puntos).toLocaleString()} pts
                          </p>
                          <p className="text-xs text-slate-400">Saldo: {p.saldo_despues.toLocaleString()}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {metaPuntos?.totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                  <span className="text-xs text-slate-500">{metaPuntos.total} movimientos</span>
                  <div className="flex gap-1">
                    <button disabled={pageP === 1} onClick={() => setPageP(p => p - 1)} className="p-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="px-3 py-1.5 text-xs text-slate-600">{pageP}/{metaPuntos.totalPages}</span>
                    <button disabled={pageP === metaPuntos.totalPages} onClick={() => setPageP(p => p + 1)} className="p-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* ── Mini-modal detalle de orden ── */}
    {ordenDetalle && (
      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: Z_INDEX.MODAL_NESTED }}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOrdenDetalle(null)} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-4 flex items-center justify-between shrink-0">
            <div>
              <p className="text-teal-100 text-xs font-medium">Detalle del pedido</p>
              <h3 className="text-white font-bold text-base">{ordenDetalle.numero_orden}</h3>
            </div>
            <button onClick={() => setOrdenDetalle(null)} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/20 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Info general */}
          <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-4 text-xs text-slate-500 shrink-0">
            <span>{formatDateTime(ordenDetalle.fecha_apertura)}</span>
            <span className="capitalize">{ordenDetalle.tipo_orden}</span>
            {ordenDetalle.estado && (
              <span className="font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{ordenDetalle.estado?.nombre}</span>
            )}
            {ordenDetalle.direccion_entrega && (
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ordenDetalle.direccion_entrega}</span>
            )}
          </div>

          {/* Items */}
          <div className="overflow-y-auto flex-1 p-5 space-y-2">
            {ordenDetalle.detalles?.length > 0 ? (
              ordenDetalle.detalles.map((d: any) => (
                <div key={d.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-teal-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{d.producto?.nombre ?? 'Producto'}</p>
                    {d.notas && <p className="text-xs text-slate-400 italic truncate">{d.notas}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-500">{d.cantidad} × {formatCurrency(d.precio_unitario)}</p>
                    <p className="text-sm font-bold text-slate-800">{formatCurrency(d.cantidad * d.precio_unitario)}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 text-center py-6">Sin items registrados</p>
            )}
          </div>

          {/* Totales */}
          <div className="border-t border-slate-100 px-5 py-3 shrink-0 space-y-1">
            {ordenDetalle.costo_domicilio > 0 && (
              <div className="flex justify-between text-xs text-slate-500">
                <span>Domicilio</span><span>{formatCurrency(ordenDetalle.costo_domicilio)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-slate-800">
              <span>Total</span><span>{formatCurrency(ordenDetalle.total)}</span>
            </div>
            {ordenDetalle.pagos?.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                {ordenDetalle.pagos.map((p: any) => (
                  <div key={p.id} className="flex justify-between text-xs text-slate-500">
                    <span>{p.metodo_pago?.nombre ?? 'Pago'}</span>
                    <span>{formatCurrency(p.monto)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
};

// ─── Página principal ─────────────────────────────────────────────────────────

export const Clientes: React.FC = () => {
  const [clientes, setClientes]   = useState<Cliente[]>([]);
  const [loading, setLoading]     = useState(true);
  const [meta, setMeta]           = useState<any>(null);
  const [stats, setStats]         = useState<any>(null);
  const [page, setPage]           = useState(1);

  // Filtros
  const [search, setSearch]           = useState('');
  const [filtroTipo, setFiltroTipo]   = useState('');
  const [filtroEstado, setFiltroEstado] = useState('activo');
  const [showFiltros, setShowFiltros] = useState(false);

  // Modales
  const [formOpen, setFormOpen]       = useState(false);
  const [editCliente, setEditCliente] = useState<Cliente | null>(null);
  const [detalle, setDetalle]         = useState<Cliente | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<Cliente | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await clienteService.listar({
        page, limit: 20,
        search:       search       || undefined,
        tipo_cliente: filtroTipo   || undefined,
        estado:       filtroEstado || undefined,
      });
      setClientes(res.data || []);
      setMeta(res.meta);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, search, filtroTipo, filtroEstado]);

  const loadStats = useCallback(async () => {
    try {
      const res = await clienteService.estadisticas();
      setStats(res.stats);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const handleToggleEstado = async (c: Cliente) => {
    try {
      const nuevoEstado = c.estado === 'activo' ? 'inactivo' : 'activo';
      await clienteService.cambiarEstado(c.id, nuevoEstado);
      toast.success(nuevoEstado === 'activo' ? 'Cliente activado' : 'Cliente desactivado');
      loadData();
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    }
  };

  const openEdit = (c: Cliente) => { setEditCliente(c); setFormOpen(true); setDetalle(null); };
  const openCreate = () => { setEditCliente(null); setFormOpen(true); };

  if (loading && clientes.length === 0) return <LoadingScreen message="Cargando clientes..." />;

  return (
    <div className="space-y-6">

      {/* Encabezado. El fondo y el ancho los pone el <main> del Layout. */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutro-800">Clientes</h1>
          <p className="text-neutro-500 text-sm mt-0.5">Gestión de clientes y fidelización</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 min-h-toque bg-brand-600 text-white rounded-xl font-semibold text-sm shadow-sm hover:bg-brand-700 transition-colors"
        >
          <UserPlus className="w-4 h-4" /> Nuevo cliente
        </button>
      </div>

      <div className="space-y-5">

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total clientes',  value: stats?.total      ?? meta?.total ?? '—', icon: <Users      className="w-5 h-5" />, color: 'from-teal-500 to-teal-600'    },
            { label: 'Activos',         value: stats?.activos    ?? '—',                icon: <User       className="w-5 h-5" />, color: 'from-emerald-500 to-emerald-600' },
            { label: 'Frecuentes',      value: stats?.por_tipo?.frecuente ?? '—',       icon: <TrendingUp className="w-5 h-5" />, color: 'from-blue-500 to-blue-600'    },
            { label: 'VIP',             value: stats?.por_tipo?.vip       ?? '—',       icon: <Crown      className="w-5 h-5" />, color: 'from-amber-500 to-amber-600'  },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-4">
              <div className={`bg-gradient-to-br ${s.color} p-3 rounded-xl shadow-lg shrink-0`}>
                <div className="text-white">{s.icon}</div>
              </div>
              <div>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="text-xl font-bold text-slate-800">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Top clientes */}
        {stats?.top_clientes?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" /> Top 5 clientes
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {stats.top_clientes.map((c: any, i: number) => (
                <div key={c.id} className={`shrink-0 flex flex-col items-center gap-2 px-5 py-4 rounded-xl border transition-colors cursor-pointer hover:shadow-md
                  ${i === 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarGradient(c.tipo_cliente)} flex items-center justify-center text-white font-bold text-sm`}>
                    {getInitials(c.nombre_completo)}
                  </div>
                  <p className="text-xs font-semibold text-slate-700 text-center max-w-[90px] truncate">{c.nombre_completo}</p>
                  <p className="text-xs font-bold text-teal-600">{formatCurrency(c.total_gastado)}</p>
                  <span className="text-xs text-slate-400">{c.total_ordenes} órdenes</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Búsqueda y filtros */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Buscar por nombre, email o teléfono..."
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-400"
              />
            </div>
            <button
              onClick={() => setShowFiltros(!showFiltros)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium transition-colors
                ${showFiltros ? 'border-teal-300 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              <Filter className="w-4 h-4" /> Filtros
            </button>
            <button onClick={() => { loadData(); loadStats(); }} className="p-2.5 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          {showFiltros && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <select
                value={filtroTipo}
                onChange={e => { setFiltroTipo(e.target.value); setPage(1); }}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-teal-500 outline-none"
              >
                <option value="">Todos los tipos</option>
                <option value="regular">Regular</option>
                <option value="frecuente">Frecuente</option>
                <option value="vip">VIP</option>
                <option value="corporativo">Corporativo</option>
                <option value="delivery">Delivery</option>
              </select>
              <select
                value={filtroEstado}
                onChange={e => { setFiltroEstado(e.target.value); setPage(1); }}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-teal-500 outline-none"
              >
                <option value="">Todos</option>
                <option value="activo">Activos</option>
                <option value="inactivo">Inactivos</option>
              </select>
            </div>
          )}
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                  {['Cliente', 'Contacto', 'Tipo', 'Órdenes', 'Total gastado', 'Puntos', 'Estado', ''].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clientes.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        message="No hay clientes"
                        description={search ? 'No se encontraron resultados para tu búsqueda' : 'Registra tu primer cliente con el botón de arriba'}
                      />
                    </td>
                  </tr>
                ) : clientes.map(c => {
                  const cfg = TIPO_CFG[c.tipo_cliente] || TIPO_CFG.regular;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Cliente */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getAvatarGradient(c.tipo_cliente)} flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                            {getInitials(c.nombre_completo)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{c.nombre_completo}</p>
                          </div>
                        </div>
                      </td>
                      {/* Contacto */}
                      <td className="px-5 py-4">
                        <div className="space-y-0.5">
                          {c.email    && <p className="text-xs text-slate-500 flex items-center gap-1"><Mail  className="w-3 h-3 text-slate-400" />{c.email}</p>}
                          {c.telefono && <p className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" />{c.telefono}</p>}
                          {!c.email && !c.telefono && <span className="text-xs text-slate-400">—</span>}
                        </div>
                      </td>
                      {/* Tipo */}
                      <td className="px-5 py-4">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 w-fit ${cfg.cls}`}>
                          {cfg.icon}{cfg.label}
                        </span>
                      </td>
                      {/* Órdenes */}
                      <td className="px-5 py-4">
                        <p className="text-sm font-bold text-slate-700">{c.total_ordenes}</p>
                        {c.ultima_visita && <p className="text-xs text-slate-400">{formatDateShort(c.ultima_visita)}</p>}
                      </td>
                      {/* Total */}
                      <td className="px-5 py-4">
                        <p className="text-sm font-bold text-teal-700">{formatCurrency(c.total_gastado)}</p>
                      </td>
                      {/* Puntos */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-violet-500" />
                          <span className="text-sm font-semibold text-violet-700">{c.puntos_acumulados.toLocaleString()}</span>
                        </div>
                      </td>
                      {/* Estado */}
                      <td className="px-5 py-4">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full
                          ${c.estado === 'activo'
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                          {c.estado === 'activo' ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      {/* Acciones */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setDetalle(c)} className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors" title="Ver detalle">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEdit(c)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title="Editar">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => c.estado === 'activo' ? setConfirmToggle(c) : handleToggleEstado(c)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title={c.estado === 'activo' ? 'Desactivar' : 'Activar'}>
                            {c.estado === 'activo'
                              ? <ToggleRight className="w-4 h-4 text-emerald-500" />
                              : <ToggleLeft  className="w-4 h-4 text-slate-400"   />}
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
              <p className="text-sm text-slate-500">
                <span className="font-semibold">{meta.total}</span> clientes
              </p>
              <div className="flex items-center gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="p-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1.5 text-xs text-slate-600 font-semibold">
                  {page} / {meta.totalPages}
                </span>
                <button disabled={page === meta.totalPages} onClick={() => setPage(p => p + 1)}
                  className="p-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modales */}
      {formOpen && (
        <ClienteFormModal
          cliente={editCliente}
          onClose={() => { setFormOpen(false); setEditCliente(null); }}
          onSaved={() => { loadData(); loadStats(); }}
        />
      )}
      {detalle && (
        <DetalleCliente
          cliente={detalle}
          onClose={() => setDetalle(null)}
          onEdit={() => openEdit(detalle)}
        />
      )}

      <ConfirmDialog
        open={confirmToggle !== null}
        title="Desactivar cliente"
        message={confirmToggle ? `¿Desactivar a "${confirmToggle.nombre_completo}"? No podrá usarse en nuevas órdenes hasta reactivarlo.` : ''}
        confirmText="Desactivar"
        confirmColor="warning"
        onConfirm={() => { if (confirmToggle) handleToggleEstado(confirmToggle); }}
        onClose={() => setConfirmToggle(null)}
      />
    </div>
  );
};
