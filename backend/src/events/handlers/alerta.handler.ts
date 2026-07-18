/**
 * alerta.handler.ts
 * Convierte eventos de dominio en notificaciones persistentes (tabla Alerta)
 * para la campana del header.
 *
 * Hoy cubre CIERRE_COMPLETADO: al confirmar un cierre de caja se crea una
 * alerta informativa scoped a la sede del cierre. Los errores se registran
 * y nunca propagan al flujo de negocio que emitió el evento.
 */

import { alertaRepository } from '../../repositories/alerta.repository';
import { eventBus } from '../eventBus';
import { EVENTS, CierreCompletadoPayload } from '../events';
import logger from '../../config/logger';

const TIPO_CIERRE_CAJA = {
  nombre:            'Cierre de Caja',
  codigo:            'CIERRE_CAJA',
  descripcion:       'Cierre de caja confirmado',
  icono:             'point_of_sale',
  color:             '#4CAF50',
  prioridad_default: 'media',
};

/**
 * Resuelve el TipoAlerta CIERRE_CAJA, creándolo si aún no existe
 * (idempotente — cubre bases de datos donde el seed no lo incluyó).
 */
async function resolverTipoCierreCaja() {
  const existente = await alertaRepository.findTipoByCodigo(TIPO_CIERRE_CAJA.codigo);
  if (existente) return existente;
  return alertaRepository.createTipo(TIPO_CIERRE_CAJA);
}

export function registerAlertaHandlers(): void {

  eventBus.on<CierreCompletadoPayload>(EVENTS.CIERRE_COMPLETADO, async (payload) => {
    try {
      const tipo = await resolverTipoCierreCaja();

      const conDiferencia = payload.estado === 'con_diferencia';
      const mensaje = conDiferencia
        ? `Cierre de caja ${payload.numeroCierre} completado con diferencia de $${Math.abs(payload.diferencia).toLocaleString('es-CO')} (ventas: $${payload.totalVentas.toLocaleString('es-CO')})`
        : `Se generó el cierre de caja ${payload.numeroCierre} — ventas: $${payload.totalVentas.toLocaleString('es-CO')}`;

      await alertaRepository.create({
        id_tipo_alerta:  tipo.id,
        id_restaurante:  payload.idRestaurante,
        mensaje,
        nivel_prioridad: conDiferencia ? 'alta' : tipo.prioridad_default,
      });
    } catch (error) {
      logger.error(`[alerta.handler] Error creando alerta de cierre ${payload.idCierre}:`, error);
    }
  });
}
