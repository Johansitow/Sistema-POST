/**
 * Órdenes - Gestión de pedidos
 *
 * Cambios respecto a la versión anterior:
 * 1. Estados cargados dinámicamente desde /api/estados-orden
 * 2. Transiciones válidas calculadas desde el estado actual de la orden
 * 3. Modal de pago al pasar a ENTREGADA — soporta múltiples métodos
 * 4. Métodos de pago cargados desde /api/metodos-pago
 *
 * Correcciones:
 * - findLastIndex reemplazado por implementación compatible ES2021 (fix error 2550 y 7006)
 * - TIPOS_ORDEN prefijado con _ para silenciar warning 6133
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus, Search, MapPin, Store, Clock, X, RefreshCw, Eye,
  Check, ShoppingCart, DollarSign, Package,
  ArrowRight, CreditCard, Banknote, Smartphone, ChevronRight,
  Trash2, PlusCircle, User, UserPlus, Printer,
} from 'lucide-react';
import { printComanda, printFactura, PrintOrden, type PrintTemplateConfig } from '../utils/print';
import { cargarConfigImpresion } from '../lib/plantillas/negocio';
import ModalHeader from '../components/common/ModalHeader';
import { Z_INDEX } from '../lib/zIndex';
import { plantillasService } from '../services/plantillas.service';
import { facturaService } from '../services/servicios-gestion';
import { ordenesService, Orden, OrdenCreateDTO, OrdenCreateV2DTO, OrdenSede, EstadoOrdenGlobal, PagoInput } from '../services/ordenes.service';
import { productosService, Producto } from '../services/productos.service';
import {
  estadoOrdenService, EstadoOrdenFull,
  metodoPagoService, MetodoPagoFrontend,
} from '../services/servicios-gestion';
import { formatCurrency, formatDateTime, TIPOS_ORDEN as _TIPOS_ORDEN } from '../utils';
import { configuracionService, cierreCajaService } from '../services/servicios-operacion';
import { useUIStore, toast }    from '../store/uiStore';
import { ConfirmDialog }        from '../components/common/ConfirmDialog';
import { useEscapeKey }         from '../hooks/useEscapeKey';
import { useAuthStore }         from '../store/useStore';
import { EmptyState, LoadingScreen, ErrorAlert, ClienteFormModal } from '../components/common';
import { clienteService } from '../services/cliente.service';
import { categoriasService, type Categoria } from '../services/categorias.service';
import { useRestauranteActivo, useRestauranteStore } from '../store/restauranteStore';
import { useFeatureFlag }                    from '../store/featureFlagStore';
import api                                   from '../services/api';
import { variantesService, type ProductoVariante } from '../services/variantes.service';
import { clasesEstado, definirEstado }        from '../theme/estados';

// ============================================================================
// HELPERS
// ============================================================================

// Los tres mapas de estado que vivían aquí (getEstadoConfig,
// getEstadoGlobalConfig y getEstadoSedeConfig) definían el MISMO vocabulario
// con tres formatos distintos, y otros cuatro archivos tenían copias propias.
// Ahora todos leen theme/estados.ts. Ver el comentario de cabecera de ese
// archivo para el inventario completo de lo que se consolidó.

/** Config visual por código de estado (insignia + punto de color). */
const getEstadoConfig = (codigo?: string) => {
  const { insignia, punto } = clasesEstado(codigo);
  return { cls: insignia, dot: punto };
};

/** Config visual para estado_global (nueva arquitectura). */
const getEstadoGlobalConfig = (eg?: EstadoOrdenGlobal) => {
  const { insignia } = clasesEstado(eg);
  // "Lista p/ cobro" es específico de esta pantalla: aquí el cajero necesita
  // saber que la orden espera pago, no solo que la cocina terminó.
  const label = eg === 'LISTA' ? 'Lista p/ cobro' : definirEstado(eg).label;
  return { cls: insignia, label };
};

const getEstadoSedeConfig = (est?: string) => ({
  dot:   clasesEstado(est).punto,
  label: definirEstado(est).label,
});

const METODO_ICONOS: Record<string, React.ReactNode> = {
  EFECTIVO:  <Banknote   className="w-4 h-4" />,
  DEBITO:    <CreditCard className="w-4 h-4" />,
  CREDITO:   <CreditCard className="w-4 h-4" />,
  NEQUI:     <Smartphone className="w-4 h-4" />,
  DAVIPLATA: <Smartphone className="w-4 h-4" />,
};

// ============================================================================
// MODAL PAGO — divide el total entre varios métodos
// ============================================================================
interface PagoLine {
  id_metodo_pago: number;
  monto: string;
  referencia: string;
}

/**
 * findLastIndexCompat — reemplaza Array.prototype.findLastIndex (ES2023)
 * para mantener compatibilidad con targets anteriores (fix error 2550 / 7006)
 */
const findLastIndexCompat = <T,>(arr: T[], predicate: (item: T) => boolean): number => {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i;
  }
  return -1;
};

const ModalPago: React.FC<{
  orden: Orden;
  metodos: MetodoPagoFrontend[];
  onConfirm: (pagos: { id_metodo_pago: number; monto: number; referencia?: string }[]) => Promise<void>;
  onClose: () => void;
}> = ({ orden, metodos, onConfirm, onClose }) => {
  useEscapeKey(onClose);
  const [lineas, setLineas] = useState<PagoLine[]>([
    { id_metodo_pago: metodos[0]?.id || 0, monto: orden.total.toString(), referencia: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const totalAsignado = lineas.reduce((s, l) => s + (parseFloat(l.monto) || 0), 0);
  const diferencia    = orden.total - totalAsignado;
  const completo      = Math.abs(diferencia) < 0.01;

  const addLinea = () =>
    setLineas(prev => [...prev, { id_metodo_pago: metodos[0]?.id || 0, monto: '', referencia: '' }]);

  const removeLinea = (i: number) =>
    setLineas(prev => prev.filter((_, idx) => idx !== i));

  const updateLinea = (i: number, field: keyof PagoLine, value: string) =>
    setLineas(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

  /** Distribuye el restante en la última línea vacía */
  const autocompletar = () => {
    const idx = findLastIndexCompat(lineas, (l: PagoLine) => !l.monto);
    if (idx === -1) return;
    const resto = (orden.total - lineas.reduce((s, l, i) => i === idx ? s : s + (parseFloat(l.monto) || 0), 0)).toFixed(0);
    updateLinea(idx, 'monto', resto);
  };

  const handleConfirm = async () => {
    if (!completo) { setError('El total de los pagos debe igualar el total de la orden'); return; }
    const invalidas = lineas.some(l => !l.id_metodo_pago || !(parseFloat(l.monto) > 0));
    if (invalidas) { setError('Todos los métodos deben tener un monto mayor a 0'); return; }
    setSaving(true);
    setError(null);
    try {
      await onConfirm(lineas.map(l => ({
        id_metodo_pago: Number(l.id_metodo_pago),
        monto: parseFloat(l.monto),
        referencia: l.referencia || undefined,
      })));
    } catch (e: any) {
      setError(e.message || 'Error al registrar pago');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: Z_INDEX.MODAL_NESTED }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">

        {/* Header */}
        <ModalHeader
          title={orden.numero_orden}
          subtitle="Registrar Pago"
          onClose={onClose}
          gradient="from-emerald-600 to-teal-600"
        />
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 pb-4">
          <div className="mt-1 bg-white/20 rounded-xl p-3 flex items-center justify-between">
            <span className="text-emerald-100 text-sm">Total a cobrar</span>
            <span className="text-white font-bold text-xl">{formatCurrency(orden.total)}</span>
          </div>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh]">
          {error && (
            <ErrorAlert message={error} />
          )}

          {/* Resumen */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Asignado</span>
            <span className={`font-bold ${completo ? 'text-emerald-600' : diferencia > 0 ? 'text-amber-600' : 'text-red-600'}`}>
              {formatCurrency(totalAsignado)}
              {!completo && <span className="ml-1 text-xs">({diferencia > 0 ? `falta ${formatCurrency(diferencia)}` : `excede ${formatCurrency(-diferencia)}`})</span>}
            </span>
          </div>

          {/* Líneas de pago */}
          <div className="space-y-3">
            {lineas.map((linea, i) => {
              const metodo = metodos.find(m => m.id === Number(linea.id_metodo_pago));
              return (
                <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Método {i + 1}</span>
                    {lineas.length > 1 && (
                      <button onClick={() => removeLinea(i)} className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Selector método */}
                  <div className="grid grid-cols-2 gap-2">
                    {metodos.filter(m => m.activo).map(m => (
                      <button key={m.id}
                        onClick={() => updateLinea(i, 'id_metodo_pago', m.id.toString())}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all ${Number(linea.id_metodo_pago) === m.id ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                        {METODO_ICONOS[m.codigo] || <CreditCard className="w-4 h-4" />}
                        {m.nombre}
                      </button>
                    ))}
                  </div>

                  {/* Monto */}
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">$</span>
                      <input
                        type="number" value={linea.monto}
                        onChange={e => updateLinea(i, 'monto', e.target.value)}
                        placeholder="0"
                        className="w-full pl-7 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
                      />
                    </div>
                    {/* Botón autocompletar con restante */}
                    {!linea.monto && diferencia > 0 && (
                      <button onClick={autocompletar}
                        className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap">
                        +{formatCurrency(diferencia)}
                      </button>
                    )}
                  </div>

                  {/* Referencia — solo si el método la requiere */}
                  {metodo?.requiere_referencia && (
                    <input
                      value={linea.referencia}
                      onChange={e => updateLinea(i, 'referencia', e.target.value)}
                      placeholder="Referencia / aprobación"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Agregar método */}
          {lineas.length < metodos.length && (
            <button onClick={addLinea}
              className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-sm font-semibold text-slate-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/50 transition-all">
              <PlusCircle className="w-4 h-4" /> Agregar otro método de pago
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 bg-slate-50">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={saving || !completo}
            className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Procesando...' : 'Confirmar Pago'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MODAL DETALLE
// ============================================================================
const DetalleModal: React.FC<{
  orden: Orden;
  estados: EstadoOrdenFull[];
  metodos: MetodoPagoFrontend[];
  onClose: () => void;
  onEstadoChange: () => void;
}> = ({ orden, estados, metodos, onClose, onEstadoChange }) => {
  const [changingEstado, setChangingEstado] = useState(false);
  const [showPago, setShowPago]             = useState(false);
  const [estadoPendiente, setEstadoPendiente] = useState<EstadoOrdenFull | null>(null);
  const [confirmCancelar, setConfirmCancelar] = useState<EstadoOrdenFull | null>(null);
  // ESC cierra el modal de pago si está abierto; si no, cierra el detalle de la orden
  useEscapeKey(onClose, !showPago);

  const estadoActual = estados.find(e => e.id === orden.id_estado);
  const esNuevaArq   = orden.sedes && orden.sedes.length > 0;
  const egCfg        = getEstadoGlobalConfig(orden.estado_global);

  // Nueva arquitectura: solo mostrar ENTREGADA (cobro) cuando estado_global === LISTA
  // y CANCELADA cuando no está entregada aún.
  // Legado: usar las transiciones reales del estado actual (estadoActual.transiciones_desde),
  // en vez de ofrecer ENTREGADA/CANCELADA sin importar el estado — el backend valida la
  // transición contra la tabla estadoTransicion y rechaza cualquier salto no permitido
  // (ej. En Preparación → Entregada, que debe pasar primero por Lista).
  const transicionesDisponibles = esNuevaArq
    ? [
        ...(orden.estado_global === 'LISTA'
          ? estados.filter(e => e.codigo === 'ENTREGADA')
          : []),
        ...(orden.estado_global !== 'ENTREGADA' && orden.estado_global !== 'CANCELADA'
          ? estados.filter(e => e.codigo === 'CANCELADA')
          : []),
      ]
    : (estadoActual?.transiciones_desde ?? []).map(t => t.estado_hacia);

  const handleCambiarEstado = async (estado: EstadoOrdenFull) => {
    // Si el estado destino es ENTREGADA, abrimos el modal de pago
    if (estado.codigo === 'ENTREGADA') {
      setEstadoPendiente(estado);
      setShowPago(true);
      return;
    }
    // Cancelar una orden es irreversible — pedir confirmación antes de ejecutar
    if (estado.codigo === 'CANCELADA') {
      setConfirmCancelar(estado);
      return;
    }
    setChangingEstado(true);
    try {
      await ordenesService.updateEstado(orden.id, estado.id);
      toast.success(`Orden marcada como "${estado.nombre}"`);
      onEstadoChange();
    } catch (e: any) {
      toast.error(e.message || 'Error al cambiar el estado de la orden');
    } finally {
      setChangingEstado(false);
    }
  };

  const handleConfirmarCancelacion = async () => {
    setChangingEstado(true);
    try {
      if (orden.sedes && orden.sedes.length > 0) {
        // Nueva arquitectura: cancelar la orden completa
        await ordenesService.cancelar(orden.id);
      } else if (confirmCancelar) {
        await ordenesService.updateEstado(orden.id, confirmCancelar.id);
      }
      toast.success('Orden cancelada');
      onEstadoChange();
    } catch (e: any) {
      toast.error(e.message || 'Error al cancelar la orden');
    } finally {
      setChangingEstado(false);
    }
  };

  const handleConfirmarPago = async (pagos: { id_metodo_pago: number; monto: number; referencia?: string }[]) => {
    // Nueva arquitectura: Orden con sedes → usar POST /ordenes/:id/pagar
    if (orden.sedes && orden.sedes.length > 0) {
      await ordenesService.pagar(orden.id, pagos as PagoInput[]);
    } else {
      // Legado: usar PATCH /ordenes/:id/estado con pagos
      if (!estadoPendiente) return;
      await ordenesService.updateEstado(orden.id, estadoPendiente.id, pagos as PagoInput[]);
    }
    setShowPago(false);
    toast.success('Pago registrado — orden entregada');
    onEstadoChange();
  };

  const buildPrintOrden = (): PrintOrden => ({
    numero_orden:      orden.numero_orden,
    tipo_orden:        orden.tipo_orden,
    fecha_apertura:    orden.fecha_apertura,
    nombre_contacto:   orden.nombre_contacto,
    telefono:          orden.telefono_contacto,
    direccion_entrega: orden.direccion_entrega,
    costo_domicilio:   orden.costo_domicilio,
    observaciones:     orden.observaciones,
    subtotal:          orden.subtotal,
    impuestos:         orden.impuestos,
    impuesto_tipo:     orden.impuesto_tipo,
    total:             orden.total,
    detalles: (orden.detalles ?? []).map((d: any) => ({
      nombre:          d.producto?.nombre ?? d.nombre ?? 'Producto',
      cantidad:        d.cantidad,
      precio_unitario: d.precio_unitario,
      notas:           d.notas,
    })),
  });

  const toTmpl = (p: any): PrintTemplateConfig | undefined => {
    if (!p?.plantilla) return undefined;
    const cfg = p.plantilla as any;
    return {
      paperWidth: cfg.config?.paperWidth,
      fontSize:   cfg.config?.fontSize,
      showLogo:   cfg.config?.showLogo,
      sections:   cfg.sections,
    };
  };

  const handlePrintComanda = async () => {
    const po   = buildPrintOrden();
    const [def, cfg] = await Promise.all([
      plantillasService.obtenerDefault('comanda').catch(() => null),
      cargarConfigImpresion(),
    ]);
    printComanda(po, toTmpl(def), cfg.copiasComanda);
  };

  const handlePrintFactura = async () => {
    const po = buildPrintOrden();
    const pagos = (orden.pagos ?? []).map((p: any) => ({
      metodo: p.metodo_pago?.nombre ?? 'Pago',
      monto:  p.monto,
    }));
    const [def, cfg, factura] = await Promise.all([
      plantillasService.obtenerDefault('ticket').catch(() => null),
      cargarConfigImpresion(),
      facturaService.getByOrden(orden.id).catch(() => null),
    ]);
    // Consecutivo real solo si la orden ya está facturada; si no, es una PRE-CUENTA
    // (sin número legal) para no fabricar un consecutivo.
    const tmpl: PrintTemplateConfig = { ...(toTmpl(def) ?? {}), footerText: cfg.pieTicket };
    printFactura(po, pagos, cfg.negocio, factura?.numero_factura, tmpl);
  };

  const cfg = getEstadoConfig(estadoActual?.codigo);

  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: Z_INDEX.MODAL_BASE }}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">

          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-indigo-200 text-xs font-medium">Detalle de Orden</p>
              <h2 className="text-white font-bold text-lg">{orden.numero_orden}</h2>
            </div>
            <div className="flex items-center gap-2">
              {esNuevaArq ? (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${egCfg.cls}`}>
                  {egCfg.label}
                </span>
              ) : (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/20 text-white">
                  {estadoActual?.nombre || '—'}
                </span>
              )}
              <button
                onClick={handlePrintComanda}
                title="Imprimir comanda (cocina)"
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
              >
                <Printer className="w-3.5 h-3.5" /> Comanda
              </button>
              <button
                onClick={handlePrintFactura}
                title="Imprimir factura/recibo"
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-emerald-500/80 hover:bg-emerald-500 text-white rounded-lg transition-colors"
              >
                <Printer className="w-3.5 h-3.5" /> Factura
              </button>
              <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/20 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 p-6 space-y-5">

            {/* Info básica */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Tipo</p>
                <div className="flex items-center gap-2">
                  {orden.tipo_orden === 'domicilio'
                    ? <MapPin className="w-4 h-4 text-blue-500" />
                    : <Store  className="w-4 h-4 text-emerald-500" />}
                  <span className="font-semibold text-slate-700 text-sm capitalize">{orden.tipo_orden}</span>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Fecha</p>
                <p className="font-semibold text-slate-700 text-sm">{formatDateTime(orden.fecha_apertura)}</p>
              </div>
            </div>

            {/* Datos entrega */}
            {orden.tipo_orden === 'domicilio' && (orden.nombre_contacto || orden.direccion_entrega) && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-1.5">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">Datos de Entrega</p>
                {orden.nombre_contacto   && <p className="text-sm text-slate-700"><span className="text-slate-500">Cliente: </span>{orden.nombre_contacto}</p>}
                {orden.telefono_contacto && <p className="text-sm text-slate-700"><span className="text-slate-500">Tel: </span>{orden.telefono_contacto}</p>}
                {orden.direccion_entrega && <p className="text-sm text-slate-700"><span className="text-slate-500">Dirección: </span>{orden.direccion_entrega}</p>}
              </div>
            )}

            {/* Sedes (nueva arquitectura) */}
            {esNuevaArq && orden.sedes && orden.sedes.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Sedes</p>
                <div className="space-y-3">
                  {orden.sedes.map((sede: OrdenSede) => {
                    const sc = getEstadoSedeConfig(sede.estado);
                    return (
                      <div key={sede.id} className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${sc.dot}`} />
                            <span className="text-sm font-semibold text-slate-700">
                              {sede.restaurante?.nombre || `Sede #${sede.id_restaurante}`}
                            </span>
                            <span className="text-xs text-slate-400">#{sede.sufijo}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">{sc.label}</span>
                            <span className="text-sm font-bold text-slate-700">{formatCurrency(sede.total)}</span>
                          </div>
                        </div>
                        <div className="px-4 py-2 space-y-1.5">
                          {sede.items.map(item => (
                            <div key={item.id} className="flex items-center justify-between text-sm">
                              <span className="text-slate-600">
                                {item.cantidad}× {item.producto?.nombre || `Producto #${item.id_producto}`}
                                {item.notas && <span className="text-slate-400 ml-1 text-xs">({item.notas})</span>}
                              </span>
                              <span className="text-slate-700 font-medium">{formatCurrency(item.total)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Productos (legado) */}
            {orden.detalles && orden.detalles.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Productos</p>
                <div className="space-y-2">
                  {orden.detalles.map(d => (
                    <div key={d.id} className="flex items-center justify-between py-2.5 px-3 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center">
                          <Package className="w-3.5 h-3.5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">{d.producto?.nombre || `Producto #${d.id_producto}`}</p>
                          <p className="text-xs text-slate-400">{d.cantidad} × {formatCurrency(d.precio_unitario)}</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-slate-700">{formatCurrency(d.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Totales */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm text-slate-600"><span>Subtotal</span><span>{formatCurrency(orden.subtotal)}</span></div>
              {orden.descuento > 0 && <div className="flex justify-between text-sm text-red-600"><span>Descuento</span><span>-{formatCurrency(orden.descuento)}</span></div>}
              {orden.impuestos > 0 && (
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Impuestos ({Math.round((orden.impuestos / (orden.subtotal - (orden.descuento ?? 0))) * 100)}%)</span>
                  <span>{formatCurrency(orden.impuestos)}</span>
                </div>
              )}
              {orden.propina > 0 && <div className="flex justify-between text-sm text-slate-600"><span>Propina</span><span>{formatCurrency(orden.propina)}</span></div>}
              {!!orden.costo_domicilio && orden.costo_domicilio > 0 && <div className="flex justify-between text-sm text-slate-600"><span>Domicilio</span><span>{formatCurrency(orden.costo_domicilio)}</span></div>}
              <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-800">
                <span>Total</span><span className="text-lg">{formatCurrency(orden.total)}</span>
              </div>
            </div>

            {/* Transiciones disponibles */}
            {!estadoActual?.es_final && transicionesDisponibles.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Cambiar Estado</p>
                <div className="grid grid-cols-2 gap-2">
                  {transicionesDisponibles.map(est => {
                    const c = getEstadoConfig(est.codigo);
                    const esEntrega = est.codigo === 'ENTREGADA';
                    return (
                      <button key={est.id}
                        onClick={() => handleCambiarEstado(est)}
                        disabled={changingEstado}
                        className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 ${esEntrega ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-sm' : `${c.cls} hover:opacity-80`}`}>
                        {changingEstado
                          ? <RefreshCw className="w-3 h-3 animate-spin" />
                          : esEntrega
                            ? <DollarSign className="w-3 h-3" />
                            : <div className={`w-2 h-2 rounded-full ${c.dot}`} />}
                        {est.nombre}
                        {esEntrega && <ChevronRight className="w-3 h-3" />}
                      </button>
                    );
                  })}
                </div>
                {transicionesDisponibles.some(e => e.codigo === 'ENTREGADA') && (
                  <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> Marcar como entregada abrirá la ventanilla de cobro
                  </p>
                )}
              </div>
            )}

            {estadoActual?.es_final && (
              <div className={`text-center py-3 rounded-xl text-sm font-semibold ${cfg.cls}`}>
                Orden {estadoActual.nombre.toLowerCase()} — estado final
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de pago — z-index mayor para superponerse al detalle */}
      {showPago && estadoPendiente && (
        <ModalPago
          orden={orden}
          metodos={metodos}
          onConfirm={handleConfirmarPago}
          onClose={() => { setShowPago(false); setEstadoPendiente(null); }}
        />
      )}

      <ConfirmDialog
        open={confirmCancelar !== null}
        title="Cancelar orden"
        message={`¿Cancelar la orden ${orden.numero_orden}? Esta acción no se puede deshacer.`}
        confirmText="Sí, cancelar orden"
        cancelText="No, volver"
        confirmColor="error"
        onConfirm={handleConfirmarCancelacion}
        onClose={() => setConfirmCancelar(null)}
      />
    </>
  );
};

// ============================================================================
// MODAL CREAR ORDEN — Split-panel: catálogo | carrito
// ============================================================================
interface DetalleCarrito {
  producto:           Producto;
  cantidad:           number;
  notas:              string;
  /** Restaurante al que pertenece este ítem (multi-restaurante) */
  id_restaurante:     number;
  restaurante_nombre: string;
  /** Variante seleccionada (opcional — solo si el producto tiene variantes) */
  variante?: { id: number; nombre: string; precio: number };
}

// ── Variantes de tamaño (Pizzas, etc.) ────────────────────────────────────────
// Detecta nombres como "Pizza al Pesto (Mediana)", "Stromboli Criollo (Mediano)", "Rolls de Canela (6 und)"
const VARIANT_REGEX = /^(.+?)\s*\((Personal|Mediana|Mediano|Familiar|Grande|Pequeña|6 und|12 und)\)$/i;
const ORDEN_TAMANOS = ['Personal', 'Mediana', 'Mediano', 'Familiar', 'Grande', 'Pequeña', '6 und', '12 und'];

interface GrupoProducto {
  nombreBase: string;
  variantes: Array<{ etiqueta: string; producto: Producto }>;
}

type ItemCatalogo =
  | { tipo: 'grupo'; grupo: GrupoProducto }
  | { tipo: 'solo';  prod:  Producto };

const CrearOrdenModal: React.FC<{
  estadoInicial: number;
  onClose: () => void;
  onSave: () => void;
}> = ({ estadoInicial, onClose, onSave }) => {
  const { user }         = useAuthStore();
  const idRestaurante    = useRestauranteActivo();

  // Multi-restaurante
  const { restaurantes: restaurantesStore, grupoActivo } = useRestauranteStore();
  void useFeatureFlag('multi_restaurante'); // carga el flag aunque no lo usemos aún

  // Restaurantes disponibles para el modal — se cargan desde la API del grupo activo
  const [restaurantesGrupo, setRestaurantesGrupo] = useState(restaurantesStore);
  useEffect(() => {
    if (grupoActivo?.id) {
      // Cargar todos los restaurantes del grupo, no solo los del store del usuario
      api.get<{ success: boolean; data: any[] }>(
        `/restaurantes?id_grupo=${grupoActivo.id}&limit=50`
      ).then(r => {
        if (r.data.success && r.data.data.length > 1) {
          setRestaurantesGrupo(
            r.data.data
              .filter((x: any) => x.activo !== false)
              .map((x: any) => ({ id: x.id, nombre: x.nombre, es_default: !!x.es_default, logo_url: x.logo_url }))
          );
        }
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoActivo?.id]);

  // Fallback: si no hay grupo, usar los del store; si hay 1 solo, el modal funciona igual que antes
  const restaurantesDisponibles = restaurantesGrupo.length > 0 ? restaurantesGrupo : restaurantesStore;
  const multiMode = restaurantesDisponibles.length > 1;
  // Enviar como V2 cuando multi + hay grupo activo
  const puedeEnviarV2 = multiMode && !!grupoActivo?.id;

  // Restaurante cuyo catálogo está visible — arranca con el activo
  const [restauranteTab, setRestauranteTab] = useState<number>(
    () => idRestaurante ?? restaurantesDisponibles[0]?.id ?? 0
  );
  const restauranteTabNombre =
    restaurantesDisponibles.find(r => r.id === restauranteTab)?.nombre ?? 'Restaurante';

  // --- Tipo de orden ---
  const [tipo, setTipo]                     = useState<'local' | 'domicilio'>('domicilio');

  // --- Cliente seleccionado ---
  const [clienteId, setClienteId]               = useState<number | null>(null);
  const [clienteBusqueda, setClienteBusqueda]   = useState('');
  const [clienteResultados, setClienteResultados] = useState<any[]>([]);
  const [clienteLoading, setClienteLoading]     = useState(false);
  const [clienteDropdown, setClienteDropdown]   = useState(false);
  const [showQuickCliente, setShowQuickCliente] = useState(false);
  const clienteRef = useRef<HTMLDivElement>(null);

  // --- Datos de contacto / domicilio ---
  const [nombreContacto, setNombreContacto] = useState('');
  const [telefono, setTelefono]             = useState('');
  const [direccion, setDireccion]           = useState('');
  const [costoDomicilio, setCostoDomicilio] = useState<string>('');
  const [observaciones, setObservaciones]   = useState('');

  // --- Catálogo ---
  const [catalogo, setCatalogo]             = useState<Producto[]>([]);
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);
  const [categoriasList, setCategoriasList] = useState<Categoria[]>([]);
  const [catTab, setCatTab]                 = useState<string>('todos');
  const [sizeTab, setSizeTab]               = useState<string>('Todos');
  const [search, setSearch]                 = useState('');

  // --- Carrito ---
  const [detalles, setDetalles]             = useState<DetalleCarrito[]>([]);

  // --- Picker de variantes ---
  const [variantePicker, setVariantePicker] = useState<{
    producto:  Producto;
    variantes: ProductoVariante[];
  } | null>(null);
  const [loadingVariantes, setLoadingVariantes] = useState(false);
  // ESC cierra el picker de variantes si está abierto; si no, cierra el modal de creación
  useEscapeKey(() => setVariantePicker(null), variantePicker !== null);
  useEscapeKey(onClose, variantePicker === null);

  // --- Estado del formulario ---
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState<string | null>(null);

  // Cargar costo de domicilio por defecto desde configuración
  useEffect(() => {
    configuracionService.getByClave('costo_domicilio_defecto')
      .then(c => setCostoDomicilio(c.valor))
      .catch(() => {});
  }, []);

  // Búsqueda de clientes con debounce
  useEffect(() => {
    if (clienteBusqueda.trim().length < 2) {
      setClienteResultados([]);
      setClienteDropdown(false);
      return;
    }
    setClienteLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await clienteService.listar({ search: clienteBusqueda, limit: 8 });
        setClienteResultados(res.data);
        setClienteDropdown(true);
      } catch { setClienteResultados([]); }
      finally { setClienteLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [clienteBusqueda]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clienteRef.current && !clienteRef.current.contains(e.target as Node)) {
        setClienteDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelectCliente = (c: any) => {
    setClienteId(c.id);
    setClienteBusqueda(c.nombre_completo);
    setNombreContacto(c.nombre_completo);
    if (c.telefono) setTelefono(c.telefono);
    if (tipo === 'domicilio') {
      const dir = c.direccion || c.direcciones?.[0]?.direccion || '';
      if (dir) setDireccion(dir);
    }
    setClienteDropdown(false);
  };

  const handleLimpiarCliente = () => {
    setClienteId(null);
    setClienteBusqueda('');
    setNombreContacto('');
    setTelefono('');
    setDireccion('');
  };

  // Cargar catálogo y categorías al montar
  useEffect(() => {
    setLoadingCatalogo(true);
    Promise.all([
      productosService.getAll({ estado: 'activo', es_vendible: true, limit: 500 }),
      categoriasService.listar('activo'),
    ])
      .then(([prods, cats]) => {
        setCatalogo(prods.filter(p => p.es_vendible));
        setCategoriasList(cats.sort((a, b) => a.orden - b.orden));
      })
      .catch(e => console.error(e))
      .finally(() => setLoadingCatalogo(false));
  }, []);

  // Filtrado local (sin API)
  const productosFiltrados = useMemo(() =>
    catalogo.filter(p => {
      const matchCat    = catTab === 'todos' || String(p.id_categoria) === catTab;
      const matchSearch = !search || p.nombre.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    }),
  [catalogo, catTab, search]);

  // Resetear tamaño al cambiar de categoría
  useEffect(() => { setSizeTab('Todos'); }, [catTab]);

  // Separar productos con variantes de tamaño (ej: pizzas) de los normales
  const { grupos, solos } = useMemo(() => {
    const gruposMap = new Map<string, GrupoProducto>();
    const solosArr: Producto[] = [];
    productosFiltrados.forEach(p => {
      const match = p.nombre.match(VARIANT_REGEX);
      if (match) {
        const base = match[1].trim();
        const size = match[2];
        const key  = `${p.id_categoria ?? 0}__${base}`;
        if (!gruposMap.has(key)) gruposMap.set(key, { nombreBase: base, variantes: [] });
        const g = gruposMap.get(key)!;
        if (!g.variantes.find(v => v.etiqueta === size)) {
          g.variantes.push({ etiqueta: size, producto: p });
        }
      } else {
        solosArr.push(p);
      }
    });
    // Ordenar variantes: Personal → Mediana → Familiar → Grande
    gruposMap.forEach(g => {
      g.variantes.sort((a, b) => ORDEN_TAMANOS.indexOf(a.etiqueta) - ORDEN_TAMANOS.indexOf(b.etiqueta));
    });
    return { grupos: Array.from(gruposMap.values()), solos: solosArr };
  }, [productosFiltrados]);

  // Tamaños disponibles en la vista actual
  const tamanosDisponibles = useMemo(() => {
    const set = new Set<string>();
    grupos.forEach(g => g.variantes.forEach(v => set.add(v.etiqueta)));
    return ORDEN_TAMANOS.filter(t => set.has(t));
  }, [grupos]);

  // Grupos filtrados por el tamaño seleccionado
  const gruposFiltrados = useMemo(() => {
    if (sizeTab === 'Todos') return grupos;
    return grupos
      .map(g => ({ ...g, variantes: g.variantes.filter(v => v.etiqueta === sizeTab) }))
      .filter(g => g.variantes.length > 0);
  }, [grupos, sizeTab]);

  // Sub-secciones: agrupa por primera palabra del nombre (ej: "Rolls" vs "Stromboli")
  const subSecciones = useMemo(() => {
    const mapa = new Map<string, ItemCatalogo[]>();
    const push = (key: string, item: ItemCatalogo) => {
      if (!mapa.has(key)) mapa.set(key, []);
      mapa.get(key)!.push(item);
    };
    gruposFiltrados.forEach(g => push(g.nombreBase.split(' ')[0], { tipo: 'grupo', grupo: g }));
    solos.forEach(p => push(p.nombre.split(' ')[0], { tipo: 'solo', prod: p }));
    // Sub-secciones solo cuando hay múltiples prefijos Y al menos uno agrupa >1 ítem
    // (evita dividir hamburguesas donde cada producto tiene un nombre único)
    const hayGrupoConVarios = Array.from(mapa.values()).some(items => items.length > 1);
    return (mapa.size > 1 && hayGrupoConVarios) ? mapa : null;
  }, [gruposFiltrados, solos]);

  // allSecciones: estructura final lista para el render del grid
  const allSecciones = useMemo((): Array<{ titulo: string; items: ItemCatalogo[] }> => {
    if (subSecciones) {
      return Array.from(subSecciones.entries()).map(([titulo, items]) => ({ titulo, items }));
    }
    return [{ titulo: '', items: [
      ...gruposFiltrados.map(g => ({ tipo: 'grupo' as const, grupo: g })),
      ...solos.map(p => ({ tipo: 'solo' as const, prod: p })),
    ]}];
  }, [subSecciones, gruposFiltrados, solos]);

  // --- Carrito helpers ---

  /** Agrega directamente (sin variante o con variante ya seleccionada) */
  const agregarAlCarrito = (p: Producto, variante?: DetalleCarrito['variante']) => {
    const rid   = restauranteTab;
    const rnomb = restauranteTabNombre;
    setDetalles(prev => {
      const existe = prev.find(d =>
        d.id_restaurante === rid &&
        (variante
          ? d.producto.id === p.id && d.variante?.id === variante.id
          : d.producto.id === p.id && !d.variante)
      );
      if (existe) {
        return prev.map(d => {
          const match =
            d.id_restaurante === rid &&
            (variante
              ? d.producto.id === p.id && d.variante?.id === variante.id
              : d.producto.id === p.id && !d.variante);
          return match ? { ...d, cantidad: d.cantidad + 1 } : d;
        });
      }
      return [...prev, { producto: p, cantidad: 1, notas: '', variante, id_restaurante: rid, restaurante_nombre: rnomb }];
    });
  };

  /** Al clickear una tarjeta: si tiene variantes DB, muestra el picker; si no, agrega directo */
  const agregarProducto = async (p: Producto) => {
    setLoadingVariantes(true);
    try {
      const vars = await variantesService.listar(p.id);
      const activas = vars.filter(v => v.estado === 'activo');
      if (activas.length > 0) {
        setVariantePicker({ producto: p, variantes: activas });
      } else {
        agregarAlCarrito(p);
      }
    } catch {
      agregarAlCarrito(p);
    } finally {
      setLoadingVariantes(false);
    }
  };

  const actualizarCantidad = (rid: number, id: number, cantidad: number, varianteId?: number) => {
    setDetalles(prev => {
      const match = (d: DetalleCarrito) =>
        d.id_restaurante === rid &&
        (varianteId ? d.producto.id === id && d.variante?.id === varianteId
                    : d.producto.id === id && !d.variante);
      if (cantidad <= 0) return prev.filter(d => !match(d));
      return prev.map(d => match(d) ? { ...d, cantidad } : d);
    });
  };

  const actualizarNotas = (rid: number, id: number, notas: string) =>
    setDetalles(prev => prev.map(d =>
      d.id_restaurante === rid && d.producto.id === id ? { ...d, notas } : d
    ));

  const limpiarCarrito = () => setDetalles([]);

  // --- Totales ---
  const precioDetalle = (d: DetalleCarrito) =>
    d.variante ? Number(d.variante.precio) : (d.producto.precio_venta || d.producto.precio_unitario);

  const subtotal = detalles.reduce((s, d) => s + precioDetalle(d) * d.cantidad, 0);
  const costodom = tipo === 'domicilio' ? (parseFloat(costoDomicilio) || 0) : 0;
  const total    = subtotal + costodom;

  // --- Enviar ---
  const handleSubmit = async () => {
    if (detalles.length === 0) { setError('Agrega al menos un producto'); return; }
    if (!clienteId) { setError('Selecciona o crea un cliente para continuar'); return; }
    setSaving(true); setError(null);
    try {
      if (puedeEnviarV2) {
        // ── Nueva arquitectura: una Orden + una OrdenSede por restaurante ──
        const porRestaurante = new Map<number, DetalleCarrito[]>();
        detalles.forEach(d => {
          if (!porRestaurante.has(d.id_restaurante)) porRestaurante.set(d.id_restaurante, []);
          porRestaurante.get(d.id_restaurante)!.push(d);
        });
        const data: OrdenCreateV2DTO = {
          id_grupo:          grupoActivo!.id,
          tipo_orden:        tipo,
          id_cliente:        clienteId ?? undefined,
          nombre_contacto:   nombreContacto || undefined,
          telefono_contacto: telefono || undefined,
          direccion_entrega: tipo === 'domicilio' ? (direccion || undefined) : undefined,
          observaciones:     observaciones || undefined,
          costo_domicilio:   costodom > 0 ? costodom : undefined,
          sedes: Array.from(porRestaurante.entries()).map(([rid, items]) => ({
            id_restaurante: rid,
            items: items.map(d => ({
              id_producto:     d.producto.id,
              id_variante:     d.variante?.id,
              cantidad:        d.cantidad,
              precio_unitario: precioDetalle(d),
              notas:           d.variante
                ? [d.variante.nombre, d.notas].filter(Boolean).join(' — ')
                : (d.notas || undefined),
            })),
          })),
        };
        await ordenesService.createV2(data);
      } else {
        // ── Legado: orden single-restaurante con detalles planos ──
        const data: OrdenCreateDTO = {
          tipo_orden:        tipo,
          id_estado:         estadoInicial,
          id_usuario:        user?.id ?? 0,
          id_cliente:        clienteId ?? undefined,
          id_restaurante:    idRestaurante,
          nombre_contacto:   nombreContacto || undefined,
          telefono_contacto: telefono || undefined,
          direccion_entrega: tipo === 'domicilio' ? (direccion || undefined) : undefined,
          observaciones:     observaciones || undefined,
          costo_domicilio:   costodom > 0 ? costodom : undefined,
          detalles: detalles.map(d => ({
            id_producto:     d.producto.id,
            id_variante:     d.variante?.id,
            cantidad:        d.cantidad,
            precio_unitario: precioDetalle(d),
            notas:           d.variante
              ? [d.variante.nombre, d.notas].filter(Boolean).join(' — ')
              : (d.notas || undefined),
          })),
        };
        await ordenesService.create(data);
      }
      toast.success('Orden creada correctamente');
      onSave();
    } catch (err: any) {
      const msg = err.message || 'Error al crear orden';
      setError(msg);
      toast.error(msg);
    } finally { setSaving(false); }
  };

  /** Total de unidades en carrito para un producto — scope al restaurante activo */
  const cantEnCarrito = (id: number) =>
    detalles
      .filter(d => d.producto.id === id && d.id_restaurante === restauranteTab)
      .reduce((s, d) => s + d.cantidad, 0);

  return (
    <>
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: Z_INDEX.MODAL_BASE }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 flex-shrink-0">

          {/* Fila 1: pills de restaurante — solo en modo multi */}
          {multiMode && (
            <div className="px-6 pt-3 pb-0 flex items-center gap-2 border-b border-white/20 pb-2">
              <span className="text-emerald-100 text-xs font-semibold mr-1">Restaurante:</span>
              <div className="flex gap-1.5 flex-wrap">
                {restaurantesDisponibles.map(r => {
                  const cantItems = detalles
                    .filter(d => d.id_restaurante === r.id)
                    .reduce((s, d) => s + d.cantidad, 0);
                  return (
                    <button
                      key={r.id}
                      onClick={() => setRestauranteTab(r.id)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${
                        restauranteTab === r.id
                          ? 'bg-white text-emerald-700 border-white shadow-sm'
                          : 'bg-white/15 text-white/80 border-white/30 hover:bg-white/25'
                      }`}
                    >
                      {r.nombre}
                      {cantItems > 0 && (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-400 text-amber-900 text-[10px] font-black">
                          {cantItems}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Fila 2: título + tipo toggle + cerrar */}
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg"><ShoppingCart className="w-5 h-5 text-white" /></div>
              <div>
                <h2 className="text-white font-bold text-lg leading-tight">Nueva Orden</h2>
                {multiMode && (
                  <p className="text-emerald-100 text-xs">
                    Catálogo: <span className="font-semibold">{restauranteTabNombre}</span>
                  </p>
                )}
              </div>
            </div>
            {/* Tipo toggle */}
            <div className="flex items-center gap-1 bg-white/20 rounded-xl p-1">
              {(['domicilio', 'local'] as const).map(t => (
                <button key={t} onClick={() => setTipo(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${tipo === t ? 'bg-white text-emerald-700' : 'text-white/80 hover:bg-white/20'}`}>
                  {t === 'local' ? <Store className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                  {t === 'local' ? 'Local' : 'Domicilio'}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/20 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Error ──────────────────────────────────────────────── */}
        {error && (
          <ErrorAlert message={error} className="mx-6 mt-3 flex-shrink-0" />
        )}

        {/* ── Body: catálogo | carrito ────────────────────────────── */}
        <div className="flex-1 overflow-hidden grid grid-cols-5 min-h-0">

          {/* ════ PANEL IZQUIERDO — Catálogo (3/5) ════════════════ */}
          <div className="col-span-3 flex flex-col border-r border-slate-200 overflow-hidden">

            {/* Buscador */}
            <div className="p-4 border-b border-slate-100 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar producto..."
                  className="w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                {loadingCatalogo && <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 animate-spin" />}
              </div>
            </div>

            {/* Tabs de categorías — ordenadas por `orden` de la DB, con icono y color */}
            <div className="px-4 py-2 border-b border-slate-100 flex gap-1.5 flex-wrap flex-shrink-0">
              {/* Botón "Todos" */}
              <button
                onClick={() => setCatTab('todos')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                  catTab === 'todos' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                🍽 Todos
              </button>
              {/* Botones de categoría con icono y color dinámico */}
              {categoriasList.map(cat => {
                const isActive = catTab === String(cat.id);
                const bg       = cat.color || '#43a047';
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCatTab(String(cat.id))}
                    style={isActive ? { backgroundColor: bg, color: '#fff', boxShadow: `0 2px 8px ${bg}66` } : {}}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1 ${
                      isActive ? '' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat.icono && <span>{cat.icono}</span>}
                    {cat.nombre}
                  </button>
                );
              })}
            </div>

            {/* Sub-fila de tamaños — aparece cuando la categoría tiene variantes */}
            {tamanosDisponibles.length > 0 && (
              <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex gap-1.5 items-center flex-shrink-0">
                <span className="text-xs font-bold text-amber-600 mr-0.5">Tamaño:</span>
                <button onClick={() => setSizeTab('Todos')}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${sizeTab === 'Todos' ? 'bg-amber-600 text-white shadow-sm' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>
                  Todos
                </button>
                {tamanosDisponibles.map(t => (
                  <button key={t} onClick={() => setSizeTab(t)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${sizeTab === t ? 'bg-amber-600 text-white shadow-sm' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>
                    {t}
                  </button>
                ))}
              </div>
            )}

            {/* Grid de productos */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingCatalogo ? (
                <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Cargando productos...
                </div>
              ) : (gruposFiltrados.length === 0 && solos.length === 0) ? (
                <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-sm">
                  <Package className="w-8 h-8 mb-2 opacity-40" />
                  No se encontraron productos
                </div>
              ) : (
                /* Grid con sub-secciones. Columnas configurables desde Catálogo → Personalizar */
                <div className={allSecciones.length > 1 ? 'space-y-5' : 'grid grid-cols-3 gap-3'}>
                  {allSecciones.flatMap(({ titulo, items }) => {
                    // Renderizar cada ítem como card de grupo (variantes) o card simple
                    const cards = items.map(item => item.tipo === 'grupo' ? (
                      <div key={`g-${item.grupo.nombreBase}`}
                        className="flex flex-col p-3 rounded-xl border-2 border-slate-200 bg-white hover:border-amber-300 transition-all">
                        <span className="text-xs font-semibold text-slate-700 leading-tight">{item.grupo.nombreBase}</span>

                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {item.grupo.variantes.map(v => {
                            const en = cantEnCarrito(v.producto.id);
                            const pr = v.producto.precio_venta || v.producto.precio_unitario;
                            return (
                              <button key={v.etiqueta} onClick={() => agregarProducto(v.producto)}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-semibold transition-all ${
                                  en > 0
                                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700'
                                }`}>
                                {en > 0 && <span className="bg-emerald-600 text-white text-xs font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">{en}</span>}
                                <span>{v.etiqueta}</span>
                                <span className="font-bold text-emerald-600">{formatCurrency(pr)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <button key={`p-${item.prod.id}`} onClick={() => agregarProducto(item.prod)}
                        className={`relative flex flex-col items-start gap-1.5 p-3 rounded-xl border-2 text-left transition-all ${
                          cantEnCarrito(item.prod.id) > 0
                            ? 'border-emerald-400 bg-emerald-50 hover:shadow-md'
                            : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-md'
                        }`}>
                        {cantEnCarrito(item.prod.id) > 0 && (
                          <span className="absolute -top-2 -right-2 bg-emerald-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shadow">{cantEnCarrito(item.prod.id)}</span>
                        )}
                        <span className="text-xs font-semibold text-slate-700 leading-tight line-clamp-2">{item.prod.nombre}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold text-emerald-600">{formatCurrency(item.prod.precio_venta || item.prod.precio_unitario)}</span>
                          {loadingVariantes && <RefreshCw className="w-2.5 h-2.5 animate-spin text-slate-400" />}
                        </div>
                      </button>
                    ));
                    // Sin título → grid plano; con título → sección con encabezado divisor
                    if (!titulo) return cards;
                    return [(
                      <div key={titulo}>
                        <div className="flex items-center gap-2 mb-2.5">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{titulo}</span>
                          <div className="flex-1 h-px bg-slate-200" />
                        </div>
                        <div className="grid grid-cols-3 gap-3">{cards}</div>
                      </div>
                    )];
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ════ PANEL DERECHO — Carrito (2/5) ═══════════════════ */}
          <div className="col-span-2 flex flex-col overflow-hidden bg-slate-50">

            {/* Header carrito */}
            <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between flex-shrink-0">
              <p className="text-sm font-bold text-slate-700">
                Carrito {detalles.length > 0 && (
                  <span className="text-emerald-600">({detalles.reduce((s, d) => s + d.cantidad, 0)} ítems)</span>
                )}
              </p>
              {detalles.length > 0 && (
                <button onClick={limpiarCarrito}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
                  <Trash2 className="w-3 h-3" /> Limpiar
                </button>
              )}
            </div>

            {/* Items del carrito */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {detalles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6 text-center">
                  <ShoppingCart className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm font-medium">Carrito vacío</p>
                  <p className="text-xs mt-1 text-slate-300">Selecciona productos del catálogo</p>
                </div>
              ) : (() => {
                // Agrupar por restaurante — en modo single muestra un solo grupo sin header
                const grupos = new Map<number, { nombre: string; items: DetalleCarrito[] }>();
                detalles.forEach(d => {
                  if (!grupos.has(d.id_restaurante)) {
                    grupos.set(d.id_restaurante, { nombre: d.restaurante_nombre, items: [] });
                  }
                  grupos.get(d.id_restaurante)!.items.push(d);
                });
                const gruposArr = Array.from(grupos.entries());
                const showHeaders = multiMode && gruposArr.length > 1;

                return (
                  <div className="p-3 space-y-3">
                    {gruposArr.map(([rid, grupo]) => (
                      <div key={rid}>
                        {/* Encabezado de restaurante — solo en multi */}
                        {showHeaders && (
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex-1 h-px bg-slate-200" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">
                              {grupo.nombre}
                            </span>
                            <div className="flex-1 h-px bg-slate-200" />
                          </div>
                        )}
                        <div className="space-y-2">
                          {grupo.items.map((d, idx) => {
                            const precio = precioDetalle(d);
                            const key    = `${rid}-${d.producto.id}-${d.variante?.id ?? 'base'}-${idx}`;
                            return (
                              <div key={key} className="bg-white rounded-xl p-3 border border-slate-200 space-y-2">
                                <div className="flex items-start gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-slate-700 leading-tight">{d.producto.nombre}</p>
                                    {d.variante && (
                                      <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 mt-0.5">
                                        {d.variante.nombre}
                                      </span>
                                    )}
                                    <p className="text-xs text-slate-400">{formatCurrency(precio)} c/u</p>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <button onClick={() => actualizarCantidad(rid, d.producto.id, d.cantidad - 1, d.variante?.id)}
                                      className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 font-bold text-sm leading-none">−</button>
                                    <span className="w-6 text-center text-sm font-bold">{d.cantidad}</span>
                                    <button onClick={() => actualizarCantidad(rid, d.producto.id, d.cantidad + 1, d.variante?.id)}
                                      className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center hover:bg-emerald-200 font-bold text-sm leading-none">+</button>
                                    <button onClick={() => actualizarCantidad(rid, d.producto.id, 0, d.variante?.id)}
                                      className="w-6 h-6 rounded-lg text-red-400 hover:bg-red-50 flex items-center justify-center ml-1">
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    value={d.notas}
                                    onChange={e => actualizarNotas(rid, d.producto.id, e.target.value)}
                                    placeholder="Notas (sin sal, sin cebolla...)"
                                    className="flex-1 text-xs px-2 py-1.5 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-emerald-400 bg-slate-50"
                                  />
                                  <span className="text-xs font-bold text-slate-700 flex-shrink-0">{formatCurrency(precio * d.cantidad)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Subtotal por restaurante — solo en multi con más de uno */}
                        {showHeaders && (
                          <div className="flex justify-between items-center text-xs mt-2 px-1">
                            <span className="text-slate-400">Subtotal {grupo.nombre}</span>
                            <span className="font-bold text-slate-600">
                              {formatCurrency(grupo.items.reduce((s, d) => s + precioDetalle(d) * d.cantidad, 0))}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Total */}
            <div className="border-t border-slate-200 bg-white px-4 py-3 flex-shrink-0">
              <div className="space-y-1 text-xs">
                {costodom > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span>Costo domicilio</span><span className="font-semibold">{formatCurrency(costodom)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="font-bold text-slate-800 text-sm">TOTAL</span>
                  <span className="font-bold text-emerald-700 text-lg">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* ── Selector de cliente ──────────────────────────────── */}
            <div className="border-t border-slate-200 bg-white px-4 pt-3 pb-2 flex-shrink-0">
              <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> Cliente
              </p>
              {clienteId ? (
                /* Cliente ya seleccionado */
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-200 flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 text-emerald-700" />
                  </div>
                  <span className="flex-1 text-xs font-semibold text-emerald-800 truncate">{clienteBusqueda}</span>
                  <button onClick={handleLimpiarCliente} title="Cambiar cliente"
                    className="text-slate-400 hover:text-red-500 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                /* Búsqueda de cliente */
                <div ref={clienteRef} className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <input
                      value={clienteBusqueda}
                      onChange={e => { setClienteBusqueda(e.target.value); setClienteDropdown(true); }}
                      onFocus={() => clienteBusqueda.trim().length >= 2 && setClienteDropdown(true)}
                      placeholder="Buscar cliente por nombre o teléfono..."
                      className="w-full pl-8 pr-8 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    {clienteLoading && (
                      <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 animate-spin" />
                    )}
                  </div>
                  {clienteDropdown && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-44 overflow-y-auto">
                      {clienteResultados.length === 0 ? (
                        <div className="px-3 py-3 text-xs text-slate-500 space-y-2">
                          <p className="font-medium">No se encontró ningún cliente.</p>
                          <button
                            onClick={() => setShowQuickCliente(true)}
                            className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-semibold transition-colors">
                            <UserPlus className="w-3.5 h-3.5" /> Registrar nuevo cliente →
                          </button>
                        </div>
                      ) : (
                        <>
                          {clienteResultados.map(c => (
                            <button key={c.id} onClick={() => handleSelectCliente(c)}
                              className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors">
                              <p className="text-xs font-semibold text-slate-800">{c.nombre_completo}</p>
                              <p className="text-[10px] text-slate-500">
                                {[c.telefono, c.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                              </p>
                            </button>
                          ))}
                          <button
                            onClick={() => setShowQuickCliente(true)}
                            className="w-full text-left px-3 py-2 text-[10px] text-blue-600 hover:bg-blue-50 flex items-center gap-1 transition-colors border-t border-slate-100">
                            <UserPlus className="w-3 h-3" /> Registrar nuevo cliente
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Costo de domicilio / observaciones — el nombre, teléfono y dirección ya
                vienen del cliente asociado (arriba), no se vuelven a pedir aquí. */}
            <div className="border-t border-slate-100 bg-white px-4 pt-3 pb-3 flex-shrink-0 space-y-2">
              {tipo === 'domicilio' && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-blue-700 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Costo de domicilio
                  </p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 text-xs font-bold">$</span>
                    <input type="number" min="0" value={costoDomicilio} onChange={e => setCostoDomicilio(e.target.value)}
                      placeholder="Costo domicilio"
                      className="w-full pl-6 pr-3 py-2 border border-blue-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-400 outline-none bg-blue-50/50 font-semibold" />
                  </div>
                </div>
              )}
              <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={1}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                placeholder="Observaciones generales..." />
            </div>

            {/* Footer botones */}
            <div className="px-4 py-3 border-t border-slate-200 flex gap-2 bg-slate-50 flex-shrink-0">
              <button onClick={onClose}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSubmit} disabled={saving || detalles.length === 0 || !clienteId}
                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving
                  ? 'Creando...'
                  : detalles.length === 0
                    ? 'Agrega productos'
                    : !clienteId
                      ? 'Selecciona un cliente'
                      : `Crear · ${formatCurrency(total)}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* ── Registro de cliente completo (sin salir de la orden en curso) ── */}
    {showQuickCliente && (
      <ClienteFormModal
        initialValues={{ nombre_completo: clienteBusqueda }}
        onClose={() => setShowQuickCliente(false)}
        onSaved={c => { handleSelectCliente(c); setShowQuickCliente(false); }}
      />
    )}

    {/* ── Picker de variantes ────────────────────────────────────────── */}
    {variantePicker && (
      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: Z_INDEX.MODAL_NESTED }}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setVariantePicker(null)} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-violet-200 text-xs font-medium">Selecciona una variante</p>
              <h3 className="text-white font-bold text-base leading-tight">{variantePicker.producto.nombre}</h3>
            </div>
            <button onClick={() => setVariantePicker(null)}
              className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/20 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Variantes */}
          <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
            {variantePicker.variantes.map(v => (
              <button key={v.id}
                onClick={() => {
                  agregarAlCarrito(variantePicker.producto, {
                    id:     v.id,
                    nombre: v.nombre,
                    precio: Number(v.precio),
                  });
                  setVariantePicker(null);
                }}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-slate-200 hover:border-violet-400 hover:bg-violet-50 transition-all text-left group">
                <span className="font-semibold text-slate-700 group-hover:text-violet-700">{v.nombre}</span>
                <span className="font-bold text-emerald-600 text-sm">{formatCurrency(Number(v.precio))}</span>
              </button>
            ))}
            {/* Opción sin variante (precio base) */}
            <button
              onClick={() => {
                agregarAlCarrito(variantePicker.producto);
                setVariantePicker(null);
              }}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-all text-left group">
              <span className="text-slate-500 text-sm group-hover:text-slate-700">Precio base</span>
              <span className="font-bold text-slate-600 text-sm">
                {formatCurrency(variantePicker.producto.precio_venta || variantePicker.producto.precio_unitario)}
              </span>
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export const Ordenes: React.FC = () => {
  const idRestaurante                 = useRestauranteActivo();
  const [ordenes, setOrdenes]         = useState<Orden[]>([]);
  const [estados, setEstados]         = useState<EstadoOrdenFull[]>([]);
  const [metodos, setMetodos]         = useState<MetodoPagoFrontend[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState<'todas' | 'local' | 'domicilio'>('todas');
  const [searchTerm, setSearchTerm]   = useState('');
  const [showCrear, setShowCrear]     = useState(false);
  const [detalleOrden, setDetalleOrden] = useState<Orden | null>(null);
  const { setSidebarCollapsed } = useUIStore();

  const abrirModal  = () => { setSidebarCollapsed(true);  setShowCrear(true);  };
  const cerrarModal = () => { setSidebarCollapsed(false); setShowCrear(false); };

  // Las órdenes se crean directamente en EN_PREPARACION
  const estadoInicial = estados.find(e => e.codigo === 'EN_PREPARACION')?.id
                     || estados.find(e => e.es_inicial)?.id
                     || 1;

  // Carga estados y métodos de pago una sola vez al montar
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const [ests, mets] = await Promise.all([
          estadoOrdenService.getAll(),
          metodoPagoService.getAll(),
        ]);
        setEstados(ests);
        setMetodos(mets);
      } catch (e) {
        console.error('Error cargando configuración:', e);
      }
    };
    loadConfig();
  }, []);

  const loadOrdenes = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (activeTab !== 'todas') params.tipo_orden = activeTab;
      if (idRestaurante) params.id_restaurante = idRestaurante;
      const data = await ordenesService.getAll(params);
      setOrdenes(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [activeTab, idRestaurante]);

  useEffect(() => { loadOrdenes(); }, [loadOrdenes]);

  // Último cierre de caja confirmado de la sede activa — las órdenes entregadas de antes
  // (o al momento) de ese cierre se ocultan del tablero (quedaron "despachadas"); se
  // consultan desde Facturas en vez de acumularse aquí indefinidamente.
  const [ultimoCierre, setUltimoCierre] = useState<{ fecha_cierre: string } | null>(null);

  useEffect(() => {
    if (!idRestaurante) { setUltimoCierre(null); return; }
    cierreCajaService.getAll({ id_restaurante: idRestaurante, limit: 5, page: 1 })
      .then(({ data }) => {
        const ultimo = data.find(c => c.estado === 'completado' || c.estado === 'con_diferencia');
        setUltimoCierre(ultimo ?? null);
      })
      .catch(() => setUltimoCierre(null));
  }, [idRestaurante]);

  // Traduce el código legado (estado.codigo, el que sí cambia en órdenes sin sedes) a la
  // misma clave de columna que usa estado_global, para que el tablero no dependa de que
  // estado_global se actualice en el flujo legado (nunca lo hace).
  const LEGACY_TO_GLOBAL: Record<string, string> = {
    PENDIENTE: 'RECIBIDA', EN_PREPARACION: 'EN_PROCESO', LISTA: 'LISTA',
    ENTREGADA: 'ENTREGADA', CANCELADA: 'CANCELADA',
  };

  const estadoCodigo = (o: Orden): string => {
    if (o.sedes && o.sedes.length > 0) return o.estado_global ?? 'OTRO';
    const codigoLegado = o.estado?.codigo?.toUpperCase() ?? '';
    return LEGACY_TO_GLOBAL[codigoLegado] ?? codigoLegado ?? 'OTRO';
  };

  const filtered = ordenes.filter(o => {
    const matchSearch = !searchTerm ||
      o.numero_orden.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.nombre_contacto?.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchSearch) return false;

    // Las entregadas de antes (o al momento) del último cierre de caja quedan
    // "despachadas" — ya no se muestran en el tablero, se consultan desde Facturas.
    if (ultimoCierre && o.fecha_entrega && estadoCodigo(o) === 'ENTREGADA') {
      if (new Date(o.fecha_entrega) <= new Date(ultimoCierre.fecha_cierre)) return false;
    }
    return true;
  });

  const statsOrdenes = {
    pendientes:  ordenes.filter(o => estadoCodigo(o) === 'PENDIENTE' || estadoCodigo(o) === 'RECIBIDA').length,
    preparacion: ordenes.filter(o => estadoCodigo(o) === 'EN_PREPARACION' || estadoCodigo(o) === 'EN_PROCESO').length,
    listas:      ordenes.filter(o => estadoCodigo(o) === 'LISTA').length,
    totalHoy:    ordenes.reduce((s, o) => s + o.total, 0),
  };

  // Orden de secciones: activas primero, finales al fondo (legado + nueva arch)
  const ESTADO_PRIORIDAD = ['EN_PROCESO', 'EN_PREPARACION', 'LISTA', 'RECIBIDA', 'PENDIENTE', 'ENTREGADA', 'CANCELADA'];

  const ESTADO_GLOBAL_LABELS: Partial<Record<string, string>> = {
    RECIBIDA: 'Recibida', EN_PROCESO: 'En proceso',
    LISTA: 'Lista', ENTREGADA: 'Entregada', CANCELADA: 'Cancelada',
  };

  const ordenesPorEstado = useMemo(() => {
    const grupos: Record<string, { nombre: string; ordenes: Orden[] }> = {};
    filtered.forEach(o => {
      const codigo = estadoCodigo(o);
      const nombre = ESTADO_GLOBAL_LABELS[codigo] ?? o.estado?.nombre ?? codigo;
      if (!grupos[codigo]) grupos[codigo] = { nombre, ordenes: [] };
      grupos[codigo].ordenes.push(o);
    });
    return [
      ...ESTADO_PRIORIDAD.filter(c => grupos[c]).map(c => ({ codigo: c, ...grupos[c] })),
      ...Object.entries(grupos).filter(([c]) => !ESTADO_PRIORIDAD.includes(c)).map(([c, v]) => ({ codigo: c, ...v })),
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  if (loading && ordenes.length === 0) return <LoadingScreen message="Cargando órdenes..." />;

  return (
    <div className="space-y-6">

      {/* Encabezado de la página.
          Antes esto era una franja blanca a todo el ancho: una tercera barra
          apilada bajo el AppBar y los breadcrumbs, repitiendo el título del
          módulo que ya estaba arriba. El fondo y el ancho los pone ahora el
          <main> del Layout. */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutro-800">Órdenes</h1>
          <p className="text-neutro-500 text-sm mt-0.5">Gestión de pedidos locales y domicilios</p>
        </div>
        <button onClick={abrirModal}
          className="flex items-center gap-2 px-5 min-h-toque bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-sm text-sm">
          <Plus className="w-4 h-4" /> Nueva Orden
        </button>
      </div>

      <div className="space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Pendientes',     value: statsOrdenes.pendientes,               icon: <Clock      className="w-5 h-5" />, color: 'from-amber-500 to-amber-600'    },
            { label: 'En Preparación', value: statsOrdenes.preparacion,              icon: <RefreshCw  className="w-5 h-5" />, color: 'from-blue-500 to-blue-600'      },
            { label: 'Listas',         value: statsOrdenes.listas,                   icon: <Check      className="w-5 h-5" />, color: 'from-emerald-500 to-emerald-600' },
            { label: 'Total Hoy',      value: formatCurrency(statsOrdenes.totalHoy), icon: <DollarSign className="w-5 h-5" />, color: 'from-violet-500 to-violet-600'   },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className={`bg-gradient-to-br ${s.color} p-3 rounded-xl shadow-lg`}>
                <div className="text-white">{s.icon}</div>
              </div>
              <div>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="text-xl font-bold text-slate-800">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs + Search */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
            {(['todas', 'local', 'domicilio'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === tab ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                {tab === 'local'     && <Store  className="w-4 h-4" />}
                {tab === 'domicilio' && <MapPin className="w-4 h-4" />}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por número de orden o cliente..."
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <button onClick={loadOrdenes} className="p-2.5 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Grid órdenes agrupadas por estado */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
            <EmptyState message="No hay órdenes" description="Crea una nueva orden para comenzar"
              actionLabel="+ Nueva Orden" onAction={abrirModal} />
          </div>
        ) : (
          <div className="space-y-8">
            {ordenesPorEstado.map(({ codigo, nombre, ordenes: ords }) => {
              const cfg = getEstadoConfig(codigo);
              const esActiva = codigo === 'EN_PREPARACION' || codigo === 'LISTA' || codigo === 'PENDIENTE';
              return (
                <div key={codigo}>
                  {/* ── Encabezado de sección ── */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${cfg.dot}`} />
                    <h2 className={`text-sm font-bold uppercase tracking-widest ${esActiva ? 'text-slate-800' : 'text-slate-400'}`}>
                      {nombre}
                    </h2>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${cfg.cls}`}>
                      {ords.length}
                    </span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>

                  {/* ── Cards ── */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {ords.map(orden => {
                      const codigoOrden = estadoCodigo(orden);
                      const c = getEstadoConfig(codigoOrden);
                      return (
                        <div key={orden.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all overflow-hidden">
                          <div className={`h-1 w-full ${c.dot}`} />
                          <div className="p-5">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-bold text-slate-800">{orden.numero_orden}</h3>
                                  {orden.tipo_orden === 'domicilio' ? <MapPin className="w-4 h-4 text-blue-500" /> : <Store className="w-4 h-4 text-emerald-500" />}
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(orden.fecha_apertura)}</p>
                              </div>
                              {codigoOrden && (
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getEstadoGlobalConfig(codigoOrden as EstadoOrdenGlobal).cls}`}>
                                  {getEstadoGlobalConfig(codigoOrden as EstadoOrdenGlobal).label}
                                </span>
                              )}
                            </div>
                            {orden.nombre_contacto && <p className="text-sm text-slate-600 mb-3 truncate">👤 {orden.nombre_contacto}</p>}
                            <div className="flex items-center justify-between mb-4">
                              <div>
                                <p className="text-xs text-slate-400">{orden.sedes ? 'Sedes' : 'Items'}</p>
                                <p className="font-semibold text-slate-700">
                                  {orden.sedes
                                    ? `${orden.sedes.length} sede${orden.sedes.length !== 1 ? 's' : ''}`
                                    : `${orden.detalles?.length || 0} productos`}
                                </p>
                              </div>
                              <div className="text-right"><p className="text-xs text-slate-400">Total</p><p className="text-lg font-bold text-slate-800">{formatCurrency(orden.total)}</p></div>
                            </div>
                            <button onClick={() => setDetalleOrden(orden)}
                              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-violet-700 transition-all">
                              <Eye className="w-4 h-4" /> Ver Detalle <ArrowRight className="w-4 h-4 ml-auto" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCrear && (
        <CrearOrdenModal estadoInicial={estadoInicial} onClose={cerrarModal} onSave={() => { cerrarModal(); loadOrdenes(); }} />
      )}
      {detalleOrden && (
        <DetalleModal
          orden={detalleOrden}
          estados={estados}
          metodos={metodos}
          onClose={() => setDetalleOrden(null)}
          onEstadoChange={() => { loadOrdenes(); setDetalleOrden(null); }}
        />
      )}
    </div>
  );
};
