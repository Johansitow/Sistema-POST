"use strict";
/**
 * ProductoService - Solo lógica de negocio para productos
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.productoService = void 0;
const client_1 = require("@prisma/client");
const producto_repository_1 = require("../repositories/producto.repository");
const movimiento_repository_1 = require("../repositories/movimiento.repository");
const HttpErrors_1 = require("../exceptions/HttpErrors");
const decimal_1 = require("../lib/decimal");
const pagination_1 = require("../lib/pagination");
exports.productoService = {
    async listar(params) {
        const pagination = (0, pagination_1.getPaginationParams)(params.page, params.limit);
        const [productos, total] = await producto_repository_1.productoRepository.findAll(pagination, {
            search: params.search,
            id_categoria: params.categoria,
            estado: params.estado,
        });
        return (0, pagination_1.buildPaginatedResult)(productos, total, pagination);
    },
    async obtenerPorId(id) {
        const producto = await producto_repository_1.productoRepository.findById(id);
        if (!producto)
            throw new HttpErrors_1.NotFoundError('Producto');
        return producto;
    },
    async obtenerPorSKU(sku) {
        const producto = await producto_repository_1.productoRepository.findBySKU(sku);
        if (!producto)
            throw new HttpErrors_1.NotFoundError('Producto');
        return producto;
    },
    async crear(data) {
        const existeSKU = await producto_repository_1.productoRepository.findBySKU(data.sku);
        if (existeSKU)
            throw new HttpErrors_1.ConflictError('Ya existe un producto con ese SKU');
        return producto_repository_1.productoRepository.create({
            ...data,
            precio_unitario: (0, decimal_1.toDecimal)(data.precio_unitario),
            precio_venta: data.precio_venta != null ? (0, decimal_1.toDecimal)(data.precio_venta) : undefined,
            stock_actual: data.stock_actual != null ? (0, decimal_1.toDecimal)(data.stock_actual) : (0, decimal_1.toDecimal)(0),
            stock_minimo: data.stock_minimo != null ? (0, decimal_1.toDecimal)(data.stock_minimo) : (0, decimal_1.toDecimal)(0),
            stock_maximo: data.stock_maximo != null ? (0, decimal_1.toDecimal)(data.stock_maximo) : undefined,
            punto_reorden: data.punto_reorden != null ? (0, decimal_1.toDecimal)(data.punto_reorden) : undefined,
        });
    },
    async actualizar(id, data) {
        const existente = await this.obtenerPorId(id);
        if (data.sku && data.sku !== existente.sku) {
            const existeSKU = await producto_repository_1.productoRepository.findBySKU(data.sku);
            if (existeSKU)
                throw new HttpErrors_1.ConflictError('Ya existe un producto con ese SKU');
        }
        const updateData = { ...data };
        if (data.precio_unitario != null)
            updateData.precio_unitario = (0, decimal_1.toDecimal)(data.precio_unitario);
        if (data.precio_venta != null)
            updateData.precio_venta = (0, decimal_1.toDecimal)(data.precio_venta);
        if (data.stock_actual != null)
            updateData.stock_actual = (0, decimal_1.toDecimal)(data.stock_actual);
        if (data.stock_minimo != null)
            updateData.stock_minimo = (0, decimal_1.toDecimal)(data.stock_minimo);
        if (data.stock_maximo != null)
            updateData.stock_maximo = (0, decimal_1.toDecimal)(data.stock_maximo);
        if (data.punto_reorden != null)
            updateData.punto_reorden = (0, decimal_1.toDecimal)(data.punto_reorden);
        return producto_repository_1.productoRepository.update(id, updateData);
    },
    async eliminar(id) {
        await this.obtenerPorId(id);
        return producto_repository_1.productoRepository.softDelete(id);
    },
    async actualizarStock(id, cantidad, tipo) {
        const producto = await this.obtenerPorId(id);
        const stockActual = Number(producto.stock_actual);
        const nuevoStock = tipo === 'entrada' ? stockActual + cantidad : stockActual - cantidad;
        if (nuevoStock < 0)
            throw new HttpErrors_1.BadRequestError('Stock insuficiente');
        await producto_repository_1.productoRepository.updateStock(id, (0, decimal_1.toDecimal)(nuevoStock));
        await movimiento_repository_1.movimientoRepository.create({
            id_producto: id,
            tipo_movimiento: tipo,
            cantidad: (0, decimal_1.toDecimal)(cantidad),
            stock_anterior: (0, decimal_1.toDecimal)(stockActual),
            stock_nuevo: (0, decimal_1.toDecimal)(nuevoStock),
            motivo: `${tipo === 'entrada' ? 'Entrada' : 'Salida'} manual de inventario`,
        });
        return producto_repository_1.productoRepository.findById(id);
    },
    async stockBajo() {
        const productos = await producto_repository_1.productoRepository.findActivos();
        return productos.filter(p => Number(p.stock_actual) <= Number(p.stock_minimo));
    },
    async estadisticas() {
        const [total, activos, inactivos, todos] = await Promise.all([
            producto_repository_1.productoRepository.count(),
            producto_repository_1.productoRepository.countByEstado(client_1.EstadoGeneral.activo),
            producto_repository_1.productoRepository.countByEstado(client_1.EstadoGeneral.inactivo),
            producto_repository_1.productoRepository.findActivos(),
        ]);
        const stockBajo = todos.filter(p => Number(p.stock_actual) <= Number(p.stock_minimo)).length;
        const valorTotal = todos.reduce((s, p) => s + Number(p.stock_actual) * Number(p.precio_unitario), 0);
        return { total, activos, inactivos, stockBajo, valorTotal };
    },
};
//# sourceMappingURL=producto.service.js.map