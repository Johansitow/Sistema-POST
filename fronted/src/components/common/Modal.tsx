/**
 * Modal — diálogo accesible, único para toda la app.
 *
 * ── El problema ─────────────────────────────────────────────────────────────
 *
 * Había 10 modales construidos a mano con `<div className="fixed inset-0">`
 * (Órdenes, Clientes, Proveedores, Facturas, ListaCompras, ProductosTab,
 * LotesTab, DevolucionModal, ClienteFormModal, Auditoría). De los diez:
 *
 *   · 0 tenían focus trap    → con Tab te salías del modal hacia la página de
 *                              atrás, sin ver dónde estaba el foco
 *   · 0 tenían scroll lock   → la página seguía haciendo scroll por detrás
 *   · 0 declaraban aria-modal → un lector de pantalla seguía leyendo el fondo
 *   · 0 devolvían el foco    → al cerrar, el foco volvía al <body> y había que
 *                              tabular desde el principio
 *
 * Nueve de diez sí cerraban con Escape, vía useEscapeKey.
 *
 * ── Qué hace este componente ────────────────────────────────────────────────
 *
 * Cubre las cuatro carencias y reutiliza lo que ya existía: useEscapeKey para
 * el cierre con teclado y Z_INDEX para el orden de capas. El contenido visual
 * (encabezado, cuerpo, pie) lo sigue poniendo cada pantalla — esto es el
 * contenedor, no una plantilla.
 */

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { Z_INDEX } from '../../lib/zIndex';

// ── Scroll lock ───────────────────────────────────────────────────────────────
//
// Se cuenta cuántos modales hay abiertos porque se anidan: en Órdenes, el modal
// de pago se abre encima del de detalle. Si cada uno restaurase el overflow al
// cerrarse, cerrar el de arriba desbloquearía el scroll con el de abajo aún
// abierto.

let modalesAbiertos = 0;

function bloquearScroll(): () => void {
  if (modalesAbiertos === 0) {
    const anchoBarra = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    // Compensa la barra de scroll que acaba de desaparecer; sin esto el
    // contenido da un salto lateral al abrir el modal.
    if (anchoBarra > 0) document.body.style.paddingRight = `${anchoBarra}px`;
  }
  modalesAbiertos += 1;

  return () => {
    modalesAbiertos -= 1;
    if (modalesAbiertos === 0) {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
  };
}

// ── Focus trap ────────────────────────────────────────────────────────────────

const FOCUSABLES = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Elementos enfocables dentro del panel, en orden de tabulación.
 *
 * Ojo con `offsetParent` para detectar visibilidad: devuelve null para todo lo
 * que esté dentro de un contenedor `position: fixed` — que es exactamente lo
 * que es un modal — y en jsdom devuelve null siempre, porque no calcula layout.
 * Se filtra por atributos, que es fiable en ambos entornos.
 */
function focusables(raiz: HTMLElement): HTMLElement[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>(FOCUSABLES)).filter(el => {
    if (el.hasAttribute('hidden')) return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    // checkVisibility existe en navegadores modernos y capta display:none o
    // visibility:hidden heredados; en jsdom no existe y se omite.
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility()) return false;
    return true;
  });
}

// ── Componente ────────────────────────────────────────────────────────────────

export type AnchoModal = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const ANCHOS: Record<AnchoModal, string> = {
  sm:   'max-w-sm',
  md:   'max-w-md',
  lg:   'max-w-xl',
  xl:   'max-w-4xl',
  full: 'max-w-[95vw]',
};

interface ModalProps {
  /** Título accesible. Se anuncia al abrir; si el encabezado es visual, pásalo igual. */
  titulo: string;
  onClose: () => void;
  children: ReactNode;
  ancho?: AnchoModal;
  /** true cuando este modal se abre sobre otro (ej: pago sobre detalle de orden). */
  anidado?: boolean;
  /** Permite cerrar tocando el fondo. Desactívalo en formularios con datos sin guardar. */
  cerrarAlTocarFondo?: boolean;
  /** Clases extra para el panel (ej: 'flex flex-col' cuando el cuerpo hace scroll). */
  className?: string;
}

export function Modal({
  titulo,
  onClose,
  children,
  ancho = 'md',
  anidado = false,
  cerrarAlTocarFondo = true,
  className = '',
}: ModalProps) {
  const panelRef  = useRef<HTMLDivElement>(null);
  const tituloId  = useId();

  useEscapeKey(onClose);

  // Scroll lock mientras el modal viva.
  useEffect(bloquearScroll, []);

  // Foco: se guarda quién lo tenía, se mueve al modal, y al cerrar se devuelve.
  // Sin esto, tras cerrar un modal había que tabular desde el principio de la
  // página para volver al botón que lo abrió.
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    if (panel) {
      const primero = focusables(panel)[0];
      (primero ?? panel).focus();
    }

    return () => previo?.focus?.();
  }, []);

  // Atrapa el Tab dentro del modal.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !panelRef.current) return;

      const items = focusables(panelRef.current);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }

      const primero = items[0];
      const ultimo  = items[items.length - 1];
      const activo  = document.activeElement;

      // Al llegar al borde, se envuelve al otro extremo en vez de salir al fondo.
      if (e.shiftKey && (activo === primero || !panelRef.current.contains(activo))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: anidado ? Z_INDEX.MODAL_NESTED : Z_INDEX.MODAL_BASE }}
    >
      {/* Fondo. aria-hidden porque no aporta nada a un lector de pantalla: el
          cierre por teclado ya lo cubre Escape. */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
        onClick={cerrarAlTocarFondo ? onClose : undefined}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        className={`relative bg-white rounded-2xl shadow-lg w-full ${ANCHOS[ancho]} overflow-hidden outline-none ${className}`}
      >
        {/* Título accesible. Va oculto visualmente porque cada pantalla dibuja
            su propio encabezado; lo que importa es que el lector de pantalla
            anuncie de qué es este diálogo al abrirlo. */}
        <span id={tituloId} className="sr-only">{titulo}</span>
        {children}
      </div>
    </div>
  );
}

export default Modal;
