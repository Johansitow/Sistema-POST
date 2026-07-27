/**
 * useTourTarget — resuelve el elemento de un paso y expone su posición reactiva.
 *
 * Devuelve el DOMRect del elemento que hace match con `selector`, recalculándolo
 * en scroll y resize (y tras un frame, para dar tiempo a que el layout se asiente).
 * Antes de medir hace `scrollIntoView` para que el target quede a la vista. Si el
 * selector es undefined (tarjeta centrada) o no hay match, devuelve null.
 */

import { useEffect, useState } from 'react';

export interface RectTour {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function useTourTarget(selector: string | undefined): RectTour | null {
  const [rect, setRect] = useState<RectTour | null>(null);

  useEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }

    let raf = 0;

    const medir = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    // Trae el target a la vista antes de la primera medición.
    const el = document.querySelector(selector) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });

    const reprogramar = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(medir);
    };

    reprogramar();
    window.addEventListener('resize', reprogramar);
    // capture:true para captar scroll de contenedores internos, no solo el de window.
    window.addEventListener('scroll', reprogramar, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', reprogramar);
      window.removeEventListener('scroll', reprogramar, true);
    };
  }, [selector]);

  return rect;
}
