/**
 * facturacion.job.ts — Reintenta emisiones de FE que quedaron pendientes/con error.
 * Molde: suscripciones.job (node-cron, America/Bogota, nunca lanza). No corre al
 * arrancar. Útil cuando el proveedor DIAN falla transitoriamente.
 */

import cron from 'node-cron';
import logger from '../config/logger';
import { facturaElectronicaService } from '../services/facturaElectronica.service';

const SCHEDULE = process.env.FACTURACION_CRON_SCHEDULE ?? '*/30 * * * *'; // cada 30 min
const TZ = process.env.TZ || 'America/Bogota';

async function run(): Promise<void> {
  try {
    const n = await facturaElectronicaService.reintentarPendientes();
    if (n > 0) logger.info(`[job:facturacion] reintentos procesados: ${n}`);
  } catch (err) {
    logger.error(`[job:facturacion] error: ${(err as Error).message}`);
  }
}

export function startFacturacionJob(): void {
  if (!cron.validate(SCHEDULE)) {
    logger.error(`[job:facturacion] schedule inválido: ${SCHEDULE}`);
    return;
  }
  cron.schedule(SCHEDULE, run, { timezone: TZ });
  logger.info(`[job:facturacion] programado (${SCHEDULE}, ${TZ})`);
}
