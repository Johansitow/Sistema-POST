/**
 * AlertaService - Lógica de negocio para alertas de inventario
 *
 * El método clave es sincronizar():
 * - Se llama automáticamente después de cualquier cambio de stock
 * - Compara el estado actual del producto contra las alertas existentes
 * - Crea alertas nuevas si el producto está en condición de alerta
 * - No crea duplicados: verifica si ya existe una alerta activa del mismo tipo
 *
 * El frontend consume countNoLeidas() para el badge del Layout.
 */

import { alertaRepository } from '../repositories/alerta.repository';
import { productoRepository } from '../repositories/producto.repository';
import { NotFoundError, ConflictError } from '../exceptions/HttpErrors';
import { getPaginationParams, buildPaginatedResult } from '../lib/pagination';
import { eventBus } from '../events/eventBus';
import { EVENTS }   from '../events/events';

export const alertaService = {

  // ─── TiposAlerta ─────────────────────────────────────────────────────────────

  async listarTipos() {
    return alertaRepository.findTipoAll();
  },

  async crearTipo(data: {
    nombre:             string;
    codigo:             string;
    descripcion?:       string;
    icono?:             string;
    color?:             string;
    prioridad_default?: string;
  }) {
    const existe = await alertaRepository.findTipoByCodigo(data.codigo);
    if (existe) throw new ConflictError('Ya existe un tipo de alerta con ese código');
    return alertaRepository.createTipo(data);
  },

  async actualizarTipo(id: number, data: Partial<{
    nombre:            string;
    descripcion:       string;
    icono:             string;
    color:             string;
    prioridad_default: string;
    activo:            boolean;
  }>) {
    const tipo = await alertaRepository.findTipoById(id);
    if (!tipo) throw new NotFoundError('Tipo de alerta');
    return alertaRepository.updateTipo(id, data);
  },

  // ─── Alertas ─────────────────────────────────────────────────────────────────

  async listar(params: {
    page?: unknown; limit?: unknown;
    id_restaurante: number;   // obligatorio — aislamiento de tenant
    es_leida?: boolean; nivel_prioridad?: string; id_tipo_alerta?: number;
  }) {
    const pagination = getPaginationParams(params.page, params.limit);
    const [alertas, total] = await alertaRepository.findAll(pagination, {
      id_restaurante:  params.id_restaurante,
      es_leida:        params.es_leida,
      nivel_prioridad: params.nivel_prioridad,
      id_tipo_alerta:  params.id_tipo_alerta,
    });
    return buildPaginatedResult(alertas, total, pagination);
  },

  async countNoLeidas(id_restaurante: number) {
    const total = await alertaRepository.countNoLeidas(id_restaurante);
    return { total };
  },

  async marcarLeida(id: number) {
    return alertaRepository.marcarLeida(id);
  },

  async marcarTodasLeidas(id_restaurante: number) {
    await alertaRepository.marcarTodasLeidas(id_restaurante);
    return { message: 'Todas las alertas marcadas como leídas' };
  },

  /**
   * sincronizar — analiza el estado actual de todos los productos activos
   * y genera alertas en BD sin crear duplicados.
   *
   * Se llama desde:
   * - producto.service después de actualizar stock
   * - inventario.service después de registrar un movimiento
   * - Un job periódico (cron) si se implementa en el futuro
   *
   * Lógica:
   * 1. Obtiene todos los tipos de alerta activos del sistema
   * 2. Para cada producto activo verifica si cumple condición de alerta
   * 3. Si ya existe una alerta activa del mismo tipo → no crea duplicado
   * 4. Si la condición desapareció y hay alerta activa → la marca como leída
   */
  async sincronizar(): Promise<{ creadas: number; resueltas: number }> {
    const [productos, tipos] = await Promise.all([
      productoRepository.findActivos() as Promise<any[]>,
      alertaRepository.findTipoAll(),
    ]);

    const tipoStockMinimo  = tipos.find(t => t.codigo === 'STOCK_MINIMO');
    const tipoStockAgotado = tipos.find(t => t.codigo === 'STOCK_AGOTADO');
    const tipoVencimiento  = tipos.find(t => t.codigo === 'VENCIMIENTO');

    let creadas   = 0;
    let resueltas = 0;

    for (const producto of productos) {
      const stock         = Number(producto.stock_actual);
      const stockMinimo   = Number(producto.stock_minimo);
      const estaAgotado   = stock === 0;
      const estaBajo      = stock > 0 && stock <= stockMinimo;

      // ── Alerta STOCK_AGOTADO ──────────────────────────────────────────────
      if (tipoStockAgotado) {
        const alertaExistente = await alertaRepository.findActivaByProductoYTipo(
          producto.id, tipoStockAgotado.id, producto.id_restaurante ?? 0
        );

        if (estaAgotado && !alertaExistente) {
          await alertaRepository.create({
            id_tipo_alerta:  tipoStockAgotado.id,
            id_producto:     producto.id,
            id_restaurante:  producto.id_restaurante ?? 0,
            mensaje:         `"${producto.nombre}" está agotado (stock: 0)`,
            nivel_prioridad: tipoStockAgotado.prioridad_default,
          });
          eventBus.emit(EVENTS.STOCK_AGOTADO, { idProducto: producto.id, idRestaurante: producto.id_restaurante ?? 0, nombre: producto.nombre });
          creadas++;
        } else if (!estaAgotado && alertaExistente) {
          await alertaRepository.marcarLeida(alertaExistente.id);
          resueltas++;
        }
      }

      // ── Alerta STOCK_MINIMO ───────────────────────────────────────────────
      if (tipoStockMinimo) {
        const alertaExistente = await alertaRepository.findActivaByProductoYTipo(
          producto.id, tipoStockMinimo.id, producto.id_restaurante ?? 0
        );

        if (estaBajo && !alertaExistente) {
          await alertaRepository.create({
            id_tipo_alerta:  tipoStockMinimo.id,
            id_producto:     producto.id,
            id_restaurante:  producto.id_restaurante ?? 0,
            mensaje:         `"${producto.nombre}" está por debajo del stock mínimo (${stock} / ${stockMinimo})`,
            nivel_prioridad: tipoStockMinimo.prioridad_default,
          });
          eventBus.emit(EVENTS.STOCK_BAJO, { idProducto: producto.id, idRestaurante: producto.id_restaurante ?? 0, nombreProducto: producto.nombre, stockActual: stock, stockMinimo });
          creadas++;
        } else if (!estaBajo && alertaExistente) {
          await alertaRepository.marcarLeida(alertaExistente.id);
          resueltas++;
        }
      }
    }

    // ── Alerta VENCIMIENTO (se evalúa sobre lotes, no productos) ─────────────
    // Se delega a sincronizarVencimientos() para mantener el método limpio
    if (tipoVencimiento) {
      const resultado = await this._sincronizarVencimientos(tipoVencimiento);
      creadas   += resultado.creadas;
      resueltas += resultado.resueltas;
    }

    return { creadas, resueltas };
  },

  /**
   * _sincronizarVencimientos — alerta sobre lotes próximos a vencer (≤ 7 días)
   */
  async _sincronizarVencimientos(tipoVencimiento: any): Promise<{ creadas: number; resueltas: number }> {
    const { default: prisma } = await import('../config/database');
    const limite = new Date();
    limite.setDate(limite.getDate() + 7);

    const lotesProximos = await prisma.lote.findMany({
      where: {
        fecha_vencimiento: { lte: limite, gte: new Date() },
        estado_lote: { in: ['activo', 'en_produccion'] },
      },
      include: { producto: true },
    });

    let creadas   = 0;
    let resueltas = 0;

    for (const lote of lotesProximos) {
      const alertaExistente = await alertaRepository.findActivaByProductoYTipo(
        lote.id_producto, tipoVencimiento.id, lote.id_restaurante
      );
      if (!alertaExistente) {
        const diasRestantes = Math.ceil(
          (lote.fecha_vencimiento!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        await alertaRepository.create({
          id_tipo_alerta:  tipoVencimiento.id,
          id_producto:     lote.id_producto,
          id_restaurante:  lote.id_restaurante,
          mensaje:         `Lote ${lote.numero_lote} de "${lote.producto.nombre}" vence en ${diasRestantes} día(s)`,
          nivel_prioridad: tipoVencimiento.prioridad_default,
        });
        eventBus.emit(EVENTS.LOTE_VENCIDO, {
          idLote:           lote.id,
          idProducto:       lote.id_producto,
          idRestaurante:    lote.id_restaurante,
          nombreProducto:   lote.producto.nombre,
          fechaVencimiento: lote.fecha_vencimiento!,
        });
        creadas++;
      }
    }

    return { creadas, resueltas };
  },
};
