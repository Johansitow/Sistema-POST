/**
 * wompiWebhook.service.ts — Procesa los eventos entrantes de Wompi.
 *
 * Flujo: verificar firma (anti-spoofing) → deduplicar (idempotencia por
 * transacción+estado) → enrutar a suscripcionService según el estado.
 *
 * Wompi no incluye un id de evento único, así que la huella de deduplicación es
 * `transaction.id:status` (una transacción que llega a APPROVED una sola vez).
 */

import { config } from '../config/env';
import logger from '../config/logger';
import { UnauthorizedError } from '../exceptions/HttpErrors';
import {
  verificarFirmaEvento,
  mapEstadoWompi,
  type EventoWompi,
} from '../lib/pagos';
import { eventoWebhookWompiRepository } from '../repositories/eventoWebhookWompi.repository';
import { suscripcionService } from './suscripcion.service';

interface TransaccionEvento {
  id?:        string;
  status?:    string;
  reference?: string;
}

export const wompiWebhookService = {
  async procesar(evento: EventoWompi): Promise<{ procesado: boolean; motivo?: string }> {
    const secret = config.wompi.eventsSecret;

    // Sin secret configurada el webhook está deshabilitado (dev activa vía checkout).
    if (!secret) {
      logger.warn('[webhook:wompi] evento recibido sin WOMPI_EVENTS_SECRET; ignorado');
      return { procesado: false, motivo: 'sin_secret' };
    }

    // 1. Firma — rechaza eventos falsificados antes de tocar la DB.
    if (!verificarFirmaEvento(evento, secret)) {
      throw new UnauthorizedError('Firma de evento inválida');
    }

    const tx = (evento.data?.transaction ?? {}) as TransaccionEvento;
    const wompiTxId  = String(tx.id ?? '');
    const referencia = String(tx.reference ?? '');
    const estado     = mapEstadoWompi(tx.status);

    if (!wompiTxId || !referencia) {
      return { procesado: false, motivo: 'evento_no_aplicable' };
    }

    // 2. Idempotencia — inserta la huella; si ya existía, no reprocesar.
    const eventoId = `${wompiTxId}:${tx.status ?? ''}`;
    const registro = await eventoWebhookWompiRepository.crearSiNoExiste(
      eventoId,
      evento.event ?? 'transaction.updated',
      evento,
    );
    if (!registro) return { procesado: false, motivo: 'duplicado' };

    // 3. Enrutamiento por estado.
    if (estado === 'aprobada') {
      await suscripcionService.aplicarTransaccionAprobada(referencia, wompiTxId);
    } else if (estado === 'rechazada' || estado === 'anulada' || estado === 'error') {
      await suscripcionService.registrarRechazo(referencia, estado);
    }
    // 'pendiente' → sin acción (esperamos el estado final).

    await eventoWebhookWompiRepository.marcarProcesado(registro.id);
    return { procesado: true };
  },
};
