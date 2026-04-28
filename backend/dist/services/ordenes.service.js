"use strict";
/**
 * Servicio de Órdenes
 * Adaptado al schema real de Prisma
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdenesService = void 0;
const client_1 = require("@prisma/client");
const library_1 = require("@prisma/client/runtime/library");
const logger_1 = __importDefault(require("../utils/logger"));
const prisma = new client_1.PrismaClient();
class OrdenesService {
    async findAll(filter = {}) {
        const { tipo_orden, id_estado, fecha_desde, fecha_hasta, page = 1, limit = 20, } = filter;
        const skip = (page - 1) * limit;
        const where = {};
        if (tipo_orden)
            where.tipo_orden = tipo_orden;
        if (id_estado)
            where.id_estado = id_estado;
        if (fecha_desde || fecha_hasta) {
            where.fecha_apertura = {};
            if (fecha_desde)
                where.fecha_apertura.gte = fecha_desde;
            if (fecha_hasta)
                where.fecha_apertura.lte = fecha_hasta;
        }
        const ordenes = await prisma.orden.findMany({
            where,
            include: {
                estado: true,
                usuario: {
                    select: {
                        id: true,
                        nombre_completo: true,
                        email: true,
                    },
                },
                detalles: {
                    include: {
                        producto: true,
                    },
                },
            },
            orderBy: {
                fecha_apertura: 'desc',
            },
            skip,
            take: limit,
        });
        return ordenes;
    }
    async findById(id) {
        const orden = await prisma.orden.findUnique({
            where: { id },
            include: {
                estado: true,
                usuario: {
                    select: {
                        id: true,
                        nombre_completo: true,
                        email: true,
                    },
                },
                detalles: {
                    include: {
                        producto: true,
                    },
                },
                pagos: {
                    include: {
                        metodo_pago: true,
                    },
                },
            },
        });
        return orden;
    }
    async create(data) {
        return await prisma.$transaction(async (tx) => {
            // Generar número de orden único
            const lastOrden = await tx.orden.findFirst({
                orderBy: { numero_orden: 'desc' },
            });
            const siguienteNumero = lastOrden
                ? parseInt(lastOrden.numero_orden.replace(/\D/g, '')) + 1
                : 1;
            const numeroOrden = `ORD-${siguienteNumero.toString().padStart(6, '0')}`;
            // Validar stock y preparar detalles
            let subtotal = new library_1.Decimal(0);
            const detallesData = [];
            for (const detalle of data.detalles) {
                const producto = await tx.producto.findUnique({
                    where: { id: detalle.id_producto },
                });
                if (!producto) {
                    throw new Error(`Producto ${detalle.id_producto} no encontrado`);
                }
                const stockDisponible = Number(producto.stock_actual);
                if (stockDisponible < detalle.cantidad) {
                    throw new Error(`Stock insuficiente para ${producto.nombre}. Disponible: ${stockDisponible}`);
                }
                const precioUnitario = new library_1.Decimal(detalle.precio_unitario);
                const cantidad = new library_1.Decimal(detalle.cantidad);
                const descuento = new library_1.Decimal(detalle.descuento || 0);
                const subtotalDetalle = precioUnitario.times(cantidad);
                const totalDetalle = subtotalDetalle.minus(descuento);
                subtotal = subtotal.plus(subtotalDetalle);
                detallesData.push({
                    id_producto: detalle.id_producto,
                    cantidad,
                    precio_unitario: precioUnitario,
                    subtotal: subtotalDetalle,
                    descuento,
                    total: totalDetalle,
                    notas: detalle.notas,
                });
            }
            // Calcular totales
            const descuentoOrden = new library_1.Decimal(data.descuento || 0);
            const propina = new library_1.Decimal(data.propina || 0);
            const costoDomicilio = new library_1.Decimal(data.costo_domicilio || 0);
            const subtotalFinal = subtotal.minus(descuentoOrden);
            const impuestos = subtotalFinal.times(0.19); // IVA 19%
            const total = subtotalFinal.plus(impuestos).plus(propina).plus(costoDomicilio);
            // Crear orden con detalles
            const orden = await tx.orden.create({
                data: {
                    numero_orden: numeroOrden,
                    tipo_orden: data.tipo_orden,
                    id_estado: data.id_estado,
                    id_usuario: data.id_usuario,
                    direccion_entrega: data.direccion_entrega,
                    telefono_contacto: data.telefono_contacto,
                    nombre_contacto: data.nombre_contacto,
                    notas_entrega: data.notas_entrega,
                    costo_domicilio: costoDomicilio,
                    plataforma_delivery: data.plataforma_delivery,
                    subtotal,
                    descuento: descuentoOrden,
                    impuestos,
                    propina,
                    total,
                    observaciones: data.observaciones,
                    detalles: {
                        create: detallesData,
                    },
                },
                include: {
                    estado: true,
                    detalles: {
                        include: {
                            producto: true,
                        },
                    },
                },
            });
            // Reducir stock y registrar movimientos
            for (const detalle of data.detalles) {
                const producto = await tx.producto.findUnique({
                    where: { id: detalle.id_producto },
                });
                if (!producto)
                    continue;
                const nuevoStock = Number(producto.stock_actual) - detalle.cantidad;
                await tx.producto.update({
                    where: { id: detalle.id_producto },
                    data: {
                        stock_actual: new library_1.Decimal(nuevoStock),
                    },
                });
                await tx.movimiento.create({
                    data: {
                        id_producto: detalle.id_producto,
                        tipo_movimiento: client_1.TipoMovimiento.venta,
                        cantidad: new library_1.Decimal(detalle.cantidad),
                        stock_anterior: producto.stock_actual,
                        stock_nuevo: new library_1.Decimal(nuevoStock),
                        motivo: `Venta - Orden ${numeroOrden}`,
                        id_orden: orden.id,
                    },
                });
            }
            logger_1.default.info(`Orden creada: ${numeroOrden}, Total: $${orden.total}`);
            return orden;
        });
    }
    async update(id, data) {
        const updateData = {};
        if (data.id_estado !== undefined)
            updateData.id_estado = data.id_estado;
        if (data.direccion_entrega !== undefined)
            updateData.direccion_entrega = data.direccion_entrega;
        if (data.telefono_contacto !== undefined)
            updateData.telefono_contacto = data.telefono_contacto;
        if (data.nombre_contacto !== undefined)
            updateData.nombre_contacto = data.nombre_contacto;
        if (data.notas_entrega !== undefined)
            updateData.notas_entrega = data.notas_entrega;
        if (data.costo_domicilio !== undefined)
            updateData.costo_domicilio = new library_1.Decimal(data.costo_domicilio);
        if (data.plataforma_delivery !== undefined)
            updateData.plataforma_delivery = data.plataforma_delivery;
        if (data.descuento !== undefined)
            updateData.descuento = new library_1.Decimal(data.descuento);
        if (data.propina !== undefined)
            updateData.propina = new library_1.Decimal(data.propina);
        if (data.observaciones !== undefined)
            updateData.observaciones = data.observaciones;
        const orden = await prisma.orden.update({
            where: { id },
            data: updateData,
            include: {
                estado: true,
                detalles: {
                    include: {
                        producto: true,
                    },
                },
            },
        });
        logger_1.default.info(`Orden actualizada: ${orden.numero_orden}`);
        return orden;
    }
    async updateEstado(id, idEstado) {
        const orden = await prisma.orden.update({
            where: { id },
            data: { id_estado: idEstado },
            include: {
                estado: true,
                detalles: {
                    include: {
                        producto: true,
                    },
                },
            },
        });
        logger_1.default.info(`Orden ${orden.numero_orden} cambió de estado`);
        return orden;
    }
    async delete(id) {
        return await prisma.$transaction(async (tx) => {
            const orden = await tx.orden.findUnique({
                where: { id },
                include: { detalles: true },
            });
            if (!orden) {
                throw new Error('Orden no encontrada');
            }
            // Devolver stock
            for (const detalle of orden.detalles) {
                const producto = await tx.producto.findUnique({
                    where: { id: detalle.id_producto },
                });
                if (producto) {
                    const nuevoStock = Number(producto.stock_actual) + Number(detalle.cantidad);
                    await tx.producto.update({
                        where: { id: detalle.id_producto },
                        data: {
                            stock_actual: new library_1.Decimal(nuevoStock),
                        },
                    });
                }
            }
            // Eliminar detalles
            await tx.ordenDetalle.deleteMany({
                where: { id_orden: id },
            });
            // Eliminar orden
            await tx.orden.delete({
                where: { id },
            });
            logger_1.default.info(`Orden eliminada: ${orden.numero_orden}`);
        });
    }
    async addDetalle(ordenId, data) {
        return await prisma.$transaction(async (tx) => {
            const producto = await tx.producto.findUnique({
                where: { id: data.id_producto },
            });
            if (!producto) {
                throw new Error('Producto no encontrado');
            }
            const stockDisponible = Number(producto.stock_actual);
            if (stockDisponible < data.cantidad) {
                throw new Error('Stock insuficiente');
            }
            const precioUnitario = new library_1.Decimal(data.precio_unitario);
            const cantidad = new library_1.Decimal(data.cantidad);
            const descuento = new library_1.Decimal(data.descuento || 0);
            const subtotal = precioUnitario.times(cantidad);
            const total = subtotal.minus(descuento);
            const detalle = await tx.ordenDetalle.create({
                data: {
                    id_orden: ordenId,
                    id_producto: data.id_producto,
                    cantidad,
                    precio_unitario: precioUnitario,
                    subtotal,
                    descuento,
                    total,
                    notas: data.notas,
                },
                include: {
                    producto: true,
                },
            });
            // Recalcular totales de la orden
            await this.recalcularTotales(tx, ordenId);
            // Reducir stock
            const nuevoStock = stockDisponible - data.cantidad;
            await tx.producto.update({
                where: { id: data.id_producto },
                data: {
                    stock_actual: new library_1.Decimal(nuevoStock),
                },
            });
            logger_1.default.info(`Detalle agregado a orden #${ordenId}`);
            return detalle;
        });
    }
    async updateDetalle(detalleId, data) {
        return await prisma.$transaction(async (tx) => {
            const detalle = await tx.ordenDetalle.findUnique({
                where: { id: detalleId },
                include: { producto: true },
            });
            if (!detalle) {
                throw new Error('Detalle no encontrado');
            }
            const updateData = {};
            let diferenciaCantidad = 0;
            if (data.cantidad !== undefined && data.cantidad !== Number(detalle.cantidad)) {
                diferenciaCantidad = data.cantidad - Number(detalle.cantidad);
                if (diferenciaCantidad > 0) {
                    const stockDisponible = Number(detalle.producto.stock_actual);
                    if (stockDisponible < diferenciaCantidad) {
                        throw new Error('Stock insuficiente');
                    }
                }
                updateData.cantidad = new library_1.Decimal(data.cantidad);
                updateData.subtotal = detalle.precio_unitario.times(data.cantidad);
                updateData.total = updateData.subtotal.minus(detalle.descuento);
            }
            if (data.notas !== undefined) {
                updateData.notas = data.notas;
            }
            const detalleActualizado = await tx.ordenDetalle.update({
                where: { id: detalleId },
                data: updateData,
                include: { producto: true },
            });
            if (diferenciaCantidad !== 0) {
                const nuevoStock = Number(detalle.producto.stock_actual) - diferenciaCantidad;
                await tx.producto.update({
                    where: { id: detalle.id_producto },
                    data: {
                        stock_actual: new library_1.Decimal(nuevoStock),
                    },
                });
                await this.recalcularTotales(tx, detalle.id_orden);
            }
            return detalleActualizado;
        });
    }
    async removeDetalle(detalleId) {
        return await prisma.$transaction(async (tx) => {
            const detalle = await tx.ordenDetalle.findUnique({
                where: { id: detalleId },
            });
            if (!detalle) {
                throw new Error('Detalle no encontrado');
            }
            // Devolver stock
            const producto = await tx.producto.findUnique({
                where: { id: detalle.id_producto },
            });
            if (producto) {
                const nuevoStock = Number(producto.stock_actual) + Number(detalle.cantidad);
                await tx.producto.update({
                    where: { id: detalle.id_producto },
                    data: {
                        stock_actual: new library_1.Decimal(nuevoStock),
                    },
                });
            }
            await tx.ordenDetalle.delete({
                where: { id: detalleId },
            });
            await this.recalcularTotales(tx, detalle.id_orden);
            logger_1.default.info(`Detalle eliminado`);
        });
    }
    async recalcularTotales(tx, ordenId) {
        const detalles = await tx.ordenDetalle.findMany({
            where: { id_orden: ordenId },
        });
        const nuevoSubtotal = detalles.reduce((sum, d) => sum.plus(d.subtotal), new library_1.Decimal(0));
        const orden = await tx.orden.findUnique({ where: { id: ordenId } });
        if (!orden)
            return;
        const descuento = orden.descuento || new library_1.Decimal(0);
        const propina = orden.propina || new library_1.Decimal(0);
        const costoDomicilio = orden.costo_domicilio || new library_1.Decimal(0);
        const subtotalFinal = nuevoSubtotal.minus(descuento);
        const impuestos = subtotalFinal.times(0.19);
        const total = subtotalFinal.plus(impuestos).plus(propina).plus(costoDomicilio);
        await tx.orden.update({
            where: { id: ordenId },
            data: {
                subtotal: nuevoSubtotal,
                impuestos,
                total,
            },
        });
    }
    async getEstadisticas(filter = {}) {
        const where = {};
        if (filter.fecha_desde || filter.fecha_hasta) {
            where.fecha_apertura = {};
            if (filter.fecha_desde)
                where.fecha_apertura.gte = filter.fecha_desde;
            if (filter.fecha_hasta)
                where.fecha_apertura.lte = filter.fecha_hasta;
        }
        const [total, porEstado, porTipo, ventasTotales, promedio,] = await Promise.all([
            prisma.orden.count({ where }),
            prisma.orden.groupBy({
                by: ['id_estado'],
                where,
                _count: true,
            }),
            prisma.orden.groupBy({
                by: ['tipo_orden'],
                where,
                _count: true,
            }),
            prisma.orden.aggregate({
                where,
                _sum: { total: true },
            }),
            prisma.orden.aggregate({
                where,
                _avg: { total: true },
            }),
        ]);
        return {
            total,
            porEstado,
            porTipo,
            ventasTotales: Number(ventasTotales._sum.total || 0),
            promedioVenta: Number(promedio._avg.total || 0),
        };
    }
}
exports.OrdenesService = OrdenesService;
//# sourceMappingURL=ordenes.service.js.map