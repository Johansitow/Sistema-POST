/**
 * Auditoría - Historial de acciones del sistema
 * Solo accesible para usuarios con permiso auditoria.ver (superadmin por defecto)
 *
 * Correcciones:
 * - Rutas de imports corregidas de ../ a ../../ (archivo está en pages/admin/)
 * - Removido import 'Search' no utilizado (fix warning 6133)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Shield, User, Calendar, Filter, ChevronDown, Eye, X } from 'lucide-react';
import { auditoriaService, AuditoriaEntry } from '../../services/servicios-gestion';
import { formatDateTime } from '../../utils';
import { EmptyState, LoadingScreen } from '../../components/common';

// Colores por módulo
const MODULO_COLOR: Record<string, string> = {
  auth:       'bg-blue-100 text-blue-700',
  inventario: 'bg-emerald-100 text-emerald-700',
  ventas:     'bg-violet-100 text-violet-700',
  ordenes:    'bg-violet-100 text-violet-700',
  admin:      'bg-red-100 text-red-700',
  usuarios:   'bg-orange-100 text-orange-700',
};

const getModuloColor = (modulo: string) =>
  MODULO_COLOR[modulo.toLowerCase()] || 'bg-slate-100 text-slate-600';

// Modal detalle de un registro de auditoría
const DetalleAuditoria: React.FC<{ entry: AuditoriaEntry; onClose: () => void }> = ({ entry, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-xs">Registro de Auditoría</p>
          <h2 className="text-white font-bold">{entry.accion}</h2>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500 mb-1">Módulo</p><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getModuloColor(entry.modulo)}`}>{entry.modulo}</span></div>
          <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500 mb-1">Fecha</p><p className="text-sm font-semibold text-slate-700">{formatDateTime(entry.fecha_hora)}</p></div>
          {entry.tabla_afectada && <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500 mb-1">Tabla</p><code className="text-xs font-mono text-slate-700">{entry.tabla_afectada}</code></div>}
          {entry.id_registro_afectado && <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500 mb-1">ID Registro</p><p className="text-sm font-semibold text-slate-700">#{entry.id_registro_afectado}</p></div>}
          {entry.ip_address && <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500 mb-1">IP</p><code className="text-xs font-mono text-slate-700">{entry.ip_address}</code></div>}
          <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500 mb-1">Usuario</p><p className="text-sm font-semibold text-slate-700">{entry.usuario?.nombre_completo || `ID: ${entry.id_usuario || '—'}`}</p></div>
        </div>

        {(entry.datos_anteriores || entry.datos_nuevos) && (
          <div className="space-y-3">
            {entry.datos_anteriores && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Datos Anteriores</p>
                <pre className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-800 overflow-auto max-h-40 whitespace-pre-wrap">
                  {JSON.stringify(entry.datos_anteriores, null, 2)}
                </pre>
              </div>
            )}
            {entry.datos_nuevos && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Datos Nuevos</p>
                <pre className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-800 overflow-auto max-h-40 whitespace-pre-wrap">
                  {JSON.stringify(entry.datos_nuevos, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  </div>
);

export const Auditoria: React.FC = () => {
  const [registros, setRegistros]   = useState<AuditoriaEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showFiltros, setShowFiltros] = useState(false);
  const [detalle, setDetalle]       = useState<AuditoriaEntry | null>(null);
  const [meta, setMeta]             = useState<any>(null);
  const [page, setPage]             = useState(1);

  // Filtros
  const [modulo, setModulo]           = useState('');
  const [accion, setAccion]           = useState('');
  const [fechaDesde, setFechaDesde]   = useState('');
  const [fechaHasta, setFechaHasta]   = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditoriaService.getAll({
        page, limit: 30,
        modulo: modulo || undefined,
        accion: accion || undefined,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      });
      setRegistros(res.data); setMeta(res.meta);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, modulo, accion, fechaDesde, fechaHasta]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading && registros.length === 0) return <LoadingScreen message="Cargando auditoría..." />;

  return (
    <div className="space-y-6">
      {/* Encabezado. El fondo y el ancho los pone el <main> del Layout. */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-neutro-800 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutro-800">Auditoría</h1>
            <p className="text-neutro-500 text-sm">Historial de acciones del sistema</p>
          </div>
        </div>
        <button
          onClick={loadData}
          aria-label="Recargar registros de auditoría"
          className="p-2.5 min-h-toque min-w-toque border border-neutro-200 rounded-xl text-neutro-500 hover:bg-neutro-50 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-5">

        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">
              {meta ? <>{meta.total} registros encontrados</> : 'Filtros'}
            </span>
            <button onClick={() => setShowFiltros(!showFiltros)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-medium transition-colors ${showFiltros ? 'border-slate-400 bg-slate-100 text-slate-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <Filter className="w-4 h-4" /> Filtros <ChevronDown className={`w-4 h-4 transition-transform ${showFiltros ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {showFiltros && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
              <input value={modulo} onChange={e => { setModulo(e.target.value); setPage(1); }}
                placeholder="Módulo (ej: inventario)"
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-400 outline-none" />
              <input value={accion} onChange={e => { setAccion(e.target.value); setPage(1); }}
                placeholder="Acción (ej: CREAR)"
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-400 outline-none" />
              <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-400 outline-none" />
              <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-400 outline-none" />
            </div>
          )}
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                  {['Fecha', 'Usuario', 'Acción', 'Módulo', 'Tabla', 'ID', 'IP', ''].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registros.length === 0 ? (
                  <tr><td colSpan={8}><EmptyState message="Sin registros de auditoría" description="Las acciones del sistema aparecerán aquí" /></td></tr>
                ) : registros.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDateTime(r.fecha_hora)}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-3 h-3 text-slate-500" />
                        </div>
                        <span className="text-sm text-slate-700 font-medium">
                          {r.usuario?.usuario || (r.id_usuario ? `ID:${r.id_usuario}` : 'Sistema')}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <code className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{r.accion}</code>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getModuloColor(r.modulo)}`}>{r.modulo}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {r.tabla_afectada
                        ? <code className="text-xs font-mono text-slate-500">{r.tabla_afectada}</code>
                        : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {r.id_registro_afectado
                        ? <span className="text-xs font-mono text-slate-500">#{r.id_registro_afectado}</span>
                        : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <code className="text-xs font-mono text-slate-400">{r.ip_address || '—'}</code>
                    </td>
                    <td className="px-5 py-3.5">
                      {(r.datos_anteriores || r.datos_nuevos) && (
                        <button onClick={() => setDetalle(r)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <p className="text-sm text-slate-500"><span className="font-semibold">{meta.total}</span> registros · página {page} de {meta.totalPages}</p>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition-colors">Anterior</button>
                <button disabled={page === meta.totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition-colors">Siguiente</button>
              </div>
            </div>
          )}
        </div>
      </div>
      {detalle && <DetalleAuditoria entry={detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
};
