/**
 * OfflineBanner — barra de estado de conexión y sincronización.
 * Se muestra cuando no hay red o hay ventas pendientes de sincronizar.
 * También arranca el auto-sync (al montar, una vez por app).
 */

import { useEffect } from 'react';
import { WifiOff, RefreshCw, CloudUpload } from 'lucide-react';
import { useConexion, usePendientesOffline } from '../../hooks/useConexion';
import { iniciarAutoSync, sincronizarPendientes } from '../../lib/offline/sync';

export default function OfflineBanner() {
  const online = useConexion();
  const pendientes = usePendientesOffline();

  useEffect(() => iniciarAutoSync(), []);

  if (online && pendientes === 0) return null;

  return (
    <div
      className={`fixed top-0 inset-x-0 z-[1300] flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-semibold text-white ${
        online ? 'bg-amber-500' : 'bg-slate-700'
      }`}
      role="status"
    >
      {!online && (
        <span className="flex items-center gap-1.5">
          <WifiOff className="w-3.5 h-3.5" /> Sin conexión — las ventas se guardan y se sincronizarán al reconectar
        </span>
      )}
      {pendientes > 0 && (
        <button
          onClick={() => sincronizarPendientes()}
          disabled={!online}
          className="flex items-center gap-1.5 underline underline-offset-2 disabled:no-underline disabled:opacity-80"
          title={online ? 'Sincronizar ahora' : 'Se sincronizará al reconectar'}
        >
          {online ? <RefreshCw className="w-3.5 h-3.5" /> : <CloudUpload className="w-3.5 h-3.5" />}
          {pendientes} venta{pendientes === 1 ? '' : 's'} por sincronizar
        </button>
      )}
    </div>
  );
}
