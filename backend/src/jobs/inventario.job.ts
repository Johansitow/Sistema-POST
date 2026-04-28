/**
 * inventario.job.ts — Jobs periódicos de inventario
 *
 * Jobs:
 * 1. Sincronización de alertas de stock (cada hora)
 * 2. Generación automática de lista de compras cuando hay stock bajo (cada hora, si LISTA_COMPRAS_AUTO=true)
 * 3. Ajuste automático de stock mínimo/máximo según tendencias (domingos 2am, si STOCK_AJUSTE_AUTO=true)
 */

import cron from 'node-cron';
import { alertaService }      from '../services/alerta.service';
import { listaComprasService } from '../services/lista-compras.service';
import { eventBus }            from '../events/eventBus';
import { EVENTS }              from '../events/events';
import logger                 from '../config/logger';
import prisma                 from '../config/database';

const SCHEDULE          = process.env.ALERT_CRON_SCHEDULE || '0 * * * *'; // cada hora
const SCHEDULE_SEMANAL  = '0 2 * * 0'; // domingos 2am
const SCHEDULE_DIARIO   = '0 6 * * *'; // diariamente 6am

/** Ejecuta la sincronización de alertas de inventario */
async function runSync(): Promise<void> {
  try {
    logger.info('[Job:Inventario] Iniciando sincronización de alertas...');
    const { creadas, resueltas } = await alertaService.sincronizar();
    logger.info(`[Job:Inventario] Completado — creadas: ${creadas}, resueltas: ${resueltas}`);
  } catch (error) {
    logger.error('[Job:Inventario] Error en sincronización:', error);
  }
}

/** Genera lista de compras automática por cada restaurante activo cuando hay stock bajo */
async function runListaCompras(): Promise<void> {
  try {
    const config = await prisma.configuracion.findFirst({ where: { clave: 'LISTA_COMPRAS_AUTO' } });
    if (config?.valor !== 'true') return;

    const sistemaUser = await prisma.usuario.findFirst({ where: { usuario: 'sistema' } });
    const id_usuario  = sistemaUser?.id ?? 1;
    const notas       = `Generada automáticamente — ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`;

    // Ejecutar por cada restaurante activo — el stock es independiente por sede
    const restaurantes = await prisma.restaurante.findMany({
      where:  { activo: true },
      select: { id: true, nombre: true },
    });

    logger.info(`[Job:ListaCompras] Verificando stock bajo en ${restaurantes.length} restaurante(s)...`);

    for (const rest of restaurantes) {
      try {
        const result = await listaComprasService.generarAutomatico(id_usuario, {
          notas,
          id_restaurante: rest.id,
        });
        if (result.lista) {
          logger.info(`[Job:ListaCompras] ${rest.nombre}: Lista ${result.lista.numero_lista} generada (${result.total_items} items).`);
        }
      } catch (err) {
        logger.error(`[Job:ListaCompras] Error en restaurante ${rest.id}:`, err);
      }
    }
  } catch (error) {
    logger.error('[Job:ListaCompras] Error:', error);
  }
}

/** Ajusta stock mínimo y máximo basado en tendencias de consumo */
async function runAjusteStock(): Promise<void> {
  try {
    const config = await prisma.configuracion.findFirst({ where: { clave: 'STOCK_AJUSTE_AUTO' } });
    if (config?.valor !== 'true') return;

    const leadDaysConfig = await prisma.configuracion.findFirst({ where: { clave: 'LISTA_COMPRAS_LEAD_DAYS' } });
    const leadDays = leadDaysConfig ? Number(leadDaysConfig.valor) : 3;

    logger.info('[Job:AjusteStock] Calculando tendencias de consumo...');
    const hace30 = new Date(); hace30.setDate(hace30.getDate() - 30);

    const consumos = await prisma.movimiento.groupBy({
      by: ['id_producto'],
      where: {
        tipo_movimiento: { in: ['salida', 'venta', 'merma'] },
        fecha_movimiento: { gte: hace30 },
      },
      _sum: { cantidad: true },
    });

    let ajustados = 0;
    for (const consumo of consumos) {
      const promDiario = Number(consumo._sum.cantidad ?? 0) / 30;
      if (promDiario <= 0) continue;

      const nuevoMin = Math.ceil(promDiario * leadDays);
      const nuevoMax = Math.ceil(promDiario * leadDays * 2.5);

      const producto = await prisma.producto.findUnique({
        where: { id: consumo.id_producto },
        select: { stock_minimo: true, stock_maximo: true },
      });
      if (!producto) continue;

      const diffMin = Math.abs(nuevoMin - Number(producto.stock_minimo)) / (Number(producto.stock_minimo) || 1);
      const diffMax = producto.stock_maximo
        ? Math.abs(nuevoMax - Number(producto.stock_maximo)) / Number(producto.stock_maximo)
        : 1;

      // Actualizar solo si la diferencia supera el 20%
      if (diffMin > 0.20 || diffMax > 0.20) {
        await prisma.producto.update({
          where: { id: consumo.id_producto },
          data: { stock_minimo: nuevoMin, stock_maximo: nuevoMax },
        });
        ajustados++;
      }
    }

    logger.info(`[Job:AjusteStock] Completado — ${ajustados} productos ajustados.`);
  } catch (error) {
    logger.error('[Job:AjusteStock] Error:', error);
  }
}

/** Verifica lotes próximos a vencer y emite LOTE_VENCIDO para cada uno */
async function runLotesVencidos(): Promise<void> {
  try {
    const diasConfig = await prisma.configuracion.findFirst({ where: { clave: 'dias_alerta_vencimiento' } });
    const dias = diasConfig ? Number(diasConfig.valor) : 7;

    const limite = new Date();
    limite.setDate(limite.getDate() + dias);

    const lotes = await prisma.lote.findMany({
      where: {
        fecha_vencimiento: { lte: limite },
        cantidad_producida: { gt: 0 },
      },
      include: {
        producto: { select: { nombre: true } },
      },
    });

    for (const lote of lotes) {
      await eventBus.emit(EVENTS.LOTE_VENCIDO, {
        idLote:         lote.id,
        numeroLote:     lote.numero_lote,
        idProducto:     lote.id_producto,
        nombreProducto: lote.producto.nombre,
        idRestaurante:  lote.id_restaurante,
        fechaVencimiento: lote.fecha_vencimiento!,
        diasRestantes:  Math.ceil(
          ((lote.fecha_vencimiento?.getTime() ?? 0) - Date.now()) / 86_400_000
        ),
      });
    }

    if (lotes.length > 0) {
      logger.info(`[Job:LotesVencidos] ${lotes.length} lote(s) próximos a vencer notificados.`);
    }
  } catch (error) {
    logger.error('[Job:LotesVencidos] Error:', error);
  }
}

/** Elimina registros de auditoría con más de 90 días */
async function runLimpiezaAuditoria(): Promise<void> {
  try {
    const hace90Dias = new Date();
    hace90Dias.setDate(hace90Dias.getDate() - 90);

    const { count } = await prisma.auditoria.deleteMany({
      where: { fecha_hora: { lt: hace90Dias } },
    });

    if (count > 0) {
      logger.info(`[Job:Auditoria] ${count} registros eliminados (> 90 días).`);
    }
  } catch (error) {
    logger.error('[Job:Auditoria] Error en limpieza:', error);
  }
}

/** Registra todos los jobs cron y dispara ejecución inicial */
export const startInventarioJob = (): void => {
  if (!cron.validate(SCHEDULE)) {
    logger.error(`[Job:Inventario] Expresión cron inválida: "${SCHEDULE}". Job no iniciado.`);
    return;
  }

  // Ejecución al arranque (delay de 5s para que Prisma esté listo)
  setTimeout(runSync, 5_000);

  // Job horario: alertas + lista de compras
  cron.schedule(SCHEDULE, async () => {
    await runSync();
    await runListaCompras();
  }, { timezone: process.env.TZ || 'America/Bogota' });

  // Job semanal: ajuste de stock mínimo/máximo
  cron.schedule(SCHEDULE_SEMANAL, runAjusteStock, {
    timezone: process.env.TZ || 'America/Bogota',
  });

  // Job diario: lotes próximos a vencer + limpieza de auditoría
  cron.schedule(SCHEDULE_DIARIO, async () => {
    await runLotesVencidos();
    await runLimpiezaAuditoria();
  }, { timezone: process.env.TZ || 'America/Bogota' });

  logger.info(
    `[Job:Inventario] Jobs registrados — horario: "${SCHEDULE}", diario: "${SCHEDULE_DIARIO}", semanal: "${SCHEDULE_SEMANAL}"`
  );
};
