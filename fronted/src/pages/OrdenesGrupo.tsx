/**
 * OrdenesGrupo — Gestión de grupos de órdenes multi-restaurante
 *
 * Muestra el listado de OrdenGrupo con sus órdenes hijas y pagos.
 * Permite ver el recibo consolidado y cancelar grupos abiertos.
 */

import { useState, useEffect, useCallback } from 'react';
import { X, RefreshCw, ChevronDown, ChevronRight, Receipt, Printer, Plus, CreditCard, Trash2 } from 'lucide-react';
import {
  ordenGrupoService,
  type OrdenGrupoResumen,
  type OrdenGrupoRecibo,
  type CrearOrdenGrupoDto,
} from '../services/orden-grupo.service';
import { formatCurrency, formatDateTime } from '../utils';
import { toast } from '../store/uiStore';
import { LoadingScreen, EmptyState } from '../components/common';
import { metodoPagoService, type MetodoPagoFrontend, estadoOrdenService, type EstadoOrdenFull } from '../services/servicios-gestion';
import { useRestauranteStore } from '../store/restauranteStore';
import { useAuthStore } from '../store/useStore';
import api from '../services/api';

// ── Helpers ─────────────────────────────────────────────────────────────────

const ESTADO_STYLE: Record<string, string> = {
  abierto:    'bg-blue-100 text-blue-700 border border-blue-200',
  completado: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  cancelado:  'bg-red-100 text-red-700 border border-red-200',
};

// ── Modal Pago ────────────────────────────────────────────────────────────────

function ModalPago({ grupo, onClose, onPagado }: {
  grupo:    OrdenGrupoResumen;
  onClose:  () => void;
  onPagado: () => void;
}) {
  const [metodos, setMetodos]   = useState<MetodoPagoFrontend[]>([]);
  const [idMetodo, setIdMetodo] = useState<number | ''>('');
  const [monto, setMonto]       = useState('');
  const [referencia, setRef]    = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    metodoPagoService.getAll().then(setMetodos).catch(() => {});
  }, []);

  const metodoSel = metodos.find(m => m.id === idMetodo);

  const handleGuardar = async () => {
    const montoNum = parseFloat(monto);
    if (!idMetodo || !monto || isNaN(montoNum) || montoNum <= 0) {
      setError('Selecciona un método y un monto válido'); return;
    }
    setSaving(true); setError('');
    try {
      await ordenGrupoService.registrarPago(grupo.id, {
        id_metodo_pago: idMetodo as number,
        monto:          montoNum,
        referencia:     referencia.trim() || undefined,
      });
      toast.success('Pago registrado');
      onPagado();
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al registrar pago');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-800">
              Registrar pago — {grupo.numero_grupo}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Método de pago *</label>
            <select
              value={idMetodo}
              onChange={e => setIdMetodo(e.target.value ? Number(e.target.value) : '')}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="">Seleccionar…</option>
              {metodos.map(m => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Monto *</label>
            <input
              type="number" min="0" step="0.01"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="0.00"
            />
          </div>

          {metodoSel?.requiere_referencia && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Referencia / Número de transacción</label>
              <input
                type="text"
                value={referencia}
                onChange={e => setRef(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="Ej: TXN-123456"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-slate-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            {saving ? 'Guardando…' : 'Registrar pago'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Recibo ─────────────────────────────────────────────────────────────

function ModalRecibo({ id, numeroGrupo, onClose }: { id: number; numeroGrupo?: string; onClose: () => void }) {
  const [recibo, setRecibo]   = useState<OrdenGrupoRecibo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  function handlePrint() {
    if (!recibo) return;
    const win = window.open('', '_blank', 'width=400,height=700');
    if (!win) return;

    const ordenesHtml = recibo.ordenes.map(orden => `
      <div style="margin-bottom:12px; border-bottom:1px dashed #ccc; padding-bottom:8px;">
        <div style="display:flex; justify-content:space-between; font-weight:bold; margin-bottom:4px;">
          <span>${orden.numero_orden}</span>
          ${orden.restaurante ? `<span style="font-size:11px; font-weight:normal;">${orden.restaurante}</span>` : ''}
        </div>
        <table style="width:100%; font-size:12px; border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid #ccc;">
              <th style="text-align:left; padding:2px 0;">Producto</th>
              <th style="text-align:center; padding:2px 4px;">Cant.</th>
              <th style="text-align:right; padding:2px 0;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${orden.detalles.map(d => `
              <tr>
                <td style="padding:2px 0;">${d.nombre}</td>
                <td style="text-align:center; padding:2px 4px;">${d.cantidad}</td>
                <td style="text-align:right; padding:2px 0;">${formatCurrency(d.total)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr><td colspan="2" style="text-align:right; font-size:11px; color:#666;">Subtotal</td><td style="text-align:right;">${formatCurrency(orden.subtotal)}</td></tr>
            <tr><td colspan="2" style="text-align:right; font-size:11px; color:#666;">IVA</td><td style="text-align:right;">${formatCurrency(orden.impuestos)}</td></tr>
            <tr style="font-weight:bold;"><td colspan="2" style="text-align:right;">Total</td><td style="text-align:right;">${formatCurrency(orden.total)}</td></tr>
          </tfoot>
        </table>
      </div>
    `).join('');

    const pagosHtml = recibo.pagos.length > 0 ? `
      <div style="margin-top:8px;">
        <p style="font-size:11px; font-weight:bold; text-transform:uppercase; color:#666; margin-bottom:4px;">Pagos registrados</p>
        ${recibo.pagos.map(p => `
          <div style="display:flex; justify-content:space-between; font-size:12px;">
            <span>${p.metodo}${p.referencia ? ` — Ref: ${p.referencia}` : ''}</span>
            <span>${formatCurrency(p.monto)}</span>
          </div>
        `).join('')}
      </div>
    ` : '';

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Recibo ${numeroGrupo ?? `#${id}`}</title>
        <style>
          body { font-family: monospace; font-size: 13px; padding: 16px; max-width: 360px; margin: 0 auto; }
          h1 { font-size: 15px; text-align: center; margin-bottom: 4px; }
          p.sub { text-align: center; font-size: 11px; color: #666; margin: 0 0 12px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>Recibo consolidado</h1>
        <p class="sub">${numeroGrupo ?? `Grupo #${id}`}</p>
        ${ordenesHtml}
        <div style="border-top:2px solid #000; padding-top:8px; font-size:13px;">
          <div style="display:flex; justify-content:space-between; color:#666;"><span>Subtotal</span><span>${formatCurrency(recibo.resumen.subtotal)}</span></div>
          <div style="display:flex; justify-content:space-between; color:#666;"><span>IVA</span><span>${formatCurrency(recibo.resumen.impuestos)}</span></div>
          <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:15px; margin-top:4px;"><span>TOTAL</span><span>${formatCurrency(recibo.resumen.total)}</span></div>
          <div style="display:flex; justify-content:space-between; color:#16a34a;"><span>Pagado</span><span>${formatCurrency(recibo.resumen.total_pagado)}</span></div>
          ${recibo.resumen.pendiente > 0 ? `<div style="display:flex; justify-content:space-between; color:#dc2626; font-weight:bold;"><span>Pendiente</span><span>${formatCurrency(recibo.resumen.pendiente)}</span></div>` : ''}
        </div>
        ${pagosHtml}
        <script>window.onload = () => { window.print(); }<\/script>
      </body>
      </html>
    `);
    win.document.close();
  }

  useEffect(() => {
    ordenGrupoService.recibo(id)
      .then(setRecibo)
      .catch(e => setError(e.message ?? 'Error al cargar recibo'))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-800">
              Recibo consolidado — {numeroGrupo ?? `#${id}`}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && <LoadingScreen message="Cargando recibo..." />}
          {error   && <p className="text-red-500 text-sm">{error}</p>}
          {recibo  && (
            <div className="space-y-6">
              {/* Órdenes */}
              {recibo.ordenes.map(orden => (
                <div key={orden.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-medium text-slate-800">{orden.numero_orden}</span>
                    {orden.restaurante && (
                      <span className="text-xs text-slate-500">{orden.restaurante}</span>
                    )}
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500 uppercase border-b">
                        <th className="text-left pb-1">Producto</th>
                        <th className="text-center pb-1">Cant.</th>
                        <th className="text-right pb-1">Precio</th>
                        <th className="text-right pb-1">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orden.detalles.map((d, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-1 text-slate-700">{d.nombre}</td>
                          <td className="py-1 text-center text-slate-500">{d.cantidad}</td>
                          <td className="py-1 text-right text-slate-500">{formatCurrency(d.precio_unitario)}</td>
                          <td className="py-1 text-right font-medium">{formatCurrency(d.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} className="pt-2 text-right text-slate-500 text-xs">Subtotal</td>
                        <td className="pt-2 text-right">{formatCurrency(orden.subtotal)}</td>
                      </tr>
                      <tr>
                        <td colSpan={3} className="text-right text-slate-500 text-xs">IVA</td>
                        <td className="text-right">{formatCurrency(orden.impuestos)}</td>
                      </tr>
                      <tr className="font-semibold">
                        <td colSpan={3} className="text-right">Total orden</td>
                        <td className="text-right">{formatCurrency(orden.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ))}

              {/* Resumen total */}
              <div className="border-t pt-4 space-y-1 text-sm">
                <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{formatCurrency(recibo.resumen.subtotal)}</span></div>
                <div className="flex justify-between text-slate-600"><span>IVA</span><span>{formatCurrency(recibo.resumen.impuestos)}</span></div>
                <div className="flex justify-between font-bold text-slate-800 text-base border-t pt-2">
                  <span>Total</span><span>{formatCurrency(recibo.resumen.total)}</span>
                </div>
                <div className="flex justify-between text-emerald-600"><span>Pagado</span><span>{formatCurrency(recibo.resumen.total_pagado)}</span></div>
                {recibo.resumen.pendiente > 0 && (
                  <div className="flex justify-between text-red-600 font-medium">
                    <span>Pendiente</span><span>{formatCurrency(recibo.resumen.pendiente)}</span>
                  </div>
                )}
              </div>

              {/* Pagos */}
              {recibo.pagos.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Pagos registrados</p>
                  <div className="space-y-1">
                    {recibo.pagos.map((p, i) => (
                      <div key={i} className="flex justify-between text-sm text-slate-700">
                        <span>{p.metodo}{p.referencia ? ` — Ref: ${p.referencia}` : ''}</span>
                        <span>{formatCurrency(p.monto)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-slate-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={handlePrint}
            disabled={!recibo}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Nueva Orden de Grupo ────────────────────────────────────────────────

interface ProductoBasico { id: number; nombre: string; precio_unitario: number; }

function ModalNuevaOrden({ onClose, onCreado }: { onClose: () => void; onCreado: () => void }) {
  const { restaurantes } = useRestauranteStore();
  const { user }         = useAuthStore();

  // Obtener id_grupo del restaurante activo (tomamos el del primer restaurante del usuario)
  const idGrupo = user?.restaurantes[0]?.id_grupo ?? 0;

  const [estados, setEstados]   = useState<EstadoOrdenFull[]>([]);
  const [idEstado, setIdEstado] = useState<number | ''>('');
  const [tipoOrden, setTipo]    = useState<'local' | 'domicilio'>('local');
  const [notas, setNotas]       = useState('');
  // Restaurantes seleccionados con sus ítems
  const [sedes, setSedes] = useState<{
    id_restaurante: number;
    nombre: string;
    productos: ProductoBasico[];
    items: { id_producto: number; nombre: string; cantidad: number; precio_unitario: number }[];
  }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    estadoOrdenService.getAll().then((es: EstadoOrdenFull[]) => {
      setEstados(es.filter((e: EstadoOrdenFull) => e.es_inicial));
      const inicial = es.find((e: EstadoOrdenFull) => e.es_inicial);
      if (inicial) setIdEstado(inicial.id);
    }).catch(() => {});
  }, []);

  const agregarSede = (id_restaurante: number, nombre: string) => {
    if (sedes.find(s => s.id_restaurante === id_restaurante)) return;
    // Cargar productos del restaurante
    api.get('/productos', { params: { limit: 200 }, headers: { 'X-Restaurante-Id': id_restaurante } })
      .then(r => {
        const prods: ProductoBasico[] = (r.data.data ?? []).map((p: any) => ({
          id: p.id, nombre: p.nombre, precio_unitario: Number(p.precio_unitario ?? p.precio_venta ?? 0),
        }));
        setSedes(prev => [...prev, { id_restaurante, nombre, productos: prods, items: [] }]);
      })
      .catch(() => setSedes(prev => [...prev, { id_restaurante, nombre, productos: [], items: [] }]));
  };

  const quitarSede = (id: number) =>
    setSedes(prev => prev.filter(s => s.id_restaurante !== id));

  const agregarItem = (idSede: number, prod: ProductoBasico) => {
    setSedes(prev => prev.map(s => {
      if (s.id_restaurante !== idSede) return s;
      const existe = s.items.find(i => i.id_producto === prod.id);
      if (existe) return { ...s, items: s.items.map(i => i.id_producto === prod.id ? { ...i, cantidad: i.cantidad + 1 } : i) };
      return { ...s, items: [...s.items, { id_producto: prod.id, nombre: prod.nombre, cantidad: 1, precio_unitario: prod.precio_unitario }] };
    }));
  };

  const cambiarCantidad = (idSede: number, idProd: number, val: number) =>
    setSedes(prev => prev.map(s =>
      s.id_restaurante !== idSede ? s : {
        ...s, items: val <= 0
          ? s.items.filter(i => i.id_producto !== idProd)
          : s.items.map(i => i.id_producto === idProd ? { ...i, cantidad: val } : i),
      }
    ));

  const handleCrear = async () => {
    if (!idEstado) { setError('Selecciona un estado inicial'); return; }
    const sedesConItems = sedes.filter(s => s.items.length > 0);
    if (sedesConItems.length < 1) { setError('Agrega al menos un ítem en una sede'); return; }
    setSaving(true); setError('');
    try {
      const dto: CrearOrdenGrupoDto = {
        id_grupo:    idGrupo,
        id_estado:   idEstado as number,
        tipo_orden:  tipoOrden,
        notas:       notas.trim() || undefined,
        restaurantes: sedesConItems.map(s => ({
          id_restaurante: s.id_restaurante,
          items: s.items.map(i => ({
            id_producto: i.id_producto, cantidad: i.cantidad, precio_unitario: i.precio_unitario,
          })),
        })),
      };
      await ordenGrupoService.crearConOrdenes(dto);
      toast.success('Grupo de órdenes creado');
      onCreado();
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al crear grupo de órdenes');
    } finally {
      setSaving(false);
    }
  };

  // Restaurantes que el usuario puede agregar (de su lista de restaurantes asignados)
  const restaurantesDisponibles = restaurantes.filter(
    r => !sedes.find(s => s.id_restaurante === r.id)
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-800">Nueva orden multi-restaurante</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && <p className="text-red-500 text-sm">{error}</p>}

          {/* Tipo y estado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de orden</label>
              <select
                value={tipoOrden}
                onChange={e => setTipo(e.target.value as 'local' | 'domicilio')}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="local">Local (mesa)</option>
                <option value="domicilio">Domicilio</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Estado inicial</label>
              <select
                value={idEstado}
                onChange={e => setIdEstado(e.target.value ? Number(e.target.value) : '')}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="">Seleccionar…</option>
                {estados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas (opcional)</label>
            <input
              type="text" value={notas} onChange={e => setNotas(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="Observaciones generales del grupo"
            />
          </div>

          {/* Agregar sede */}
          {restaurantesDisponibles.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Agregar restaurante</label>
              <div className="flex gap-2 flex-wrap">
                {restaurantesDisponibles.map(r => (
                  <button
                    key={r.id}
                    onClick={() => agregarSede(r.id, r.nombre)}
                    className="px-3 py-1 text-xs border rounded-full hover:bg-slate-100 transition-colors"
                  >
                    + {r.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sedes con ítems */}
          {sedes.map(sede => (
            <div key={sede.id_restaurante} className="border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700 text-sm">{sede.nombre}</span>
                <button onClick={() => quitarSede(sede.id_restaurante)}
                  className="p-1 hover:bg-red-50 hover:text-red-500 rounded text-slate-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Selector de producto */}
              <select
                defaultValue=""
                onChange={e => {
                  const prod = sede.productos.find(p => p.id === Number(e.target.value));
                  if (prod) { agregarItem(sede.id_restaurante, prod); e.target.value = ''; }
                }}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="">Agregar producto…</option>
                {sede.productos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre} — {formatCurrency(p.precio_unitario)}</option>
                ))}
              </select>

              {/* Ítems */}
              {sede.items.length > 0 && (
                <div className="space-y-1">
                  {sede.items.map(item => (
                    <div key={item.id_producto} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 flex-1">{item.nombre}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number" min="1" value={item.cantidad}
                          onChange={e => cambiarCantidad(sede.id_restaurante, item.id_producto, parseInt(e.target.value) || 0)}
                          className="w-16 border rounded px-2 py-1 text-center text-sm"
                        />
                        <span className="text-slate-500 w-20 text-right">{formatCurrency(item.precio_unitario * item.cantidad)}</span>
                        <button onClick={() => cambiarCantidad(sede.id_restaurante, item.id_producto, 0)}
                          className="text-slate-300 hover:text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="text-right text-sm font-semibold text-slate-700 pt-1 border-t">
                    {formatCurrency(sede.items.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {sedes.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-4">
              Agrega al menos un restaurante para comenzar.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-slate-50 rounded-b-xl">
          <span className="text-sm font-semibold text-slate-700">
            Total: {formatCurrency(
              sedes.flatMap(s => s.items).reduce((acc, i) => acc + i.precio_unitario * i.cantidad, 0)
            )}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleCrear}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              {saving ? 'Creando…' : 'Crear grupo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Fila del listado ─────────────────────────────────────────────────────────

function FilaGrupo({
  grupo,
  onVerRecibo,
  onPagar,
  onCancelar,
}: {
  grupo: OrdenGrupoResumen;
  onVerRecibo: (id: number, numeroGrupo: string) => void;
  onPagar:     (grupo: OrdenGrupoResumen) => void;
  onCancelar:  (id: number) => void;
}) {
  const [expandido, setExpandido] = useState(false);

  return (
    <>
      <tr
        className="hover:bg-slate-50 cursor-pointer"
        onClick={() => setExpandido(e => !e)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {expandido
              ? <ChevronDown  className="w-4 h-4 text-slate-400" />
              : <ChevronRight className="w-4 h-4 text-slate-400" />
            }
            <span className="font-medium text-slate-800">
              {grupo.numero_grupo ?? `#${grupo.id}`}
            </span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-slate-600">{formatDateTime(grupo.fecha_creacion)}</td>
        <td className="px-4 py-3">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_STYLE[grupo.estado] ?? 'bg-slate-100 text-slate-600'}`}>
            {grupo.estado}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-slate-600 text-center">
          {grupo.ordenes?.length ?? grupo._count?.ordenes ?? '—'}
        </td>
        <td className="px-4 py-3 text-sm font-medium text-slate-800 text-right">
          {formatCurrency(grupo.total_pagado)}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => onVerRecibo(grupo.id, grupo.numero_grupo)}
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
              title="Ver recibo"
            >
              <Receipt className="w-4 h-4" />
            </button>
            {grupo.estado === 'abierto' && (
              <>
                <button
                  onClick={() => onPagar(grupo)}
                  className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                  title="Registrar pago"
                >
                  <CreditCard className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onCancelar(grupo.id)}
                  className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                  title="Cancelar grupo"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>

      {/* Detalle expandido */}
      {expandido && (
        <tr>
          <td colSpan={6} className="px-6 pb-4 bg-slate-50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
              {grupo.ordenes?.map(o => (
                <div key={o.id} className="bg-white border rounded-lg p-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-slate-700">{o.numero_orden}</span>
                    {o.estado && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${o.estado.color}22`, color: o.estado.color }}>
                        {o.estado.nombre}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 mt-1">{formatCurrency(o.total)}</p>
                </div>
              ))}
              {grupo.pagos?.length > 0 && (
                <div className="sm:col-span-2 bg-white border rounded-lg p-3 text-sm">
                  <p className="font-medium text-slate-700 mb-2">Pagos</p>
                  {grupo.pagos.map(p => (
                    <div key={p.id} className="flex justify-between text-slate-600">
                      <span>{p.metodo_pago?.nombre ?? 'Pago'}</span>
                      <span>{formatCurrency(p.monto)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────

export function OrdenesGrupo() {
  const [grupos, setGrupos]       = useState<OrdenGrupoResumen[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [reciboSel, setReciboSel] = useState<{ id: number; numeroGrupo: string } | null>(null);
  const [pagoSel, setPagoSel]     = useState<OrdenGrupoResumen | null>(null);
  const [nuevaOrden, setNuevaOrden] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await ordenGrupoService.listar({ limit: 50 });
      setGrupos(result.data ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Error al cargar grupos de órdenes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleCancelar = async (id: number) => {
    if (!window.confirm(`¿Cancelar el grupo de órdenes #${id}?`)) return;
    try {
      await ordenGrupoService.cancelar(id);
      toast.success('Grupo cancelado');
      cargar();
    } catch (e: any) {
      toast.error(e.message ?? 'Error al cancelar');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Grupos de Órdenes</h1>
          <p className="text-sm text-slate-500 mt-1">Órdenes agrupadas multi-restaurante</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setNuevaOrden(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Nueva orden
          </button>
          <button
            onClick={cargar}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 border rounded-lg hover:bg-slate-50 text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
        </div>
      </div>

      {/* Contenido */}
      {loading && <LoadingScreen message="Cargando grupos..." />}
      {error   && <p className="text-red-500 text-sm">{error}</p>}

      {!loading && !error && grupos.length === 0 && (
        <EmptyState
          message="Aún no hay grupos de órdenes registrados."
        />
      )}

      {!loading && grupos.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Grupo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Estado</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Órdenes</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Total pagado</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grupos.map(g => (
                <FilaGrupo
                  key={g.id}
                  grupo={g}
                  onVerRecibo={(id, numeroGrupo) => setReciboSel({ id, numeroGrupo })}
                  onPagar={setPagoSel}
                  onCancelar={handleCancelar}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal recibo */}
      {reciboSel !== null && (
        <ModalRecibo
          id={reciboSel.id}
          numeroGrupo={reciboSel.numeroGrupo}
          onClose={() => setReciboSel(null)}
        />
      )}

      {/* Modal pago */}
      {pagoSel !== null && (
        <ModalPago
          grupo={pagoSel}
          onClose={() => setPagoSel(null)}
          onPagado={cargar}
        />
      )}

      {/* Modal nueva orden de grupo */}
      {nuevaOrden && (
        <ModalNuevaOrden
          onClose={() => setNuevaOrden(false)}
          onCreado={cargar}
        />
      )}
    </div>
  );
}

export default OrdenesGrupo;
