/**
 * ClienteFormModal — formulario completo de creación/edición de cliente.
 *
 * Compartido entre el módulo de Clientes (crear/editar) y el registro rápido
 * desde Órdenes (crear, sin salir del pedido en curso) — misma pantalla en
 * ambos casos, para que no diverjan visualmente con el tiempo.
 */

import React, { useState } from 'react';
import { RefreshCw, Check } from 'lucide-react';
import ModalHeader from './ModalHeader';
import { Modal } from './Modal';
import { ErrorAlert } from './ErrorAlert';
import { clienteService } from '../../services/cliente.service';
import { getErrorMessage } from '../../services/api';
import { toast } from '../../store/uiStore';

const FORM_INITIAL = {
  nombre_completo: '', email: '', telefono: '', telefono_alterno: '',
  direccion: '', ciudad: '', barrio: '', tipo_cliente: 'regular', notas: '',
  canal_adquisicion: '', puntos_bienvenida: false,
};

// El <label> ahora se asocia al <input> con htmlFor/id. Antes eran hermanos
// sueltos: un lector de pantalla leía el campo como "cuadro de texto" sin
// nombre, y hacer clic en la etiqueta no enfocaba el campo. El mensaje de
// error se enlaza con aria-describedby y el campo se marca con aria-invalid.
const Field: React.FC<{
  label: string; name: string; type?: string; placeholder?: string; required?: boolean;
  form: Record<string, any>; errors: Record<string, string>; set: (k: string, v: any) => void;
}> = ({ label, name, type = 'text', placeholder, required, form, errors, set }) => {
  const campoId = `cliente-${name}`;
  const errorId = `${campoId}-error`;
  const tieneError = Boolean(errors[name]);

  return (
    <div>
      <label htmlFor={campoId} className="block text-xs font-semibold text-neutro-500 mb-1.5">
        {label}{required && <span className="text-peligro-500 ml-1" aria-hidden="true">*</span>}
      </label>
      <input
        id={campoId}
        type={type}
        required={required}
        aria-invalid={tieneError || undefined}
        aria-describedby={tieneError ? errorId : undefined}
        value={form[name] || ''}
        onChange={e => set(name, e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 min-h-toque border rounded-xl text-sm outline-none transition-colors
          focus:ring-2 focus:ring-brand-500 focus:border-brand-400
          ${tieneError ? 'border-peligro-300 bg-peligro-50' : 'border-neutro-200 bg-white hover:border-neutro-300'}`}
      />
      {tieneError && <p id={errorId} className="text-xs text-peligro-600 mt-1">{errors[name]}</p>}
    </div>
  );
};

export const ClienteFormModal: React.FC<{
  /** Cliente a editar. Si se pasa, el formulario entra en modo edición. */
  cliente?: Record<string, any> | null;
  /** Valores para prellenar en modo creación (ej. nombre ya escrito en un buscador). Ignorado en modo edición. */
  initialValues?: Partial<typeof FORM_INITIAL>;
  onClose: () => void;
  onSaved: (cliente: any) => void;
}> = ({ cliente, initialValues, onClose, onSaved }) => {
  // El cierre con Escape lo gestiona <Modal>, junto con el focus trap,
  // el scroll lock y la devolución del foco.
  const [form, setForm]     = useState({ ...FORM_INITIAL, ...(cliente || initialValues || {}) });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEdit = !!cliente;

  const set = (k: string, v: any) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.nombre_completo.trim()) e.nombre_completo = 'Requerido';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email inválido';
    if (!form.telefono?.trim()) e.telefono = 'El teléfono es obligatorio';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      let saved;
      if (isEdit) {
        saved = await clienteService.update(cliente!.id, form as any);
        toast.success('Cliente actualizado');
      } else {
        saved = await clienteService.create(form as any);
        toast.success('Cliente creado');
      }
      onSaved(saved);
      onClose();
    } catch (err: any) {
      const msg = getErrorMessage(err);
      setErrors({ _general: msg });
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      titulo={isEdit ? `Editar cliente ${cliente!.nombre_completo}` : 'Registrar cliente'}
      onClose={onClose}
      ancho="lg"
      // Es un formulario con datos escritos: un clic fuera no debe descartarlos.
      cerrarAlTocarFondo={false}
      className="max-h-[90vh] flex flex-col"
    >
        {/* Header */}
        <ModalHeader
          title={isEdit ? cliente!.nombre_completo : 'Registrar cliente'}
          subtitle={isEdit ? 'Editar' : 'Nuevo cliente'}
          onClose={onClose}
        />

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-5">
          {errors._general && <ErrorAlert message={errors._general} />}

          {/* Datos personales */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Datos personales</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Field label="Nombre completo" name="nombre_completo" placeholder="Ej: María García López" required form={form} errors={errors} set={set} />
              </div>
              <Field label="Email" name="email" type="email" placeholder="cliente@email.com" form={form} errors={errors} set={set} />
              <Field label="Teléfono" name="telefono" placeholder="+57 300 000 0000" required form={form} errors={errors} set={set} />
              <Field label="Teléfono alterno" name="telefono_alterno" placeholder="Opcional" form={form} errors={errors} set={set} />
            </div>
          </div>

          {/* Dirección */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Ubicación</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Field label="Dirección" name="direccion" placeholder="Calle 123 # 45-67" form={form} errors={errors} set={set} />
              </div>
              <Field label="Ciudad" name="ciudad" placeholder="Bogotá" form={form} errors={errors} set={set} />
              <Field label="Barrio" name="barrio" placeholder="Chapinero" form={form} errors={errors} set={set} />
            </div>
          </div>

          {/* Clasificación */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Clasificación</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Tipo de cliente</label>
                <select
                  value={form.tipo_cliente}
                  onChange={e => set('tipo_cliente', e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option value="regular">Regular</option>
                  <option value="frecuente">Frecuente</option>
                  <option value="vip">VIP</option>
                  <option value="corporativo">Corporativo</option>
                  <option value="delivery">Delivery</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Canal de adquisición</label>
                <select
                  value={form.canal_adquisicion}
                  onChange={e => set('canal_adquisicion', e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option value="">No especificado</option>
                  <option value="walk-in">Walk-in</option>
                  <option value="referido">Referido</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="rappi">Rappi</option>
                  <option value="ifood">iFood</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notas */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Notas internas</p>
            <textarea
              value={form.notas || ''}
              onChange={e => set('notas', e.target.value)}
              placeholder="Preferencias, alergias, notas del staff..."
              rows={3}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-teal-500 hover:border-slate-300 transition-all"
            />
          </div>

          {/* Puntos de bienvenida (solo al crear) */}
          {!isEdit && (
            <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-violet-800">Puntos de bienvenida</p>
                <p className="text-xs text-violet-600">Otorgar 50 puntos al registrarse</p>
              </div>
              <button
                onClick={() => set('puntos_bienvenida', !form.puntos_bienvenida)}
                className={`w-12 h-6 rounded-full transition-colors relative ${form.puntos_bienvenida ? 'bg-violet-500' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.puntos_bienvenida ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutro-100 flex justify-end gap-3 shrink-0 bg-neutro-50/50">
          <button onClick={onClose} className="px-5 min-h-toque text-sm border border-neutro-200 rounded-xl text-neutro-600 hover:bg-neutro-100 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 min-h-toque text-sm bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Registrar cliente'}
          </button>
        </div>
    </Modal>
  );
};
