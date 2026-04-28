"use strict";
/**
 * ProveedorService - Lógica de negocio para proveedores y sus productos
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.proveedorService = void 0;
const client_1 = require("@prisma/client");
const proveedor_repository_1 = require("../repositories/proveedor.repository");
const HttpErrors_1 = require("../exceptions/HttpErrors");
const decimal_1 = require("../lib/decimal");
const pagination_1 = require("../lib/pagination");
exports.proveedorService = {
    async listar(params) {
        const pagination = (0, pagination_1.getPaginationParams)(params.page, params.limit);
        const [proveedores, total] = await proveedor_repository_1.proveedorRepository.findAll(pagination, {
            search: params.search,
            estado: params.estado,
        });
        return (0, pagination_1.buildPaginatedResult)(proveedores, total, pagination);
    },
    async obtenerPorId(id) {
        const proveedor = await proveedor_repository_1.proveedorRepository.findById(id);
        if (!proveedor)
            throw new HttpErrors_1.NotFoundError('Proveedor');
        return proveedor;
    },
    async crear(data) {
        if (data.nit) {
            const existe = await proveedor_repository_1.proveedorRepository.findByNit(data.nit);
            if (existe)
                throw new HttpErrors_1.ConflictError('Ya existe un proveedor con ese NIT');
        }
        return proveedor_repository_1.proveedorRepository.create(data);
    },
    async actualizar(id, data) {
        await this.obtenerPorId(id);
        if (data.nit) {
            const existe = await proveedor_repository_1.proveedorRepository.findByNit(data.nit, id);
            if (existe)
                throw new HttpErrors_1.ConflictError('Ya existe un proveedor con ese NIT');
        }
        return proveedor_repository_1.proveedorRepository.update(id, data);
    },
    async cambiarEstado(id, estado) {
        await this.obtenerPorId(id);
        return proveedor_repository_1.proveedorRepository.update(id, { estado });
    },
    // ─── ProveedorProducto ───────────────────────────────────────────────────────
    async listarProductos(id_proveedor) {
        await this.obtenerPorId(id_proveedor);
        return proveedor_repository_1.proveedorRepository.findProductosByProveedor(id_proveedor);
    },
    async asociarProducto(id_proveedor, data) {
        await this.obtenerPorId(id_proveedor);
        const existe = await proveedor_repository_1.proveedorRepository.findRelacion(id_proveedor, data.id_producto);
        if (existe)
            throw new HttpErrors_1.ConflictError('Ese producto ya está asociado a este proveedor');
        return proveedor_repository_1.proveedorRepository.createRelacion({
            id_proveedor,
            id_producto: data.id_producto,
            precio_unitario: (0, decimal_1.toDecimal)(data.precio_unitario),
            tiempo_entrega: data.tiempo_entrega,
            cantidad_minima: data.cantidad_minima != null ? (0, decimal_1.toDecimal)(data.cantidad_minima) : undefined,
            es_proveedor_preferido: data.es_proveedor_preferido ?? false,
        });
    },
    async actualizarRelacion(id_proveedor, id_producto, data) {
        const existe = await proveedor_repository_1.proveedorRepository.findRelacion(id_proveedor, id_producto);
        if (!existe)
            throw new HttpErrors_1.NotFoundError('Relación proveedor-producto');
        return proveedor_repository_1.proveedorRepository.updateRelacion(id_proveedor, id_producto, {
            ...(data.precio_unitario != null && { precio_unitario: (0, decimal_1.toDecimal)(data.precio_unitario) }),
            ...(data.tiempo_entrega != null && { tiempo_entrega: data.tiempo_entrega }),
            ...(data.cantidad_minima != null && { cantidad_minima: (0, decimal_1.toDecimal)(data.cantidad_minima) }),
            ...(data.es_proveedor_preferido != null && { es_proveedor_preferido: data.es_proveedor_preferido }),
        });
    },
    async desasociarProducto(id_proveedor, id_producto) {
        const existe = await proveedor_repository_1.proveedorRepository.findRelacion(id_proveedor, id_producto);
        if (!existe)
            throw new HttpErrors_1.NotFoundError('Relación proveedor-producto');
        return proveedor_repository_1.proveedorRepository.updateRelacion(id_proveedor, id_producto, {
            estado: client_1.EstadoGeneral.inactivo,
        });
    },
};
//# sourceMappingURL=proveedor.service.js.map