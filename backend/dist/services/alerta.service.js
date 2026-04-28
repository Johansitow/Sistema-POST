"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertaService = void 0;
const alerta_repository_1 = require("../repositories/alerta.repository");
const producto_repository_1 = require("../repositories/producto.repository");
const HttpErrors_1 = require("../exceptions/HttpErrors");
const pagination_1 = require("../lib/pagination");
exports.alertaService = {
    // ─── TiposAlerta ─────────────────────────────────────────────────────────────
    async listarTipos() {
        return alerta_repository_1.alertaRepository.findTipoAll();
    },
    async crearTipo(data) {
        const existe = await alerta_repository_1.alertaRepository.findTipoByCodigo(data.codigo);
        if (existe)
            throw new HttpErrors_1.ConflictError('Ya existe un tipo de alerta con ese código');
        return alerta_repository_1.alertaRepository.createTipo(data);
    },
    async actualizarTipo(id, data) {
        const tipo = await alerta_repository_1.alertaRepository.findTipoById(id);
        if (!tipo)
            throw new HttpErrors_1.NotFoundError('Tipo de alerta');
        return alerta_repository_1.alertaRepository.updateTipo(id, data);
    },
    // ─── Alertas ─────────────────────────────────────────────────────────────────
    async listar(params) {
        const pagination = (0, pagination_1.getPaginationParams)(params.page, params.limit);
        const [alertas, total] = await alerta_repository_1.alertaRepository.findAll(pagination, {
            es_leida: params.es_leida,
            nivel_prioridad: params.nivel_prioridad,
            id_tipo_alerta: params.id_tipo_alerta,
        });
        return (0, pagination_1.buildPaginatedResult)(alertas, total, pagination);
    },
    async countNoLeidas() {
        const total = await alerta_repository_1.alertaRepository.countNoLeidas();
        return { total };
    },
    async marcarLeida(id) {
        return alerta_repository_1.alertaRepository.marcarLeida(id);
    },
    async marcarTodasLeidas() {
        await alerta_repository_1.alertaRepository.marcarTodasLeidas();
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
    async sincronizar() {
        const [productos, tipos] = await Promise.all([
            producto_repository_1.productoRepository.findActivos(),
            alerta_repository_1.alertaRepository.findTipoAll(),
        ]);
        const tipoStockMinimo = tipos.find(t => t.codigo === 'STOCK_MINIMO');
        const tipoStockAgotado = tipos.find(t => t.codigo === 'STOCK_AGOTADO');
        const tipoVencimiento = tipos.find(t => t.codigo === 'VENCIMIENTO');
        let creadas = 0;
        let resueltas = 0;
        for (const producto of productos) {
            const stock = Number(producto.stock_actual);
            const stockMinimo = Number(producto.stock_minimo);
            const estaAgotado = stock === 0;
            const estaBajo = stock > 0 && stock <= stockMinimo;
            // ── Alerta STOCK_AGOTADO ──────────────────────────────────────────────
            if (tipoStockAgotado) {
                const alertaExistente = await alerta_repository_1.alertaRepository.findActivaByProductoYTipo(producto.id, tipoStockAgotado.id);
                if (estaAgotado && !alertaExistente) {
                    await alerta_repository_1.alertaRepository.create({
                        id_tipo_alerta: tipoStockAgotado.id,
                        id_producto: producto.id,
                        mensaje: `"${producto.nombre}" está agotado (stock: 0)`,
                        nivel_prioridad: tipoStockAgotado.prioridad_default,
                    });
                    creadas++;
                }
                else if (!estaAgotado && alertaExistente) {
                    await alerta_repository_1.alertaRepository.marcarLeida(alertaExistente.id);
                    resueltas++;
                }
            }
            // ── Alerta STOCK_MINIMO ───────────────────────────────────────────────
            if (tipoStockMinimo) {
                const alertaExistente = await alerta_repository_1.alertaRepository.findActivaByProductoYTipo(producto.id, tipoStockMinimo.id);
                if (estaBajo && !alertaExistente) {
                    await alerta_repository_1.alertaRepository.create({
                        id_tipo_alerta: tipoStockMinimo.id,
                        id_producto: producto.id,
                        mensaje: `"${producto.nombre}" está por debajo del stock mínimo (${stock} / ${stockMinimo})`,
                        nivel_prioridad: tipoStockMinimo.prioridad_default,
                    });
                    creadas++;
                }
                else if (!estaBajo && alertaExistente) {
                    await alerta_repository_1.alertaRepository.marcarLeida(alertaExistente.id);
                    resueltas++;
                }
            }
        }
        // ── Alerta VENCIMIENTO (se evalúa sobre lotes, no productos) ─────────────
        // Se delega a sincronizarVencimientos() para mantener el método limpio
        if (tipoVencimiento) {
            const resultado = await this._sincronizarVencimientos(tipoVencimiento);
            creadas += resultado.creadas;
            resueltas += resultado.resueltas;
        }
        return { creadas, resueltas };
    },
    /**
     * _sincronizarVencimientos — alerta sobre lotes próximos a vencer (≤ 7 días)
     */
    async _sincronizarVencimientos(tipoVencimiento) {
        const { default: prisma } = await Promise.resolve().then(() => __importStar(require('../config/database')));
        const limite = new Date();
        limite.setDate(limite.getDate() + 7);
        const lotesProximos = await prisma.lote.findMany({
            where: {
                fecha_vencimiento: { lte: limite, gte: new Date() },
                estado_lote: { in: ['activo', 'en_produccion'] },
            },
            include: { producto: true },
        });
        let creadas = 0;
        let resueltas = 0;
        for (const lote of lotesProximos) {
            const alertaExistente = await alerta_repository_1.alertaRepository.findActivaByProductoYTipo(lote.id_producto, tipoVencimiento.id);
            if (!alertaExistente) {
                const diasRestantes = Math.ceil((lote.fecha_vencimiento.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                await alerta_repository_1.alertaRepository.create({
                    id_tipo_alerta: tipoVencimiento.id,
                    id_producto: lote.id_producto,
                    mensaje: `Lote ${lote.numero_lote} de "${lote.producto.nombre}" vence en ${diasRestantes} día(s)`,
                    nivel_prioridad: tipoVencimiento.prioridad_default,
                });
                creadas++;
            }
        }
        return { creadas, resueltas };
    },
};
//# sourceMappingURL=alerta.service.js.map