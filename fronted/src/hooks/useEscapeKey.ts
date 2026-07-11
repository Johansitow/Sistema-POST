/**
 * useEscapeKey — cierra un modal/panel al presionar ESC
 *
 * Uso:
 *   useEscapeKey(onClose);                 // activo mientras el componente esté montado
 *   useEscapeKey(onClose, open);            // activo solo mientras `open` sea true
 */

import { useEffect } from 'react';

export function useEscapeKey(onClose: () => void, activo: boolean = true): void {
  useEffect(() => {
    if (!activo) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, activo]);
}
