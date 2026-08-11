/**
 * useConexion — estado reactivo de conexión de red (navigator.onLine + eventos).
 */

import { useSyncExternalStore } from 'react';

function subscribe(cb: () => void): () => void {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

/** true si hay conexión de red. En SSR/arranque asume online. */
export function useConexion(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

/** Contador reactivo de ventas pendientes de sincronizar. */
import { useEffect, useState } from 'react';
import { contar } from '../lib/offline/cola';

export function usePendientesOffline(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const refrescar = () => { contar().then(setN).catch(() => {}); };
    refrescar();
    window.addEventListener('offline-cola', refrescar);
    window.addEventListener('offline-sync', refrescar);
    return () => {
      window.removeEventListener('offline-cola', refrescar);
      window.removeEventListener('offline-sync', refrescar);
    };
  }, []);
  return n;
}
