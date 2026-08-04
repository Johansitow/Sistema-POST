/**
 * noopPagos.ts — Driver de pasarela para desarrollo / sin llaves.
 *
 * Igual que el email sin SMTP: no cobra de verdad, simula una aprobación y loguea.
 * Permite recorrer el flujo de suscripción end-to-end en local (checkout → activa)
 * sin credenciales de Wompi. `disponible()` es false para que la UI/estado marquen
 * que es modo simulado.
 */

import { randomUUID } from 'crypto';
import logger from '../../config/logger';
import type {
  PasarelaPagos,
  CrearTransaccionParams,
  ResultadoTransaccion,
  CrearFuentePagoParams,
  ResultadoFuentePago,
} from './pasarela';

export class NoopPagos implements PasarelaPagos {
  disponible(): boolean {
    return false;
  }

  async getAcceptanceToken(): Promise<string | null> {
    return `noop_acceptance_${randomUUID()}`;
  }

  async crearFuentePago(p: CrearFuentePagoParams): Promise<ResultadoFuentePago> {
    logger.info(`[pagos:noop] fuente de pago simulada (${p.tipo}) para ${p.emailCliente}`);
    return { paymentSourceId: `noop_src_${randomUUID()}`, estado: 'aprobada' };
  }

  async crearTransaccion(p: CrearTransaccionParams): Promise<ResultadoTransaccion> {
    logger.info(
      `[pagos:noop] transacción simulada ${p.referencia} — ${p.metodo} — ` +
      `${p.montoCentavos} centavos → APROBADA (modo sin cobro)`,
    );
    return { wompiTransactionId: `noop_txn_${randomUUID()}`, estado: 'aprobada', urlRedireccion: null };
  }

  async obtenerTransaccion(id: string): Promise<ResultadoTransaccion> {
    return { wompiTransactionId: id, estado: 'aprobada' };
  }
}
