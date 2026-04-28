"use strict";
/**
 * OrdenService - Solo lógica de negocio para órdenes
 *
 * Cambios respecto a la versión anterior:
 * 1. actualizarEstado() valida la transición contra BD antes de aplicarla
 * 2. Al pasar a EN_PREPARACION se genera la factura automáticamente
 * 3. Al pasar a ENTREGADA se registran los pagos y se cierra la factura
 * 4. [NUEVO] Al pasar a ENTREGADA se verifica stock de ingredientes por receta
 * 5. [NUEVO] Al pasar a ENTREGADA se descuentan ingredientes del inventario
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ordenService = void 0;
const library_1 = require("@prisma/client/runtime/library");
const database_1 = __importDefault(require("../config/database"));
const orden_repository_1 = require("../repositories/orden.repository");
const estado_repository_1 = require("../repositories/estado.repository");
const HttpErrors_1 = require("../exceptions/HttpErrors");
const decimal_1 = require("../lib/decimal");
const pagination_1 = require("../lib/pagination");
const numero_generator_1 = require("../lib/numero-generator");
const factura_service_1 = require("./factura.service");
const receta_service_1 = require("./receta.service"); // [NUEVO]
exports.ordenService = {
    async listar(params) {
        const pagination = (0, pagination_1.getPaginationParams)(params.page, params.limit);
        const [ordenes, total] = await orden_repository_1.ordenRepository.findAll(pagination, {
            tipo_orden: params.tipo_orden,
            id_estado: params.id_estado,
            fecha_desde: params.fecha_desde,
            fecha_hasta: params.fecha_hasta,
        });
        return (0, pagination_1.buildPaginatedResult)(ordenes, total, pagination);
    },
    async obtenerPorId(id) {
        const orden = await orden_repository_1.ordenRepository.findById(id);
        if (!orden)
            throw new HttpErrors_1.NotFoundError('Orden');
        return orden;
    },
    async crear(data) {
        return database_1.default.$transaction(async (tx) => {
            const ultima = await orden_repository_1.ordenRepository.findUltima();
            const numeroOrden = (0, numero_generator_1.generarNumeroOrden)(ultima?.numero_orden ?? null);
            let subtotal = new library_1.Decimal(0);
            const detallesData = [];
            for (const det of data.detalles) {
                const producto = await tx.producto.findUnique({ where: { id: det.id_producto } });
                if (!producto)
                    throw new HttpErrors_1.BadRequestError(`Producto ${det.id_producto} no encontrado`);
                if (Number(producto.stock_actual) < det.cantidad)
                    throw new HttpErrors_1.BadRequestError(`Stock insuficiente para ${producto.nombre}`);
                const pu = (0, decimal_1.toDecimal)(det.precio_unitario);
                const cant = (0, decimal_1.toDecimal)(det.cantidad);
                const desc = (0, decimal_1.toDecimal)(det.descuento ?? 0);
                const sub = pu.times(cant);
                subtotal = subtotal.plus(sub);
                detallesData.push({
                    id_producto: det.id_producto, cantidad: cant,
                    precio_unitario: pu, subtotal: sub,
                    descuento: desc, total: sub.minus(desc), notas: det.notas,
                });
            }
            const { impuestos, total } = (0, decimal_1.calcularTotales)(subtotal, (0, decimal_1.toDecimal)(data.descuento ?? 0), (0, decimal_1.toDecimal)(data.propina ?? 0), (0, decimal_1.toDecimal)(data.costo_domicilio ?? 0));
            const orden = await tx.orden.create({
                data: {
                    numero_orden: numeroOrden, tipo_orden: data.tipo_orden,
                    id_estado: data.id_estado, id_usuario: data.id_usuario,
                    direccion_entrega: data.direccion_entrega, telefono_contacto: data.telefono_contacto,
                    nombre_contacto: data.nombre_contacto, notas_entrega: data.notas_entrega,
                    costo_domicilio: (0, decimal_1.toDecimal)(data.costo_domicilio ?? 0),
                    plataforma_delivery: data.plataforma_delivery,
                    subtotal, descuento: (0, decimal_1.toDecimal)(data.descuento ?? 0),
                    impuestos, propina: (0, decimal_1.toDecimal)(data.propina ?? 0),
                    total, observaciones: data.observaciones,
                    detalles: { create: detallesData },
                },
                include: { estado: true, detalles: { include: { producto: true } } },
            });
            // Descontar stock y registrar movimientos
            for (const det of data.detalles) {
                const prod = await tx.producto.findUnique({ where: { id: det.id_producto } });
                if (!prod)
                    continue;
                const nuevoStock = Number(prod.stock_actual) - det.cantidad;
                await tx.producto.update({ where: { id: det.id_producto }, data: { stock_actual: (0, decimal_1.toDecimal)(nuevoStock) } });
                await tx.movimiento.create({
                    data: {
                        id_producto: det.id_producto, tipo_movimiento: 'venta',
                        cantidad: (0, decimal_1.toDecimal)(det.cantidad), stock_anterior: prod.stock_actual,
                        stock_nuevo: (0, decimal_1.toDecimal)(nuevoStock),
                        motivo: `Venta - Orden ${numeroOrden}`, id_orden: orden.id,
                    },
                });
            }
            return orden;
        });
    },
    async actualizar(id, data) {
        await this.obtenerPorId(id);
        const updateData = { ...data };
        if (data.costo_domicilio != null)
            updateData.costo_domicilio = (0, decimal_1.toDecimal)(data.costo_domicilio);
        if (data.descuento != null)
            updateData.descuento = (0, decimal_1.toDecimal)(data.descuento);
        if (data.propina != null)
            updateData.propina = (0, decimal_1.toDecimal)(data.propina);
        return orden_repository_1.ordenRepository.update(id, updateData);
    },
    /**
     * actualizarEstado — cambia el estado de una orden con validación de flujo
     *
     * Flujo completo:
     * 1. Verifica que la orden existe
     * 2. Valida que la transición desde→hacia está permitida en BD
     * 3. Si el nuevo estado es EN_PREPARACION → genera factura automáticamente
     * 4. Si el nuevo estado es ENTREGADA:
     *    a) [NUEVO] Verifica stock de ingredientes por receta (antes de la tx)
     *    b) Registra pagos y cierra la factura
     *    c) [NUEVO] Descuenta ingredientes del inventario (dentro de la tx)
     * 5. Actualiza el estado de la orden
     *
     * pagos es requerido solo cuando el nuevo estado es ENTREGADA.
     * El frontend debe mostrar la ventanilla de pago antes de llamar este endpoint.
     */
    async actualizarEstado(id, id_estado_nuevo, pagos) {
        const orden = await this.obtenerPorId(id);
        // 1. Validar transición contra BD (lanza BadRequestError si no es válida)
        await estado_repository_1.estadoRepository.findTransicion(orden.id_estado, id_estado_nuevo).then(t => {
            if (!t)
                throw new HttpErrors_1.BadRequestError(`Transición no permitida desde el estado actual`);
        });
        // 2. Obtener el estado destino para saber su código
        const estadoNuevo = await estado_repository_1.estadoRepository.findById(id_estado_nuevo);
        if (!estadoNuevo)
            throw new HttpErrors_1.NotFoundError('Estado de orden');
        // [NUEVO] Verificar stock de ingredientes ANTES de abrir la transacción.
        // Se hace aquí para que el error llegue limpio al frontend sin generar rollback innecesario.
        if (estadoNuevo.codigo === 'ENTREGADA') {
            await receta_service_1.recetaService.verificarStockParaOrden(id);
        }
        return database_1.default.$transaction(async (tx) => {
            // 3. Si pasa a EN_PREPARACION → generar factura automáticamente
            if (estadoNuevo.codigo === 'EN_PREPARACION') {
                const facturaExistente = await tx.factura.findUnique({ where: { id_orden: id } });
                if (!facturaExistente) {
                    await factura_service_1.facturaService.generarDesdeOrden(id, tx);
                }
            }
            // 4. Si pasa a ENTREGADA → registrar pagos y cerrar factura
            if (estadoNuevo.codigo === 'ENTREGADA') {
                if (!pagos || pagos.length === 0) {
                    throw new HttpErrors_1.BadRequestError('Se requiere al menos un método de pago para entregar la orden');
                }
                const totalPagado = pagos.reduce((sum, p) => sum + p.monto, 0);
                const totalOrden = Number(orden.total);
                if (totalPagado < totalOrden) {
                    throw new HttpErrors_1.BadRequestError(`El total pagado (${totalPagado}) es menor al total de la orden (${totalOrden})`);
                }
                // Registrar cada pago
                await Promise.all(pagos.map(p => tx.pago.create({
                    data: {
                        id_orden: id,
                        id_metodo_pago: p.id_metodo_pago,
                        monto: (0, decimal_1.toDecimal)(p.monto),
                        referencia: p.referencia,
                        notas: p.notas,
                    },
                })));
                // Cerrar la factura
                const factura = await tx.factura.findUnique({ where: { id_orden: id } });
                if (factura) {
                    await tx.factura.update({
                        where: { id: factura.id },
                        data: { estado_factura: 'pagada', fecha_pago: new Date() },
                    });
                }
                // Marcar fecha de entrega
                await tx.orden.update({
                    where: { id },
                    data: { fecha_entrega: new Date() },
                });
                // [NUEVO] Descontar ingredientes de las recetas dentro de la misma transacción
                await receta_service_1.recetaService.descontarIngredientesOrden(id, tx);
            }
            // 5. Actualizar el estado
            return tx.orden.update({
                where: { id },
                data: { id_estado: id_estado_nuevo },
                include: {
                    estado: true,
                    usuario: { select: { id: true, nombre_completo: true, email: true } },
                    detalles: { include: { producto: true } },
                    pagos: { include: { metodo_pago: true } },
                },
            });
        });
    },
    async eliminar(id) {
        const orden = await this.obtenerPorId(id);
        return database_1.default.$transaction(async (tx) => {
            for (const detalle of orden.detalles ?? []) {
                const prod = await tx.producto.findUnique({ where: { id: detalle.id_producto } });
                if (prod) {
                    const nuevoStock = Number(prod.stock_actual) + Number(detalle.cantidad);
                    await tx.producto.update({ where: { id: detalle.id_producto }, data: { stock_actual: (0, decimal_1.toDecimal)(nuevoStock) } });
                }
            }
            await tx.ordenDetalle.deleteMany({ where: { id_orden: id } });
            await tx.orden.delete({ where: { id } });
        });
    },
    async agregarDetalle(ordenId, data) {
        await this.obtenerPorId(ordenId);
        return database_1.default.$transaction(async (tx) => {
            const prod = await tx.producto.findUnique({ where: { id: data.id_producto } });
            if (!prod)
                throw new HttpErrors_1.NotFoundError('Producto');
            if (Number(prod.stock_actual) < data.cantidad)
                throw new HttpErrors_1.BadRequestError('Stock insuficiente');
            const pu = (0, decimal_1.toDecimal)(data.precio_unitario);
            const sub = pu.times((0, decimal_1.toDecimal)(data.cantidad));
            const desc = (0, decimal_1.toDecimal)(data.descuento ?? 0);
            const detalle = await tx.ordenDetalle.create({
                data: {
                    id_orden: ordenId, id_producto: data.id_producto,
                    cantidad: (0, decimal_1.toDecimal)(data.cantidad), precio_unitario: pu,
                    subtotal: sub, descuento: desc, total: sub.minus(desc), notas: data.notas,
                },
                include: { producto: true },
            });
            const nuevoStock = Number(prod.stock_actual) - data.cantidad;
            await tx.producto.update({ where: { id: data.id_producto }, data: { stock_actual: (0, decimal_1.toDecimal)(nuevoStock) } });
            await this._recalcularTotales(tx, ordenId);
            return detalle;
        });
    },
    async actualizarDetalle(detalleId, data) {
        return database_1.default.$transaction(async (tx) => {
            const detalle = await tx.ordenDetalle.findUnique({ where: { id: detalleId }, include: { producto: true } });
            if (!detalle)
                throw new HttpErrors_1.NotFoundError('Detalle');
            const updateData = {};
            let difCantidad = 0;
            if (data.cantidad != null && data.cantidad !== Number(detalle.cantidad)) {
                difCantidad = data.cantidad - Number(detalle.cantidad);
                if (difCantidad > 0 && Number(detalle.producto.stock_actual) < difCantidad)
                    throw new HttpErrors_1.BadRequestError('Stock insuficiente');
                updateData.cantidad = (0, decimal_1.toDecimal)(data.cantidad);
                updateData.subtotal = detalle.precio_unitario.times(data.cantidad);
                updateData.total = updateData.subtotal.minus(detalle.descuento);
            }
            if (data.notas != null)
                updateData.notas = data.notas;
            const actualizado = await tx.ordenDetalle.update({ where: { id: detalleId }, data: updateData, include: { producto: true } });
            if (difCantidad !== 0) {
                const nuevoStock = Number(detalle.producto.stock_actual) - difCantidad;
                await tx.producto.update({ where: { id: detalle.id_producto }, data: { stock_actual: (0, decimal_1.toDecimal)(nuevoStock) } });
                await this._recalcularTotales(tx, detalle.id_orden);
            }
            return actualizado;
        });
    },
    async eliminarDetalle(detalleId) {
        return database_1.default.$transaction(async (tx) => {
            const detalle = await tx.ordenDetalle.findUnique({ where: { id: detalleId } });
            if (!detalle)
                throw new HttpErrors_1.NotFoundError('Detalle');
            const prod = await tx.producto.findUnique({ where: { id: detalle.id_producto } });
            if (prod) {
                const nuevoStock = Number(prod.stock_actual) + Number(detalle.cantidad);
                await tx.producto.update({ where: { id: detalle.id_producto }, data: { stock_actual: (0, decimal_1.toDecimal)(nuevoStock) } });
            }
            await tx.ordenDetalle.delete({ where: { id: detalleId } });
            await this._recalcularTotales(tx, detalle.id_orden);
        });
    },
    async estadisticas(params) {
        const where = {};
        if (params.fecha_desde || params.fecha_hasta) {
            where.fecha_apertura = {};
            if (params.fecha_desde)
                where.fecha_apertura.gte = params.fecha_desde;
            if (params.fecha_hasta)
                where.fecha_apertura.lte = params.fecha_hasta;
        }
        const [total, porEstado, porTipo, agg] = await Promise.all([
            orden_repository_1.ordenRepository.count(where),
            orden_repository_1.ordenRepository.groupByEstado(where),
            orden_repository_1.ordenRepository.groupByTipo(where),
            orden_repository_1.ordenRepository.aggregate(where),
        ]);
        return {
            total, porEstado, porTipo,
            ventasTotales: Number(agg._sum.total ?? 0),
            promedioVenta: Number(agg._avg.total ?? 0),
        };
    },
    async _recalcularTotales(tx, ordenId) {
        const detalles = await tx.ordenDetalle.findMany({ where: { id_orden: ordenId } });
        const nuevoSubtotal = detalles.reduce((s, d) => s.plus(d.subtotal), new library_1.Decimal(0));
        const orden = await tx.orden.findUnique({ where: { id: ordenId } });
        if (!orden)
            return;
        const { impuestos, total } = (0, decimal_1.calcularTotales)(nuevoSubtotal, orden.descuento ?? new library_1.Decimal(0), orden.propina ?? new library_1.Decimal(0), orden.costo_domicilio ?? new library_1.Decimal(0));
        await tx.orden.update({ where: { id: ordenId }, data: { subtotal: nuevoSubtotal, impuestos, total } });
    },
};
//# sourceMappingURL=orden.service.js.map