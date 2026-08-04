/**
 * EventoWebhookWompiRepository — libro de eventos de webhook para IDEMPOTENCIA.
 * `evento_id @unique` garantiza atómicamente (a nivel Postgres) que un evento
 * reenviado por Wompi no se procese dos veces. Molde: TokenAuth.
 */

import { Prisma } from '@prisma/client';
import prisma from '../config/database';

export const eventoWebhookWompiRepository = {
  /**
   * Registra el evento; devuelve la fila creada, o `null` si ya existía
   * (P2002 sobre evento_id) → señal de "ya procesado, no reprocesar".
   */
  async crearSiNoExiste(evento_id: string, tipo: string, payload: unknown) {
    try {
      return await prisma.eventoWebhookWompi.create({
        data: { evento_id, tipo, payload: payload as Prisma.InputJsonValue },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return null;
      throw e;
    }
  },

  marcarProcesado: (id: number) =>
    prisma.eventoWebhookWompi.update({ where: { id }, data: { procesado_en: new Date() } }),
};
