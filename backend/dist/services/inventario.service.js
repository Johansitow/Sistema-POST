"use strict";
/**
 * InventarioService - Solo lógica de negocio para inventario
 *
 * Cambios respecto a la versión anterior:
 * 1. registrarMovimiento() requiere id_proveedor cuando tipo = 'entrada'
 * 2. Al registrar una entrada se crea automáticamente un lote
 *    con número secuencial global (LOTE-000001, LOTE-000002...)
 * 3. El id del lote generado se asocia al movimiento
 *
 * Correcciones de TypeScript:
 * - TIPOS_ENTRADA y TIPOS_SALIDA tipados como Set<TipoMovimiento> (fix error 2345)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inventarioService = void 0;
const client_1 = require("@prisma/client");
const database_1 = __importDefault(require("../config/database"));
const movimiento_repository_1 = require("../repositories/movimiento.repository");
const producto_repository_1 = require("../repositories/producto.repository");
const lote_repository_1 = require("../repositories/lote.repository");
const HttpErrors_1 = require("../exceptions/HttpErrors");
const decimal_1 = require("../lib/decimal");
const pagination_1 = require("../lib/pagination");
const numero_generator_1 = require("../lib/numero-generator");
/** Tipos de movimiento que incrementan stock */
const TIPOS_ENTRADA = new Set([
    client_1.TipoMovimiento.entrada,
    client_1.TipoMovimiento.produccion,
    client_1.TipoMovimiento.devolucion,
]);
/** Tipos de movimiento que decrementan stock */
const TIPOS_SALIDA = new Set([
    client_1.TipoMovimiento.salida,
    client_1.TipoMovimiento.merma,
    client_1.TipoMovimiento.venta,
]);
exports.inventarioService = {
    async listarMovimientos(params) {
        const pagination = (0, pagination_1.getPaginationParams)(params.page, params.limit);
        const [movimientos, total] = await movimiento_repository_1.movimientoRepository.findAll(pagination, {
            id_producto: params.id_producto,
            tipo: params.tipo,
            fecha_desde: params.fecha_desde,
            fecha_hasta: params.fecha_hasta,
        });
        return (0, pagination_1.buildPaginatedResult)(movimientos, total, pagination);
    },
    /**
     * registrarMovimiento — registra un movimiento de inventario
     *
     * Reglas:
     * - tipo 'entrada': id_proveedor es REQUERIDO, se crea un lote automáticamente
     * - tipo 'salida' / 'merma' / 'venta': verifica stock suficiente
     * - tipo 'ajuste': establece el stock en el valor exacto recibido
     * - tipo 'produccion' / 'devolucion': incrementa sin requerir proveedor
     *
     * El lote generado tiene número secuencial global (LOTE-000001...).
     * fecha_vencimiento y costo_produccion son opcionales en el lote.
     */
    async registrarMovimiento(data) {
        // Validar proveedor obligatorio en entradas
        if (data.tipo_movimiento === client_1.TipoMovimiento.entrada && !data.id_proveedor) {
            throw new HttpErrors_1.BadRequestError('El proveedor es obligatorio para registrar una entrada de inventario');
        }
        return database_1.default.$transaction(async (tx) => {
            const producto = await tx.producto.findUnique({ where: { id: data.id_producto } });
            if (!producto)
                throw new HttpErrors_1.NotFoundError('Producto');
            const stockActual = Number(producto.stock_actual);
            let nuevoStock = stockActual;
            let id_lote;
            if (TIPOS_ENTRADA.has(data.tipo_movimiento)) {
                nuevoStock = stockActual + data.cantidad;
                // Crear lote automáticamente para entradas
                if (data.tipo_movimiento === client_1.TipoMovimiento.entrada) {
                    const ultimoLote = await lote_repository_1.loteRepository.findUltimo();
                    const numeroLote = (0, numero_generator_1.generarNumeroLote)(ultimoLote?.numero_lote ?? null);
                    const lote = await tx.lote.create({
                        data: {
                            numero_lote: numeroLote,
                            id_producto: data.id_producto,
                            cantidad_producida: (0, decimal_1.toDecimal)(data.cantidad),
                            fecha_vencimiento: data.fecha_vencimiento,
                            costo_produccion: data.costo_produccion != null
                                ? (0, decimal_1.toDecimal)(data.costo_produccion)
                                : undefined,
                            observaciones: data.observaciones_lote,
                        },
                    });
                    id_lote = lote.id;
                }
            }
            else if (TIPOS_SALIDA.has(data.tipo_movimiento)) {
                if (stockActual < data.cantidad) {
                    throw new HttpErrors_1.BadRequestError(`Stock insuficiente. Actual: ${stockActual}, requerido: ${data.cantidad}`);
                }
                nuevoStock = stockActual - data.cantidad;
            }
            else if (data.tipo_movimiento === client_1.TipoMovimiento.ajuste) {
                nuevoStock = data.cantidad; // ajuste directo al valor exacto
            }
            // Actualizar stock del producto
            await tx.producto.update({
                where: { id: data.id_producto },
                data: { stock_actual: (0, decimal_1.toDecimal)(nuevoStock) },
            });
            // Registrar el movimiento
            const movimiento = await tx.movimiento.create({
                data: {
                    id_producto: data.id_producto,
                    tipo_movimiento: data.tipo_movimiento,
                    cantidad: (0, decimal_1.toDecimal)(data.cantidad),
                    stock_anterior: (0, decimal_1.toDecimal)(stockActual),
                    stock_nuevo: (0, decimal_1.toDecimal)(nuevoStock),
                    motivo: data.motivo,
                    id_proveedor: data.id_proveedor,
                    id_lote: id_lote,
                    referencia: data.referencia,
                },
                include: { producto: true },
            });
            return {
                movimiento,
                lote_generado: id_lote ? await tx.lote.findUnique({ where: { id: id_lote } }) : null,
            };
        });
    },
    async estadisticasMovimientos(dias = 30) {
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - dias);
        const [porTipo, total, afectados] = await Promise.all([
            movimiento_repository_1.movimientoRepository.groupByTipo(fechaInicio),
            movimiento_repository_1.movimientoRepository.count(fechaInicio),
            movimiento_repository_1.movimientoRepository.findDistinctProductos(fechaInicio),
        ]);
        return {
            porTipo: porTipo.map(t => ({
                tipo: t.tipo_movimiento,
                cantidad_movimientos: t._count,
                cantidad_total: Number(t._sum.cantidad ?? 0),
            })),
            totalMovimientos: total,
            productosAfectados: afectados.length,
            periodo: `${dias} días`,
        };
    },
    async listarLotes(params) {
        const pagination = (0, pagination_1.getPaginationParams)(params.page, params.limit);
        const [lotes, total] = await lote_repository_1.loteRepository.findAll(pagination, {
            id_producto: params.id_producto,
            estado_lote: params.estado_lote,
            vence_antes_de: params.vence_antes_de,
        });
        return (0, pagination_1.buildPaginatedResult)(lotes, total, pagination);
    },
    async lotesProximosVencer(dias = 30) {
        const fechaLimite = new Date();
        fechaLimite.setDate(fechaLimite.getDate() + dias);
        return database_1.default.lote.findMany({
            where: {
                fecha_vencimiento: { lte: fechaLimite, gte: new Date() },
                estado_lote: { in: ['activo', 'en_produccion'] },
            },
            include: { producto: { include: { categoria: true } } },
            orderBy: { fecha_vencimiento: 'asc' },
        });
    },
    async actualizarEstadoLote(id, data) {
        const lote = await lote_repository_1.loteRepository.findById(id);
        if (!lote)
            throw new HttpErrors_1.NotFoundError('Lote');
        return lote_repository_1.loteRepository.update(id, data);
    },
    async valorInventario() {
        const productos = await producto_repository_1.productoRepository.findActivos();
        const conValor = productos
            .filter(p => Number(p.stock_actual) > 0)
            .map(p => ({
            ...p,
            stock_actual: Number(p.stock_actual),
            precio_unitario: Number(p.precio_unitario),
            valor_total: Number(p.stock_actual) * Number(p.precio_unitario),
        }));
        const valorTotal = conValor.reduce((sum, p) => sum + p.valor_total, 0);
        const porCategoria = conValor.reduce((acc, p) => {
            const cat = p.categoria?.nombre ?? 'Sin categoría';
            if (!acc[cat])
                acc[cat] = { nombre: cat, productos: 0, valor: 0 };
            acc[cat].productos++;
            acc[cat].valor += p.valor_total;
            return acc;
        }, {});
        return {
            valorTotal, totalProductos: conValor.length,
            productos: conValor, porCategoria: Object.values(porCategoria),
        };
    },
    async alertasInventario() {
        const productos = await producto_repository_1.productoRepository.findActivos();
        const stockBajo = productos.filter(p => Number(p.stock_actual) > 0 && Number(p.stock_actual) <= Number(p.stock_minimo));
        const stockAgotado = productos.filter(p => Number(p.stock_actual) === 0);
        return { stockBajo, stockAgotado, totalAlertas: stockBajo.length + stockAgotado.length };
    },
};
//# sourceMappingURL=inventario.service.js.map