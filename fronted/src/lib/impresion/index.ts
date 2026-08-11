/**
 * index.ts — Dispatcher de impresión térmica.
 *
 * Cada `imprimir*` construye ESC/POS y lo envía por QZ Tray (o el driver
 * simulado en dev). Devuelve `true` si imprimió por térmica; `false` si no había
 * impresora térmica disponible, para que el call-site haga **fallback** al
 * `window.print()` actual — así nada se rompe si el negocio no tiene QZ Tray.
 */

import { recibo, comanda, cierre, kickCajon, type ConfigTicket, type FEParaTicket, type CierreData } from './documentos';
import { qzImpresora } from './qz';
import { impresoraSimulada } from './simulada';
import type { PrintOrden, PrintPago, PrintNegocio } from '../plantillas/ticketRenderer';

export interface ConfigImpresora extends ConfigTicket {
  /** 'termica' usa QZ/simulada; 'navegador' deja el flujo HTML actual. */
  modo:         'navegador' | 'termica';
  impresora?:   string;
  abrir_cajon?: boolean;
  /** dev sin hardware: descarga el .escpos en vez de exigir QZ. */
  simular?:     boolean;
}

async function enviar(bytes: Uint8Array, cfg: ConfigImpresora): Promise<boolean> {
  const drv = cfg.simular ? impresoraSimulada : qzImpresora;
  if (!cfg.simular && !(await drv.disponible())) return false; // → fallback navegador
  try {
    await drv.imprimir(bytes, cfg.impresora ?? '');
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[impresion] fallo al imprimir por térmica:', e);
    return false;
  }
}

/** ¿La config indica imprimir por térmica? (si no, el call-site usa el navegador). */
export function esTermica(cfg?: Partial<ConfigImpresora>): boolean {
  return cfg?.modo === 'termica';
}

export async function imprimirRecibo(
  orden: PrintOrden, pagos: PrintPago[], negocio: PrintNegocio, cfg: ConfigImpresora, fe?: FEParaTicket,
): Promise<boolean> {
  if (!esTermica(cfg) && !cfg.simular) return false; // modo navegador → el call-site usa HTML
  const ok = await enviar(recibo(orden, pagos, negocio, cfg, fe), cfg);
  if (ok && cfg.abrir_cajon) await enviar(kickCajon(), cfg).catch(() => {});
  return ok;
}

export async function imprimirComanda(orden: PrintOrden, cfg: ConfigImpresora, copias = 1): Promise<boolean> {
  if (!esTermica(cfg) && !cfg.simular) return false;
  return enviar(comanda(orden, cfg, copias), cfg);
}

export async function imprimirCierre(datos: CierreData, negocio: PrintNegocio, cfg: ConfigImpresora): Promise<boolean> {
  if (!esTermica(cfg) && !cfg.simular) return false;
  return enviar(cierre(datos, negocio, cfg), cfg);
}

/** Lista las impresoras que ve QZ Tray (para la config). */
export async function detectarImpresoras(): Promise<string[]> {
  try { return await qzImpresora.listarImpresoras(); } catch { return []; }
}

export * from './documentos';
