/**
 * Captcha — widget de Cloudflare Turnstile para los formularios públicos sensibles
 * (registro, olvidé contraseña).
 *
 * Provider por env: si `VITE_TURNSTILE_SITE_KEY` no está definida (dev), el
 * componente NO se renderiza y NO bloquea el envío. En producción, con la site key,
 * muestra el widget y entrega el token al padre vía `onToken`.
 */

import { useEffect, useRef } from 'react';

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

// Turnstile expone un objeto global `turnstile` una vez cargado el script.
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: {
        sitekey: string;
        callback: (token: string) => void;
        'expired-callback'?: () => void;
        'error-callback'?: () => void;
      }) => string;
      remove: (id: string) => void;
    };
  }
}

/** Carga el script de Turnstile una sola vez y resuelve cuando `window.turnstile` existe. */
function cargarScript(): Promise<void> {
  return new Promise((resolve) => {
    if (window.turnstile) return resolve();
    const existente = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existente) {
      existente.addEventListener('load', () => resolve());
      return;
    }
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.addEventListener('load', () => resolve());
    document.head.appendChild(s);
  });
}

interface CaptchaProps {
  onToken: (token: string) => void;
}

export function Captcha({ onToken }: CaptchaProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!SITE_KEY) return; // dev: sin site key no se renderiza
    let widgetId: string | undefined;
    let cancelado = false;

    cargarScript().then(() => {
      if (cancelado || !ref.current || !window.turnstile) return;
      widgetId = window.turnstile.render(ref.current, {
        sitekey: SITE_KEY,
        callback: (token) => onToken(token),
        'expired-callback': () => onToken(''),
        'error-callback':   () => onToken(''),
      });
    });

    return () => {
      cancelado = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
    // onToken se asume estable (definido en el padre); no re-montamos el widget por él.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={ref} style={{ marginTop: 8 }} />;
}
