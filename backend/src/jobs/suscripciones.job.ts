/**
 * suscripciones.job.ts — Cron de billing: renueva y vence suscripciones.
 * Molde: inventario.job.ts (node-cron, timezone America/Bogota, nunca lanza).
 *
 * Diario ~03:00:
 *   - renueva (cobra el token) las suscripciones activas cuyo próximo cobro venció;
 *   - degrada a Gratis las que pasaron su período + gracia sin pagar.
 *
 * A diferencia del job de inventario, NO se ejecuta al arrancar (evita cobrar en
 * cada reinicio); solo corre en el schedule.
 */

import cron from 'node-cron';
import logger from '../config/logger';
import { suscripcionService } from '../services/suscripcion.service';

const SCHEDULE = process.env.SUSCRIPCION_CRON_SCHEDULE ?? '0 3 * * *'; // diario 03:00
const TZ = process.env.TZ || 'America/Bogota';

async function run(): Promise<void> {
  try {
    const renovadas = await suscripcionService.ejecutarRenovaciones();
    const vencidas  = await suscripcionService.ejecutarVencimientos();
    logger.info(`[job:suscripciones] renovaciones intentadas: ${renovadas}, vencimientos: ${vencidas}`);
  } catch (err) {
    logger.error(`[job:suscripciones] error: ${(err as Error).message}`);
  }
}

export function startSuscripcionesJob(): void {
  if (!cron.validate(SCHEDULE)) {
    logger.error(`[job:suscripciones] schedule inválido: ${SCHEDULE}`);
    return;
  }
  cron.schedule(SCHEDULE, run, { timezone: TZ });
  logger.info(`[job:suscripciones] programado (${SCHEDULE}, ${TZ})`);
}
