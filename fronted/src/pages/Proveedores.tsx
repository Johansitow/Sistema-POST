/**
 * Proveedores - Gestión de proveedores del restaurante
 * CRUD completo + asociación de productos por proveedor
 *
 * v2 — nuevos campos: contacto_whatsapp, sitio_web, calidad_calificacion por producto,
 *      visualización de calificación automática y última entrega
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Search, Edit2, X, Check, RefreshCw, AlertCircle,
  Building2, Phone, Mail, MapPin, Star, Clock, Package,
  ToggleLeft, ToggleRight, Eye, Globe, MessageCircle, ShoppingCart,
  Home, Calendar, History,
} from 'lucide-react';
import { proveedorService, Proveedor, ProveedorCreateDTO, ProveedorProducto } from '../services/servicios-gestion';
import { productosService } from '../services/productos.service';
import { listaComprasService, ListaCompras } from '../services/lista-compras.service';
import { formatCurrency } from '../utils';
import { EmptyState, LoadingScreen, EstadoListaBadge } from '../components/common';
import { Z_INDEX } from '../lib/zIndex';

// ============================================================================
// HELPERS
// ============================================================================
const StarRating: React.FC<{ value: number; max?: number }> = ({ value, max = 5 }) => (
  <div className="flex items-center gap-0.5">
    {Array.from({ length: max }).map((_, i) => (
      <Star key={i} className={`w-3 h-3 ${i < Math.round(value) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}`} />
    ))}
  </div>
);

// ============================================================================
// MODAL PROVEEDOR (crear / editar)
// ============================================================================
const ProveedorModal: React.FC<{
  proveedor?: Proveedor | null;
  onClose: () => void;
  onSave: () => void;
}> = ({ proveedor, onClose, onSave }) => {
  const isEdit = !!proveedor;
  const [form, setForm] = useState<ProveedorCreateDTO>({
    razon_social: '', nit: '', contacto_nombre: '', contacto_telefono: '',
    contacto_whatsapp: '', contacto_email: '', direccion: '', ciudad: '',
    sitio_web: '', calificacion: undefined, tiempo_entrega_promedio: undefined,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    if (proveedor) {
      setForm({
        razon_social: proveedor.razon_social, nit: proveedor.nit || '',
        contacto_nombre: proveedor.contacto_nombre || '', contacto_telefono: proveedor.contacto_telefono || '',
        contacto_whatsapp: proveedor.contacto_whatsapp || '', contacto_email: proveedor.contacto_email || '',
        direccion: proveedor.direccion || '', ciudad: proveedor.ciudad || '',
        sitio_web: proveedor.sitio_web || '', calificacion: proveedor.calificacion,
        tiempo_entrega_promedio: proveedor.tiempo_entrega_promedio,
      });
    }
  }, [proveedor]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value === '' ? undefined : value }));
  };

  const handleSubmit = async () => {
    if (!form.razon_social.trim()) { setError('La razón social es obligatoria'); return; }
    setSaving(true); setError(null);
    try {
      const data = {
        ...form,
        calificacion: form.calificacion ? Number(form.calificacion) : undefined,
        tiempo_entrega_promedio: form.tiempo_entrega_promedio ? Number(form.tiempo_entrega_promedio) : undefined,
      };
      if (isEdit && proveedor) await proveedorService.update(proveedor.id, data);
      else await proveedorService.create(data);
      onSave();
    } catch (e: any) {
      setError(e.message || 'Error al guardar');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className={`px-6 py-4 flex items-center justify-between ${isEdit ? 'bg-gradient-to-r from-violet-600 to-purple-600' : 'bg-gradient-to-r from-blue-600 to-indigo-600'}`}>
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg"><Building2 className="w-5 h-5 text-white" /></div>
            <h2 className="text-white font-bold text-lg">{isEdit ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/20 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Razón Social <span className="text-red-500">*</span></label>
            <input name="razon_social" value={form.razon_social} onChange={handleChange}
              placeholder="Ej: Distribuidora La Cosecha S.A.S"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">NIT</label>
              <input name="nit" value={form.nit || ''} onChange={handleChange} placeholder="900123456-1"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ciudad</label>
              <input name="ciudad" value={form.ciudad || ''} onChange={handleChange} placeholder="Bogotá"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Contacto</p>
            <div className="space-y-3">
              <input name="contacto_nombre" value={form.contacto_nombre || ''} onChange={handleChange} placeholder="Nombre del contacto"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input name="contacto_telefono" value={form.contacto_telefono || ''} onChange={handleChange} placeholder="Teléfono"
                    className="w-full pl-9 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="relative">
                  <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                  <input name="contacto_whatsapp" value={form.contacto_whatsapp || ''} onChange={handleChange} placeholder="WhatsApp"
                    className="w-full pl-9 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input name="contacto_email" value={form.contacto_email || ''} onChange={handleChange} placeholder="Email" type="email"
                  className="w-full pl-9 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <input name="direccion" value={form.direccion || ''} onChange={handleChange} placeholder="Dirección"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input name="sitio_web" value={form.sitio_web || ''} onChange={handleChange} placeholder="https://www.proveedor.com"
                  className="w-full pl-9 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tiempo entrega (días)</label>
              <input name="tiempo_entrega_promedio" type="number" min="1"
                value={form.tiempo_entrega_promedio ?? ''} onChange={handleChange} placeholder="2"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                Calificación inicial
                <span className="text-slate-400 font-normal text-xs">(1–5, auto-calc)</span>
              </label>
              <input name="calificacion" type="number" min="1" max="5" step="0.1"
                value={form.calificacion ?? ''} onChange={handleChange} placeholder="Auto"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              <p className="text-xs text-slate-400 mt-1">Se recalcula automáticamente al asociar productos</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end bg-slate-50">
          <button onClick={onClose} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 transition-all disabled:opacity-50 ${isEdit ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'}`}>
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Proveedor'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MODAL ASOCIAR PRODUCTO
// ============================================================================
const AsociarProductoModal: React.FC<{
  proveedorId: number;
  onClose: () => void;
  onSave: () => void;
}> = ({ proveedorId, onClose, onSave }) => {
  const [productos, setProductos] = useState<any[]>([]);
  const [idProducto, setIdProducto]       = useState('');
  const [precio, setPrecio]               = useState('');
  const [tiempoEntrega, setTiempoEntrega] = useState('');
  const [calidad, setCalidad]             = useState('');
  const [preferido, setPreferido]         = useState(false);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  useEffect(() => {
    productosService.getAll({ limit: 200, estado: 'activo' })
      .then(setProductos)
      .catch(console.error);
  }, []);

  const handleSubmit = async () => {
    if (!idProducto || !precio) { setError('Producto y precio son obligatorios'); return; }
    setSaving(true); setError(null);
    try {
      await proveedorService.asociarProducto(proveedorId, {
        id_producto: Number(idProducto),
        precio_unitario: parseFloat(precio),
        tiempo_entrega: tiempoEntrega ? parseInt(tiempoEntrega) : undefined,
        calidad_calificacion: calidad ? parseFloat(calidad) : undefined,
        es_proveedor_preferido: preferido,
      });
      onSave();
    } catch (e: any) {
      setError(e.message || 'Error al asociar producto');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: Z_INDEX.MODAL_NESTED }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-bold">Asociar Producto</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/20"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl flex items-center gap-2 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Producto *</label>
            <select value={idProducto} onChange={e => setIdProducto(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-teal-500 outline-none">
              <option value="">— Seleccionar —</option>
              {productos.map((p: any) => <option key={p.id} value={p.id}>{p.nombre} ({p.sku})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Precio unitario *</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                <input type="number" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="0"
                  className="w-full pl-6 pr-2 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Entrega (días)</label>
              <input type="number" value={tiempoEntrega} onChange={e => setTiempoEntrega(e.target.value)} placeholder="2"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Calidad (0–5) <span className="text-slate-400 font-normal">— afecta calificación del proveedor</span>
            </label>
            <input type="number" min="0" max="5" step="0.5" value={calidad} onChange={e => setCalidad(e.target.value)} placeholder="Ej: 4.5"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
          </div>
          <label className="flex items-center gap-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer">
            <input type="checkbox" checked={preferido} onChange={e => setPreferido(e.target.checked)} className="w-4 h-4 accent-amber-500" />
            <Star className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-700">Marcar como proveedor preferido</span>
          </label>
        </div>
        <div className="px-5 py-3.5 border-t border-slate-100 flex gap-3 bg-slate-50">
          <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:from-teal-700 hover:to-emerald-700 transition-all disabled:opacity-50">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Guardando...' : 'Asociar'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// DETALLE PROVEEDOR — slide panel
// ============================================================================
const DetalleProveedorPanel: React.FC<{
  proveedor: Proveedor;
  onClose: () => void;
  onEdit: () => void;
  onRefresh: () => void;
}> = ({ proveedor, onClose, onEdit, onRefresh }) => {
  const [productos, setProductos]           = useState<ProveedorProducto[]>([]);
  const [loading, setLoading]               = useState(true);
  const [showAsociar, setShowAsociar]       = useState(false);
  const [listasCompras, setListasCompras]   = useState<ListaCompras[]>([]);
  const [loadingListas, setLoadingListas]   = useState(true);

  const loadProductos = useCallback(() => {
    setLoading(true);
    proveedorService.getProductos(proveedor.id)
      .then(setProductos)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [proveedor.id]);

  useEffect(() => { loadProductos(); }, [loadProductos]);

  useEffect(() => {
    setLoadingListas(true);
    listaComprasService.listar({ id_proveedor: proveedor.id, limit: 5 })
      .then(res => setListasCompras(res.data))
      .catch(console.error)
      .finally(() => setLoadingListas(false));
  }, [proveedor.id]);

  const tieneCalificacion = proveedor.calificacion != null;
  const calScore = Number(proveedor.calificacion ?? 0);
  const esPreferido = productos.some(p => p.es_proveedor_preferido);

  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: Z_INDEX.MODAL_BASE }}>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white w-full max-w-md max-h-[90vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 flex-shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-indigo-200 text-xs font-medium mb-1">Proveedor</p>
                <h2 className="text-white font-bold text-lg leading-tight">{proveedor.razon_social}</h2>
                <div className="flex items-center gap-2 mt-1">
                  {proveedor.nit && <p className="text-indigo-200 text-xs">NIT: {proveedor.nit}</p>}
                  {esPreferido && (
                    <span className="inline-flex items-center gap-1 bg-amber-400/90 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      <Star className="w-2.5 h-2.5 fill-amber-900" /> Preferido
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={onEdit} className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1">
                  <Edit2 className="w-3 h-3" /> Editar
                </button>
                <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/20 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: <Phone className="w-4 h-4 text-blue-500" />,  label: 'Teléfono', value: proveedor.contacto_telefono ? <a href={`tel:${proveedor.contacto_telefono}`} className="hover:underline hover:text-blue-600">{proveedor.contacto_telefono}</a> : '—' },
                { icon: <Mail  className="w-4 h-4 text-violet-500" />, label: 'Email',    value: proveedor.contacto_email ? <a href={`mailto:${proveedor.contacto_email}`} className="hover:underline hover:text-violet-600">{proveedor.contacto_email}</a> : '—' },
                { icon: <MapPin className="w-4 h-4 text-red-500" />,   label: 'Ciudad',   value: proveedor.ciudad           || '—' },
                { icon: <Clock  className="w-4 h-4 text-amber-500" />, label: 'Entrega',  value: proveedor.tiempo_entrega_promedio ? `${proveedor.tiempo_entrega_promedio} días` : '—' },
              ].map(item => (
                <div key={item.label} className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">{item.icon}<p className="text-xs text-slate-500">{item.label}</p></div>
                  <p className="text-sm font-semibold text-slate-700 truncate">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Dirección */}
            {proveedor.direccion && (
              <div className="bg-slate-50 rounded-xl p-3 flex items-start gap-2">
                <Home className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Dirección</p>
                  <p className="text-sm font-semibold text-slate-700">{proveedor.direccion}</p>
                </div>
              </div>
            )}

            {/* Proveedor desde */}
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3 h-3" />
              Proveedor desde {new Date(proveedor.fecha_creacion).toLocaleDateString('es-CO', { year: 'numeric', month: 'long' })}
            </p>

            {/* WhatsApp + Sitio web */}
            {(proveedor.contacto_whatsapp || proveedor.sitio_web) && (
              <div className="flex flex-wrap gap-2">
                {proveedor.contacto_whatsapp && (
                  <a
                    href={`https://wa.me/${proveedor.contacto_whatsapp.replace(/\D/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium hover:bg-green-100 transition-colors">
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </a>
                )}
                {proveedor.sitio_web && (
                  <a
                    href={proveedor.sitio_web} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 font-medium hover:bg-blue-100 transition-colors">
                    <Globe className="w-4 h-4" />
                    Sitio web
                  </a>
                )}
              </div>
            )}

            {/* Calificación automática */}
            {tieneCalificacion ? (
              <div className={`rounded-xl p-4 border ${calScore >= 4 ? 'bg-emerald-50 border-emerald-200' : calScore >= 3 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Calificación automática</p>
                  <p className={`text-xl font-black ${calScore >= 4 ? 'text-emerald-700' : calScore >= 3 ? 'text-amber-700' : 'text-slate-600'}`}>
                    {calScore.toFixed(1)} / 5.0
                  </p>
                </div>
                <StarRating value={calScore} />
                <p className="text-xs text-slate-400 mt-2">
                  Calculada automáticamente: 40% precio, 40% calidad de productos, 20% tiempo de entrega.
                  Se actualiza al asociar o modificar productos.
                </p>
              </div>
            ) : (
              <div className="rounded-xl p-4 border bg-slate-50 border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Calificación automática</p>
                  <span className="text-sm font-semibold text-slate-400">Sin calificar</span>
                </div>
                <p className="text-xs text-slate-400">
                  Aún no hay suficientes datos (productos asociados con calidad y precio) para calcular una calificación.
                  Se generará automáticamente al asociar productos.
                </p>
              </div>
            )}

            {/* Contacto */}
            {proveedor.contacto_nombre && (
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Contacto</p>
                <p className="font-semibold text-slate-700">{proveedor.contacto_nombre}</p>
              </div>
            )}

            {/* Historial de compras */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <History className="w-3.5 h-3.5" /> Historial de compras
                </p>
                <Link to="/listas-compras" className="text-xs text-indigo-600 font-semibold hover:underline">
                  Ver todo →
                </Link>
              </div>
              {loadingListas ? (
                <div className="text-center py-4 text-slate-400 text-sm">Cargando historial...</div>
              ) : listasCompras.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-sm">Sin compras registradas</div>
              ) : (
                <div className="space-y-2">
                  {listasCompras.map(l => (
                    <div key={l.id} className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{l.numero_lista}</p>
                        <p className="text-xs text-slate-400">{new Date(l.fecha_generacion).toLocaleDateString('es-CO')}</p>
                      </div>
                      <div className="text-right flex-shrink-0 flex items-center gap-2">
                        {l.total_estimado != null && <span className="text-sm font-bold text-slate-700">{formatCurrency(l.total_estimado)}</span>}
                        <EstadoListaBadge estado={l.estado} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Productos asociados */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-3.5 h-3.5" /> Productos ({productos.length})
                </p>
                <button onClick={() => setShowAsociar(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold transition-colors">
                  <Plus className="w-3 h-3" /> Asociar
                </button>
              </div>
              {loading ? (
                <div className="text-center py-4 text-slate-400 text-sm">Cargando productos...</div>
              ) : productos.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Sin productos asociados</p>
                  <button onClick={() => setShowAsociar(true)} className="mt-2 text-teal-600 text-xs font-semibold hover:underline">
                    + Asociar primer producto
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {productos.map(rel => (
                    <div key={rel.id_producto} className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{rel.producto?.nombre}</p>
                          <p className="text-xs text-slate-400">{rel.producto?.sku} · {rel.producto?.categoria?.nombre || 'Sin categoría'}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-slate-700">{formatCurrency(rel.precio_unitario)}</p>
                          {rel.es_proveedor_preferido && <span className="text-xs text-amber-600 font-medium">⭐ Preferido</span>}
                        </div>
                      </div>
                      {/* Calidad + Última entrega */}
                      <div className="flex items-center gap-3 mt-2">
                        {rel.calidad_calificacion != null && (
                          <div className="flex items-center gap-1">
                            <StarRating value={Number(rel.calidad_calificacion)} />
                            <span className="text-xs text-slate-500">{Number(rel.calidad_calificacion).toFixed(1)}</span>
                          </div>
                        )}
                        {rel.fecha_ultima_entrega && (
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(rel.fecha_ultima_entrega).toLocaleDateString('es-CO')}
                          </span>
                        )}
                        {rel.tiempo_entrega && (
                          <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md">
                            {rel.tiempo_entrega}d
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showAsociar && (
        <AsociarProductoModal
          proveedorId={proveedor.id}
          onClose={() => setShowAsociar(false)}
          onSave={() => { setShowAsociar(false); loadProductos(); onRefresh(); }}
        />
      )}
    </>
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export const Proveedores: React.FC = () => {
  const [proveedores, setProveedores]       = useState<Proveedor[]>([]);
  const [loading, setLoading]               = useState(true);
  const [searchTerm, setSearchTerm]         = useState('');
  const [showModal, setShowModal]           = useState(false);
  const [editTarget, setEditTarget]         = useState<Proveedor | null>(null);
  const [detalleTarget, setDetalleTarget]   = useState<Proveedor | null>(null);
  const [meta, setMeta]                     = useState<any>(null);
  const [page, setPage]                     = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await proveedorService.getAll({ search: searchTerm || undefined, page, limit: 20 });
      setProveedores(res.data);
      setMeta(res.meta);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [searchTerm, page]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggleEstado = async (p: Proveedor) => {
    try {
      await proveedorService.cambiarEstado(p.id, p.estado === 'activo' ? 'inactivo' : 'activo');
      loadData();
    } catch (e) { console.error(e); }
  };

  if (loading && proveedores.length === 0) return <LoadingScreen message="Cargando proveedores..." />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100">

      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Proveedores</h1>
            <p className="text-slate-500 text-sm mt-0.5">Gestión de proveedores e insumos</p>
          </div>
          <button onClick={() => { setEditTarget(null); setShowModal(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg text-sm">
            <Plus className="w-4 h-4" /> Nuevo Proveedor
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">

        {/* Stats rápidos */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total',     value: meta?.total || proveedores.length,                     color: 'from-blue-500 to-blue-600'       },
            { label: 'Activos',   value: proveedores.filter(p => p.estado === 'activo').length,  color: 'from-emerald-500 to-emerald-600' },
            { label: 'Inactivos', value: proveedores.filter(p => p.estado !== 'activo').length,  color: 'from-slate-400 to-slate-500'     },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className={`bg-gradient-to-br ${s.color} w-10 h-10 rounded-xl flex items-center justify-center shadow-lg`}>
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="text-2xl font-bold text-slate-800">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Búsqueda */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadData()}
              placeholder="Buscar por razón social, NIT o contacto..."
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <button onClick={loadData} className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all">Buscar</button>
          <button onClick={loadData} className="p-2.5 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors"><RefreshCw className="w-4 h-4" /></button>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                  {['Proveedor', 'Contacto', 'Ciudad', 'Calificación', 'Productos', 'Estado', 'Acciones'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {proveedores.length === 0 ? (
                  <tr><td colSpan={7}><EmptyState message="No hay proveedores" description="Registra tu primer proveedor" actionLabel="+ Nuevo Proveedor" onAction={() => setShowModal(true)} /></td></tr>
                ) : proveedores.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{p.razon_social}</p>
                          {p.nit && <p className="text-xs text-slate-400">NIT: {p.nit}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm text-slate-600">{p.contacto_nombre || <span className="text-slate-400 italic">—</span>}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {p.contacto_telefono && <span className="text-xs text-slate-400">{p.contacto_telefono}</span>}
                        {p.contacto_whatsapp && (
                          <a href={`https://wa.me/${p.contacto_whatsapp.replace(/\D/g, '')}`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-0.5 text-xs text-green-600 hover:text-green-700 transition-colors"
                            title={`WhatsApp: ${p.contacto_whatsapp}`}>
                            <MessageCircle className="w-3 h-3" /> WA
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4"><span className="text-sm text-slate-600">{p.ciudad || '—'}</span></td>
                    <td className="px-5 py-4">
                      {p.calificacion ? (
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            <span className="text-sm font-bold text-slate-700">{Number(p.calificacion).toFixed(1)}</span>
                            <span className="text-xs text-slate-400">/ 5.0</span>
                          </div>
                          <StarRating value={Number(p.calificacion)} />
                          <p className="text-xs text-slate-400 mt-0.5">Auto-calculada</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                        <ShoppingCart className="w-3 h-3" /> {p._count?.productos || 0}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button onClick={() => handleToggleEstado(p)} className="flex items-center gap-1.5 text-xs font-semibold transition-colors">
                        {p.estado === 'activo'
                          ? <><ToggleRight className="w-5 h-5 text-emerald-500" /><span className="text-emerald-600">Activo</span></>
                          : <><ToggleLeft  className="w-5 h-5 text-slate-400"   /><span className="text-slate-500">Inactivo</span></>}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setDetalleTarget(p)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Ver detalle">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setEditTarget(p); setShowModal(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {meta && meta.totalPages > 1 && (
            <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <p className="text-sm text-slate-500"><span className="font-semibold">{meta.total}</span> proveedores</p>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition-colors">Anterior</button>
                <span className="px-3 py-1.5 text-xs text-slate-600">{page} / {meta.totalPages}</span>
                <button disabled={page === meta.totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition-colors">Siguiente</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <ProveedorModal
          proveedor={editTarget}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
          onSave={() => { setShowModal(false); setEditTarget(null); loadData(); }}
        />
      )}
      {detalleTarget && (
        <DetalleProveedorPanel
          proveedor={detalleTarget}
          onClose={() => setDetalleTarget(null)}
          onEdit={() => { setEditTarget(detalleTarget); setDetalleTarget(null); setShowModal(true); }}
          onRefresh={loadData}
        />
      )}
    </div>
  );
};
