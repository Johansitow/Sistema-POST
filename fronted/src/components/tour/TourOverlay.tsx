/**
 * TourOverlay — orquestador visual del modo tutorial.
 *
 * Lee el tourStore y, mientras el tour está activo, pinta el paso actual:
 *   · Paso anclado  → capa oscura con un "agujero" (spotlight) recortado sobre el
 *                     elemento resaltado + tooltip posicionado al lado.
 *   · Paso centrado → tarjeta de bienvenida/cierre dentro del Modal accesible común.
 *
 * El agujero se logra con un box-shadow gigante sobre un div del tamaño del target
 * (misma técnica ligera que usan las librerías de tours), sin recortes SVG. Una
 * capa transparente por debajo bloquea los clics al fondo para que el usuario siga
 * el recorrido con los botones. Numeración y flip básico del tooltip incluidos.
 */

import { Modal } from '../common/Modal';
import { Z_INDEX } from '../../lib/zIndex';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useTourStore, pasoVisible } from '../../store/tourStore';
import { useTourTarget, type RectTour } from './useTourTarget';
import { TourTooltip } from './TourTooltip';

const TOOLTIP_W = 320;
const ALTO_EST = 220; // alto estimado del tooltip, solo para decidir el flip
const HUECO = 6;      // holgura del spotlight alrededor del elemento
const GAP = 14;       // separación tooltip ↔ elemento

type Lado = 'top' | 'bottom' | 'left' | 'right';

/** Posición del tooltip respecto al rect, con flip si no cabe en el viewport. */
function posicionTooltip(rect: RectTour, preferida: Lado): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let lado = preferida;

  if (lado === 'bottom' && rect.top + rect.height + GAP + ALTO_EST > vh) lado = 'top';
  if (lado === 'top' && rect.top - GAP - ALTO_EST < 0) lado = 'bottom';
  if (lado === 'right' && rect.left + rect.width + GAP + TOOLTIP_W > vw) lado = 'left';
  if (lado === 'left' && rect.left - GAP - TOOLTIP_W < 0) lado = 'right';

  let top = rect.top;
  let left = rect.left;
  switch (lado) {
    case 'top':    top = rect.top - GAP - ALTO_EST;      left = rect.left; break;
    case 'bottom': top = rect.top + rect.height + GAP;   left = rect.left; break;
    case 'left':   top = rect.top;                        left = rect.left - GAP - TOOLTIP_W; break;
    case 'right':  top = rect.top;                        left = rect.left + rect.width + GAP; break;
  }

  // Mantener el tooltip dentro de la pantalla.
  left = Math.min(Math.max(8, left), vw - TOOLTIP_W - 8);
  top = Math.min(Math.max(8, top), vh - 8);
  return { top, left };
}

export function TourOverlay() {
  const { activo, pasos, indice, siguiente, anterior, omitir } = useTourStore();

  useEscapeKey(omitir, activo);

  const paso = pasos[indice];
  const rect = useTourTarget(activo ? paso?.target : undefined);

  if (!activo || !paso) return null;

  // Numeración sobre los pasos VISIBLES (los saltados no cuentan).
  const total = pasos.filter(pasoVisible).length;
  const numero = pasos.slice(0, indice + 1).filter(pasoVisible).length;

  // Extremos del recorrido, en términos de visibilidad.
  const esPrimero = !pasos.slice(0, indice).some(pasoVisible);
  const esUltimo = !pasos.slice(indice + 1).some(pasoVisible);

  const tarjeta = (
    <TourTooltip
      paso={paso}
      numero={numero}
      total={total}
      esPrimero={esPrimero}
      esUltimo={esUltimo}
      onAnterior={anterior}
      onSiguiente={siguiente}
      onOmitir={omitir}
    />
  );

  // Paso centrado: bienvenida/cierre, o fallback si el elemento desapareció.
  if (!paso.target || !rect) {
    return (
      <Modal titulo={paso.titulo} onClose={omitir} ancho="sm" cerrarAlTocarFondo={false}>
        {tarjeta}
      </Modal>
    );
  }

  const pos = posicionTooltip(rect, paso.posicion ?? 'bottom');

  return (
    <>
      {/* Capa que bloquea clics al fondo (transparente; el oscurecido lo hace el
          spotlight con su box-shadow). */}
      <div
        className="fixed inset-0"
        style={{ zIndex: Z_INDEX.TOUR }}
        aria-hidden="true"
      />

      {/* Spotlight: recorta el "agujero" oscureciendo todo lo demás. */}
      <div
        data-testid="tour-spotlight"
        className="fixed rounded-xl"
        style={{
          top: rect.top - HUECO,
          left: rect.left - HUECO,
          width: rect.width + HUECO * 2,
          height: rect.height + HUECO * 2,
          boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.6)',
          zIndex: Z_INDEX.TOUR,
          pointerEvents: 'none',
          transition: 'all 0.2s ease',
        }}
      />

      {/* Tooltip anclado */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={paso.titulo}
        className="fixed"
        style={{ top: pos.top, left: pos.left, zIndex: Z_INDEX.TOUR }}
      >
        {tarjeta}
      </div>
    </>
  );
}

export default TourOverlay;
