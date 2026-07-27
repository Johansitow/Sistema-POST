/**
 * TourTooltip — la tarjeta de un paso del tour (contenido + controles).
 *
 * Componente presentacional puro: no sabe de posicionamiento ni de spotlight.
 * Lo coloca TourOverlay, ya sea anclado a un elemento o centrado (bienvenida/
 * cierre). Usa los tokens de marca vía clases Tailwind (brand-*, neutro-*).
 */

import type { PasoTour } from '../../lib/tour/pasos';

interface TourTooltipProps {
  paso: PasoTour;
  /** Posición 1-based del paso dentro de los visibles. */
  numero: number;
  /** Total de pasos visibles. */
  total: number;
  esPrimero: boolean;
  esUltimo: boolean;
  onAnterior: () => void;
  onSiguiente: () => void;
  onOmitir: () => void;
}

export function TourTooltip({
  paso, numero, total, esPrimero, esUltimo, onAnterior, onSiguiente, onOmitir,
}: TourTooltipProps) {
  return (
    <div className="w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl bg-white shadow-lg overflow-hidden">
      {/* Franja de progreso: barra + contador */}
      <div className="h-1 w-full bg-neutro-100">
        <div
          className="h-full bg-brand-500 transition-all duration-300"
          style={{ width: `${(numero / total) * 100}%` }}
        />
      </div>

      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
          Paso {numero} de {total}
        </p>
        <h3 className="mt-1 text-lg font-bold text-neutro-900">{paso.titulo}</h3>
        <p className="mt-2 text-sm leading-relaxed text-neutro-600">{paso.contenido}</p>

        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onOmitir}
            className="text-sm font-medium text-neutro-500 hover:text-neutro-700"
          >
            Omitir
          </button>

          <div className="flex items-center gap-2">
            {!esPrimero && (
              <button
                type="button"
                onClick={onAnterior}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-neutro-700 hover:bg-neutro-100"
              >
                Anterior
              </button>
            )}
            <button
              type="button"
              onClick={onSiguiente}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600"
            >
              {esUltimo ? 'Finalizar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TourTooltip;
