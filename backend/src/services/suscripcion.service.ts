/**
 * suscripcion.service.ts — Ciclo de vida de la suscripción SaaS de un grupo.
 *
 * Multi-tenant: siempre se opera con un `grupoId` explícito (nunca del cliente).
 *
 * Modelo de cobro (Wompi):
 *   - Nequi → se crea una FUENTE DE PAGO tokenizada; el token habilita el cobro
 *     recurrente automático (job mensual).
 *   - PSE → pago puntual del período (no tokeniza); el job NO lo auto-cobra: al
 *     vencer queda pendiente_pago y el usuario vuelve a pagar.
 *   - tarjeta → reservado, desactivado en el MVP.
 *
 * Idempotencia: la activación se ancla a la TRANSACCIÓN (una transacción se aplica
 * una sola vez, comparando su estado). El webhook además deduplica por evento.
 *
 * En dev sin llaves, el driver `noop` aprueba al instante y el checkout activa la
 * suscripción sin esperar webhook.
 */

import { randomUUID } from 'crypto';
import { EstadoSuscripcion, EstadoTxWompi, MetodoSuscripcion, PlanSaaS } from '@prisma/client';
import { suscripcionRepository } from '../repositories/suscripcion.repository';
import { transaccionSuscripcionRepository } from '../repositories/transaccionSuscripcion.repository';
import { registrarAuditoria } from '../repositories/auditoria.repository';
import { planService } from './plan.service';
import { getPlan } from '../lib/planes/catalogo';
import { pasarela, pesosACentavos, type EstadoPasarela } from '../lib/pagos';
import { eventBus } from '../events/eventBus';
import { EVENTS } from '../events/events';
import { BadRequestError, NotFoundError } from '../exceptions/HttpErrors';
import logger from '../config/logger';

const PERIODO_DIAS   = 30;
const MAX_REINTENTOS = 3;
const GRACIA_DIAS    = 3;

function sumarDias(base: Date, dias: number): Date {
  return new Date(base.getTime() + dias * 24 * 60 * 60 * 1000);
}

function nuevaReferencia(grupoId: number): string {
  return `sub_${grupoId}_${Date.now()}_${randomUUID().slice(0, 8)}`;
}

/** EstadoPasarela y EstadoTxWompi comparten literales; el cast es seguro. */
const aTxEstado = (e: EstadoPasarela): EstadoTxWompi => e as EstadoTxWompi;

export interface CheckoutParams {
  plan:         PlanSaaS;
  metodo:       MetodoSuscripcion;
  emailCliente: string;
  /** Nequi: { phone_number }. PSE: datos del pagador y banco. */
  datosMetodo?: Record<string, unknown>;
  redirectUrl?: string;
}

export const suscripcionService = {
  /**
   * iniciarCheckout — arranca el pago de un plan de pago. Crea (o reusa) la
   * suscripción en `pendiente_pago`, registra la transacción y la envía a la
   * pasarela. Si la pasarela aprueba en el acto (Nequi tokenizado / noop),
   * activa la suscripción; si es asíncrono (PSE), devuelve la URL de redirección
   * y la activación llega por webhook.
   */
  async iniciarCheckout(grupoId: number, p: CheckoutParams) {
    if (p.plan === PlanSaaS.starter) {
      throw new BadRequestError('El plan Gratis no requiere pago.');
    }
    if (p.metodo === MetodoSuscripcion.tarjeta) {
      throw new BadRequestError('El pago con tarjeta aún no está disponible.');
    }

    const def           = getPlan(p.plan);
    const montoCop      = def.precio_mensual_cop;
    const montoCentavos = pesosACentavos(montoCop);
    const ahora         = new Date();
    const periodoFin    = sumarDias(ahora, PERIODO_DIAS);
    const referencia    = nuevaReferencia(grupoId);

    // Nequi: fuente de pago tokenizada → habilita el cobro recurrente.
    let paymentSourceId: string | undefined;
    if (p.metodo === MetodoSuscripcion.nequi) {
      const fuente = await pasarela.crearFuentePago({
        tipo: 'nequi',
        emailCliente: p.emailCliente,
        datos: p.datosMetodo ?? {},
      });
      if (fuente.estado === 'error' || !fuente.paymentSourceId) {
        throw new BadRequestError('No se pudo registrar la fuente de pago Nequi. Intenta de nuevo.');
      }
      paymentSourceId = fuente.paymentSourceId;
    }

    const sub = await suscripcionRepository.upsert(grupoId, {
      plan:                    p.plan,
      estado:                  EstadoSuscripcion.pendiente_pago,
      metodo:                  p.metodo,
      monto_cop:               montoCop,
      periodo_inicio:          ahora,
      periodo_fin:             periodoFin,
      proximo_cobro:           periodoFin,
      wompi_payment_source_id: paymentSourceId ?? null,
      wompi_customer_ref:      p.emailCliente,
      reintentos:              0,
    });

    const tx = await transaccionSuscripcionRepository.create({
      id_suscripcion: sub.id,
      referencia,
      monto_cop:      montoCop,
      metodo:         p.metodo,
      periodo_inicio: ahora,
      periodo_fin:    periodoFin,
      estado:         EstadoTxWompi.pendiente,
    });

    const res = await pasarela.crearTransaccion({
      referencia,
      montoCentavos,
      emailCliente:    p.emailCliente,
      metodo:          p.metodo,
      paymentSourceId,
      datosMetodo:     p.datosMetodo,
      redirectUrl:     p.redirectUrl,
    });

    await transaccionSuscripcionRepository.update(tx.id, {
      wompi_transaction_id: res.wompiTransactionId,
    });

    if (res.estado === 'aprobada') {
      await this.aplicarTransaccionAprobada(referencia, res.wompiTransactionId);
    } else if (res.estado !== 'pendiente') {
      // rechazada / error / anulada → deja la suscripción pendiente_pago
      await transaccionSuscripcionRepository.update(tx.id, { estado: aTxEstado(res.estado) });
    }

    return {
      referencia,
      estado:          res.estado,
      url_redireccion: res.urlRedireccion ?? null,
      cobro_real:      pasarela.disponible(),
    };
  },

  /**
   * aplicarTransaccionAprobada — activa/extiende la suscripción a partir de una
   * transacción aprobada. IDEMPOTENTE: si la transacción ya estaba aprobada, no
   * hace nada (protege contra webhooks reenviados y doble activación).
   */
  async aplicarTransaccionAprobada(referencia: string, wompiTransactionId?: string | null): Promise<void> {
    const tx = await transaccionSuscripcionRepository.findByReferencia(referencia);
    if (!tx) {
      logger.warn(`[suscripcion] transacción ${referencia} no encontrada al aprobar`);
      return;
    }
    if (tx.estado === EstadoTxWompi.aprobada) return; // ya aplicada → idempotente

    await transaccionSuscripcionRepository.update(tx.id, {
      estado:               EstadoTxWompi.aprobada,
      ...(wompiTransactionId ? { wompi_transaction_id: wompiTransactionId } : {}),
    });

    const sub = tx.suscripcion;
    await suscripcionRepository.update(sub.id, {
      estado:         EstadoSuscripcion.activa,
      periodo_inicio: tx.periodo_inicio,
      periodo_fin:    tx.periodo_fin,
      proximo_cobro:  tx.periodo_fin,
      reintentos:     0,
    });

    // Cablea el plan al grupo (sincroniza plan + tope de sedes).
    await planService.aplicarPlan(sub.id_grupo, sub.plan);

    registrarAuditoria({
      accion:               'ACTIVAR_SUSCRIPCION',
      modulo:               'suscripciones',
      tabla_afectada:       'suscripciones',
      id_registro_afectado: sub.id,
      id_grupo:             sub.id_grupo,
      datos_nuevos:         { plan: sub.plan, metodo: sub.metodo, referencia },
    });

    eventBus.emit(EVENTS.SUSCRIPCION_ACTIVADA, {
      idGrupo:    sub.id_grupo,
      plan:       sub.plan,
      metodo:     sub.metodo ?? '',
      periodoFin: tx.periodo_fin,
    });

    logger.info(`[suscripcion] grupo ${sub.id_grupo} → plan ${sub.plan} activo hasta ${tx.periodo_fin.toISOString()}`);
  },

  /** Marca una transacción como rechazada (webhook de pago fallido inicial). */
  async registrarRechazo(referencia: string, estado: EstadoPasarela = 'rechazada'): Promise<void> {
    const tx = await transaccionSuscripcionRepository.findByReferencia(referencia);
    if (!tx || tx.estado === EstadoTxWompi.aprobada) return;
    await transaccionSuscripcionRepository.update(tx.id, { estado: aTxEstado(estado) });
  },

  /**
   * renovar — cobro recurrente de una suscripción (camino del job).
   * Requiere token de fuente de pago (Nequi). Sin token (PSE) no se auto-cobra:
   * queda pendiente_pago para que el usuario pague manualmente.
   */
  async renovar(subId: number): Promise<void> {
    const sub = await suscripcionRepository.findById(subId);
    if (!sub) return;

    if (!sub.wompi_payment_source_id) {
      await suscripcionRepository.update(sub.id, { estado: EstadoSuscripcion.pendiente_pago });
      logger.info(`[suscripcion] grupo ${sub.id_grupo} sin token (PSE); requiere pago manual`);
      return;
    }

    const def           = getPlan(sub.plan);
    const montoCentavos = pesosACentavos(def.precio_mensual_cop);
    const ahora         = new Date();
    const periodoFin    = sumarDias(ahora, PERIODO_DIAS);
    const referencia    = nuevaReferencia(sub.id_grupo);
    const metodo        = sub.metodo ?? MetodoSuscripcion.nequi;

    const tx = await transaccionSuscripcionRepository.create({
      id_suscripcion: sub.id,
      referencia,
      monto_cop:      def.precio_mensual_cop,
      metodo,
      periodo_inicio: ahora,
      periodo_fin:    periodoFin,
      estado:         EstadoTxWompi.pendiente,
    });

    const res = await pasarela.crearTransaccion({
      referencia,
      montoCentavos,
      emailCliente:    sub.wompi_customer_ref ?? '',
      metodo,
      paymentSourceId: sub.wompi_payment_source_id,
    });

    await transaccionSuscripcionRepository.update(tx.id, { wompi_transaction_id: res.wompiTransactionId });

    if (res.estado === 'aprobada') {
      await this.aplicarTransaccionAprobada(referencia, res.wompiTransactionId);
      return;
    }

    await transaccionSuscripcionRepository.update(tx.id, { estado: aTxEstado(res.estado) });
    const reintentos = sub.reintentos + 1;
    if (reintentos >= MAX_REINTENTOS) {
      await this.vencer(sub.id);
    } else {
      await suscripcionRepository.update(sub.id, { estado: EstadoSuscripcion.pendiente_pago, reintentos });
      eventBus.emit(EVENTS.SUSCRIPCION_PAGO_FALLIDO, { idGrupo: sub.id_grupo, reintentos });
      logger.warn(`[suscripcion] cobro fallido grupo ${sub.id_grupo} (intento ${reintentos}/${MAX_REINTENTOS})`);
    }
  },

  /** vencer — degrada la suscripción a Gratis (plan starter) y la marca vencida. */
  async vencer(subId: number): Promise<void> {
    const sub = await suscripcionRepository.findById(subId);
    if (!sub || sub.estado === EstadoSuscripcion.vencida) return;

    await suscripcionRepository.update(sub.id, { estado: EstadoSuscripcion.vencida });
    await planService.aplicarPlan(sub.id_grupo, PlanSaaS.starter); // degradar a Gratis

    registrarAuditoria({
      accion:               'VENCER_SUSCRIPCION',
      modulo:               'suscripciones',
      tabla_afectada:       'suscripciones',
      id_registro_afectado: sub.id,
      id_grupo:             sub.id_grupo,
      datos_anteriores:     { plan: sub.plan },
    });

    eventBus.emit(EVENTS.SUSCRIPCION_VENCIDA, { idGrupo: sub.id_grupo, planAnterior: sub.plan });
    logger.info(`[suscripcion] grupo ${sub.id_grupo} vencido → degradado a Gratis`);
  },

  /** cancelar — el grupo no renovará; conserva acceso hasta fin de período. */
  async cancelar(grupoId: number) {
    const sub = await suscripcionRepository.findByGrupo(grupoId);
    if (!sub) throw new NotFoundError('Suscripción');
    await suscripcionRepository.update(sub.id, { estado: EstadoSuscripcion.cancelada });

    registrarAuditoria({
      accion:               'CANCELAR_SUSCRIPCION',
      modulo:               'suscripciones',
      tabla_afectada:       'suscripciones',
      id_registro_afectado: sub.id,
      id_grupo:             grupoId,
    });

    return this.getEstado(grupoId);
  },

  /** getEstado — plan + uso + estado de suscripción para la pantalla "Mi plan". */
  async getEstado(grupoId: number) {
    const planYUso = await planService.getPlanYUso(grupoId);
    const sub = await suscripcionRepository.findByGrupo(grupoId);
    return {
      ...planYUso,
      suscripcion: sub
        ? {
            estado:        sub.estado,
            metodo:        sub.metodo,
            periodo_fin:   sub.periodo_fin,
            proximo_cobro: sub.proximo_cobro,
            monto_cop:     Number(sub.monto_cop),
          }
        : null,
      cobro_real: pasarela.disponible(),
    };
  },

  // ── Job (renovación / vencimiento) ────────────────────────────────────────────

  /** Cobra las suscripciones activas cuyo próximo cobro ya venció. */
  async ejecutarRenovaciones(): Promise<number> {
    const pendientes = await suscripcionRepository.findPorCobrar(new Date());
    for (const s of pendientes) {
      await this.renovar(s.id).catch((err) =>
        logger.error(`[suscripcion] error renovando grupo ${s.id_grupo}: ${(err as Error).message}`),
      );
    }
    return pendientes.length;
  },

  /** Degrada las suscripciones que pasaron su período + gracia sin pagar. */
  async ejecutarVencimientos(): Promise<number> {
    const limite = sumarDias(new Date(), -GRACIA_DIAS); // periodo_fin < now - gracia
    const expiradas = await suscripcionRepository.findParaVencer(limite);
    for (const s of expiradas) {
      await this.vencer(s.id).catch((err) =>
        logger.error(`[suscripcion] error venciendo grupo ${s.id_grupo}: ${(err as Error).message}`),
      );
    }
    return expiradas.length;
  },
};
