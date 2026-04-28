"use strict";
/**
 * FacturaService - Lógica de negocio para facturas
 *
 * generarDesdeOrden() es llamado internamente por orden.service
 * cuando una orden pasa al estado EN_PREPARACION.
 * Acepta una transacción Prisma (tx) para ejecutarse dentro
 * del mismo atomic block que el cambio de estado.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.facturaService = void 0;
const database_1 = __importDefault(require("../config/database"));
const factura_repository_1 = require("../repositories/factura.repository");
const HttpErrors_1 = require("../exceptions/HttpErrors");
const pagination_1 = require("../lib/pagination");
const numero_generator_1 = require("../lib/numero-generator");
exports.facturaService = {
    async listar(params) {
        const pagination = (0, pagination_1.getPaginationParams)(params.page, params.limit);
        const [facturas, total] = await factura_repository_1.facturaRepository.findAll(pagination, {
            estado_factura: params.estado_factura,
            fecha_desde: params.fecha_desde,
            fecha_hasta: params.fecha_hasta,
        });
        return (0, pagination_1.buildPaginatedResult)(facturas, total, pagination);
    },
    async obtenerPorId(id) {
        const factura = await factura_repository_1.facturaRepository.findById(id);
        if (!factura)
            throw new HttpErrors_1.NotFoundError('Factura');
        return factura;
    },
    async obtenerPorOrden(id_orden) {
        const factura = await factura_repository_1.facturaRepository.findByOrden(id_orden);
        if (!factura)
            throw new HttpErrors_1.NotFoundError('Factura');
        return factura;
    },
    /**
     * generarDesdeOrden — crea la factura automáticamente
     *
     * Recibe `tx` (transacción de Prisma) para ejecutarse en el mismo
     * bloque atómico que el cambio de estado EN_PREPARACION.
     * Si `tx` no se pasa, crea su propia transacción (para llamadas directas).
     *
     * Número generado secuencialmente: FAC-000001, FAC-000002...
     */
    async generarDesdeOrden(id_orden, tx) {
        const client = tx ?? database_1.default;
        const orden = await client.orden.findUnique({
            where: { id: id_orden },
            include: { detalles: true },
        });
        if (!orden)
            throw new HttpErrors_1.NotFoundError('Orden');
        // Buscar el último número de factura para generar el siguiente
        const ultima = await factura_repository_1.facturaRepository.findUltima();
        const numeroFactura = (0, numero_generator_1.generarNumeroFactura)(ultima?.numero_factura ?? null);
        return client.factura.create({
            data: {
                id_orden: id_orden,
                numero_factura: numeroFactura,
                estado_factura: 'pendiente',
                subtotal: orden.subtotal,
                impuestos: orden.impuestos,
                total: orden.total,
            },
        });
    },
};
//# sourceMappingURL=factura.service.js.map