/**
 * qz.ts — Transporte a la impresora térmica vía QZ Tray (agente local).
 * La web se conecta por WebSocket al agente instalado en el equipo del negocio,
 * que reenvía los bytes ESC/POS a la impresora (USB/red).
 *
 * Sin certificado de firma configurado, QZ pide permiso una vez por sesión
 * (firma para impresión 100% silenciosa en producción = follow-up). Nunca lanza
 * en `disponible()`: si QZ no está, el dispatcher hace fallback al navegador.
 */

import qz from 'qz-tray';

const Q = qz as any;

function bytesABase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

let conectando: Promise<unknown> | null = null;
async function asegurarConexion(): Promise<void> {
  if (Q.websocket.isActive()) return;
  if (!conectando) conectando = Q.websocket.connect().finally(() => { conectando = null; });
  await conectando;
}

export const qzImpresora = {
  async disponible(): Promise<boolean> {
    try { await asegurarConexion(); return Q.websocket.isActive(); }
    catch { return false; }
  },

  async listarImpresoras(): Promise<string[]> {
    await asegurarConexion();
    const r = await Q.printers.find();
    return Array.isArray(r) ? r : [r].filter(Boolean);
  },

  async imprimir(bytes: Uint8Array, printer: string): Promise<void> {
    await asegurarConexion();
    const config = Q.configs.create(printer);
    await Q.print(config, [{ type: 'raw', format: 'base64', data: bytesABase64(bytes) }]);
  },
};
