"use strict";
/**
 * Servicio de Productos
 * Adaptado al schema real de Prisma
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductosService = void 0;
const client_1 = require("@prisma/client");
const library_1 = require("@prisma/client/runtime/library");
const logger_1 = __importDefault(require("../utils/logger"));
const prisma = new client_1.PrismaClient();
class ProductosService {
    async findAll(filter = {}) {
        const { search, categoria, estado, page = 1, limit = 50 } = filter;
        const skip = (page - 1) * limit;
        const where = {};
        if (search) {
            where.OR = [
                { nombre: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (categoria) {
            where.id_categoria = Number(categoria);
        }
        if (estado) {
            where.estado = estado;
        }
        const productos = await prisma.producto.findMany({
            where,
            include: {
                categoria: true,
            },
            orderBy: {
                nombre: 'asc',
            },
            skip,
            take: Number(limit),
        });
        logger_1.default.info(`Productos encontrados: ${productos.length}`);
        return productos;
    }
    async findById(id) {
        const producto = await prisma.producto.findUnique({
            where: { id },
            include: {
                categoria: true,
                movimientos: {
                    orderBy: { fecha_movimiento: 'desc' },
                    take: 10,
                },
            },
        });
        return producto;
    }
    async findBySKU(sku) {
        const producto = await prisma.producto.findUnique({
            where: { sku },
            include: {
                categoria: true,
            },
        });
        return producto;
    }
    async create(data) {
        const producto = await prisma.producto.create({
            data: {
                codigo_barras: data.codigo_barras,
                sku: data.sku,
                nombre: data.nombre,
                descripcion: data.descripcion,
                id_categoria: data.id_categoria,
                tipo_materia: data.tipo_materia,
                unidad_medida: data.unidad_medida,
                precio_unitario: new library_1.Decimal(data.precio_unitario),
                precio_venta: data.precio_venta ? new library_1.Decimal(data.precio_venta) : undefined,
                stock_actual: data.stock_actual !== undefined ? new library_1.Decimal(data.stock_actual) : new library_1.Decimal(0),
                stock_minimo: data.stock_minimo !== undefined ? new library_1.Decimal(data.stock_minimo) : new library_1.Decimal(0),
                stock_maximo: data.stock_maximo ? new library_1.Decimal(data.stock_maximo) : undefined,
                punto_reorden: data.punto_reorden ? new library_1.Decimal(data.punto_reorden) : undefined,
                dias_vida_util: data.dias_vida_util,
                requiere_refrigeracion: data.requiere_refrigeracion || false,
                imagen_url: data.imagen_url,
                es_vendible: data.es_vendible || false,
                estado: data.estado || client_1.EstadoGeneral.activo,
            },
            include: {
                categoria: true,
            },
        });
        logger_1.default.info(`Producto creado: ${producto.nombre} (${producto.sku})`);
        return producto;
    }
    async update(id, data) {
        const updateData = { ...data };
        // Convertir números a Decimal si están presentes
        if (data.precio_unitario !== undefined) {
            updateData.precio_unitario = new library_1.Decimal(data.precio_unitario);
        }
        if (data.precio_venta !== undefined) {
            updateData.precio_venta = new library_1.Decimal(data.precio_venta);
        }
        if (data.stock_actual !== undefined) {
            updateData.stock_actual = new library_1.Decimal(data.stock_actual);
        }
        if (data.stock_minimo !== undefined) {
            updateData.stock_minimo = new library_1.Decimal(data.stock_minimo);
        }
        if (data.stock_maximo !== undefined) {
            updateData.stock_maximo = new library_1.Decimal(data.stock_maximo);
        }
        if (data.punto_reorden !== undefined) {
            updateData.punto_reorden = new library_1.Decimal(data.punto_reorden);
        }
        const producto = await prisma.producto.update({
            where: { id },
            data: updateData,
            include: {
                categoria: true,
            },
        });
        logger_1.default.info(`Producto actualizado: ${producto.nombre} (${producto.sku})`);
        return producto;
    }
    async delete(id) {
        const producto = await prisma.producto.update({
            where: { id },
            data: { estado: client_1.EstadoGeneral.eliminado },
        });
        logger_1.default.info(`Producto eliminado (soft): ${producto.nombre}`);
        return producto;
    }
    async updateStock(id, cantidad, tipo) {
        return await prisma.$transaction(async (tx) => {
            const producto = await tx.producto.findUnique({
                where: { id },
            });
            if (!producto) {
                throw new Error('Producto no encontrado');
            }
            const stockActual = Number(producto.stock_actual);
            const nuevoStock = tipo === 'entrada'
                ? stockActual + cantidad
                : stockActual - cantidad;
            if (nuevoStock < 0) {
                throw new Error('Stock insuficiente');
            }
            const productoActualizado = await tx.producto.update({
                where: { id },
                data: { stock_actual: new library_1.Decimal(nuevoStock) },
                include: { categoria: true },
            });
            await tx.movimiento.create({
                data: {
                    id_producto: id,
                    tipo_movimiento: tipo,
                    cantidad: new library_1.Decimal(cantidad),
                    stock_anterior: new library_1.Decimal(stockActual),
                    stock_nuevo: new library_1.Decimal(nuevoStock),
                    motivo: `${tipo === 'entrada' ? 'Entrada' : 'Salida'} manual de inventario`,
                },
            });
            logger_1.default.info(`Stock actualizado para ${producto.nombre}: ${stockActual} → ${nuevoStock}`);
            return productoActualizado;
        });
    }
    async findStockBajo() {
        const productos = await prisma.producto.findMany({
            where: {
                estado: client_1.EstadoGeneral.activo,
            },
            include: {
                categoria: true,
            },
            orderBy: {
                stock_actual: 'asc',
            },
        });
        // Filtrar en memoria los que tienen stock <= stock_minimo
        const productosBajo = productos.filter(p => Number(p.stock_actual) <= Number(p.stock_minimo));
        logger_1.default.info(`Productos con stock bajo: ${productosBajo.length}`);
        return productosBajo;
    }
    async getEstadisticas() {
        const [total, activos, inactivos] = await Promise.all([
            prisma.producto.count(),
            prisma.producto.count({
                where: { estado: client_1.EstadoGeneral.activo },
            }),
            prisma.producto.count({
                where: { estado: client_1.EstadoGeneral.inactivo },
            }),
        ]);
        const productosActivos = await prisma.producto.findMany({
            where: { estado: client_1.EstadoGeneral.activo },
            select: {
                stock_actual: true,
                stock_minimo: true,
            },
        });
        const stockBajo = productosActivos.filter(p => Number(p.stock_actual) <= Number(p.stock_minimo)).length;
        // Calcular valor total del inventario
        let valorTotal = 0;
        const productosConValor = await prisma.producto.findMany({
            where: { estado: client_1.EstadoGeneral.activo },
            select: {
                stock_actual: true,
                precio_unitario: true,
            },
        });
        productosConValor.forEach(p => {
            valorTotal += Number(p.stock_actual) * Number(p.precio_unitario);
        });
        return {
            total,
            activos,
            inactivos,
            stockBajo,
            valorTotal,
        };
    }
}
exports.ProductosService = ProductosService;
//# sourceMappingURL=productos.service.js.map