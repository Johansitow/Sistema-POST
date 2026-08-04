/**
 * Selección del driver de pasarela (singleton), igual que logoStorage.
 *   PAGOS_DRIVER=wompi → WompiClient (real).
 *   PAGOS_DRIVER=off   → NoopPagos (simula aprobaciones, no cobra).
 * Si se pide wompi pero faltan llaves, cae al noop (fail-open en dev).
 */

import { config } from '../../config/env';
import logger from '../../config/logger';
import type { PasarelaPagos } from './pasarela';
import { WompiClient } from './wompiClient';
import { NoopPagos } from './noopPagos';

function crearPasarela(): PasarelaPagos {
  if (config.wompi.driver === 'wompi') {
    const cliente = new WompiClient();
    if (cliente.disponible()) return cliente;
    logger.warn('[pagos] PAGOS_DRIVER=wompi pero faltan llaves; usando driver noop (sin cobro real)');
  }
  return new NoopPagos();
}

export const pasarela: PasarelaPagos = crearPasarela();

export * from './pasarela';
