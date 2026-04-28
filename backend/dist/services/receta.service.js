"use strict";
/**
 * RecetaService
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recetaService = void 0;
const database_1 = __importDefault(require("../config/database"));
const receta_repository_1 = require("../repositories/receta.repository");
const alerta_service_1 = require("./alerta.service");
const HttpErrors_1 = require("../exceptions/HttpErrors");
const pagination_1 = require("../lib/pagination");
const decimal_1 = require("../lib/decimal");
const MARGEN_DEFAULT = 0.40;
exports.recetaService = {
    async listar(params) {
        const p = (0, pagination_1.getPaginationParams)(params.page, params.limit);
        const [data, total] = await receta_repository_1.recetaRepository.findAll({
            skip: (0, pagination_1.getSkip)(p),
            take: p.limit,
            id_producto: params.id_producto,
            estado: params.estado,
        });
        return (0, pagination_1.buildPaginatedResult)(data.map(r => ({ ...r, rentabilidad: this._calcularRentabilidad(r) })), total, p);
    },
    async obtenerPorId(id) {
        const receta = await receta_repository_1.recetaRepository.findById(id);
        if (!receta)
            throw new HttpErrors_1.NotFoundError('Receta');
        return { ...receta, rentabilidad: this._calcularRentabilidad(receta) };
    },
    async obtenerPorProducto(id_producto) {
        const receta = await receta_repository_1.recetaRepository.findByProductoFinal(id_producto);
        if (!receta)
            throw new HttpErrors_1.NotFoundError('Receta para este producto');
        return { ...receta, rentabilidad: this._calcularRentabilidad(receta) };
    },
    async crear(data) {
        const producto = await database_1.default.producto.findUnique({ where: { id: data.id_producto_final } });
        if (!producto)
            throw new HttpErrors_1.NotFoundError('Producto final');
        const existente = await receta_repository_1.recetaRepository.findByProductoFinal(data.id_producto_final);
        if (existente)
            throw new HttpErrors_1.ConflictError('Este producto ya tiene una receta activa');
        await this._verificarIngredientes(data.ingredientes);
        const receta = await receta_repository_1.recetaRepository.create(data);
        return { ...receta, rentabilidad: this._calcularRentabilidad(receta) };
    },
    async actualizar(id, data) {
        await this.obtenerPorId(id);
        return receta_repository_1.recetaRepository.update(id, data);
    },
    async actualizarIngredientes(id, ingredientes) {
        await this.obtenerPorId(id);
        await this._verificarIngredientes(ingredientes);
        const receta = await receta_repository_1.recetaRepository.reemplazarIngredientes(id, ingredientes);
        return { ...receta, rentabilidad: this._calcularRentabilidad(receta) };
    },
    _calcularRentabilidad(receta) {
        const costoIngredientes = receta.ingredientes.reduce((sum, ing) => {
            return sum + Number(ing.cantidad) * Number(ing.producto.precio_unitario);
        }, 0);
        const merma = Number(receta.merma_esperada_porcentaje ?? 0) / 100;
        const costoCon = merma > 0 ? costoIngredientes / (1 - merma) : costoIngredientes;
        const costoUnit = costoCon / Number(receta.cantidad_producida);
        const precioSugeridoMinimo = Math.ceil(costoUnit / (1 - MARGEN_DEFAULT));
        const precioActual = Number(receta.producto_final.precio_venta ?? receta.producto_final.precio_unitario);
        const margenActual = precioActual > 0
            ? ((precioActual - costoUnit) / precioActual) * 100
            : 0;
        return {
            costo_ingredientes: Math.round(costoIngredientes),
            costo_con_merma: Math.round(costoCon),
            costo_unitario: Math.round(costoUnit),
            precio_sugerido_minimo: precioSugeridoMinimo,
            precio_actual: Math.round(precioActual),
            margen_actual_porcentaje: Math.round(margenActual * 100) / 100,
            es_rentable: margenActual >= MARGEN_DEFAULT * 100,
            diferencia_precio: Math.round(precioActual - precioSugeridoMinimo),
            alerta_rentabilidad: precioActual < precioSugeridoMinimo
                ? `El precio actual ($${precioActual.toLocaleString()}) está $${Math.abs(precioActual - precioSugeridoMinimo).toLocaleString()} por debajo del mínimo rentable ($${precioSugeridoMinimo.toLocaleString()})`
                : null,
        };
    },
    async verificarStockParaOrden(id_orden) {
        const orden = await database_1.default.orden.findUnique({
            where: { id: id_orden },
            include: { detalles: { include: { producto: true } } },
        });
        if (!orden)
            throw new HttpErrors_1.NotFoundError('Orden');
        const faltantes = [];
        for (const detalle of orden.detalles) {
            const receta = await receta_repository_1.recetaRepository.findByProductoFinal(detalle.id_producto);
            if (!receta) {
                if (Number(detalle.producto.stock_actual) < Number(detalle.cantidad)) {
                    faltantes.push({
                        producto: detalle.producto.nombre,
                        ingrediente: detalle.producto.nombre,
                        cantidad_necesaria: Number(detalle.cantidad),
                        stock_actual: Number(detalle.producto.stock_actual),
                        unidad: detalle.producto.unidad_medida,
                    });
                }
                continue;
            }
            const cantidadPlatos = Number(detalle.cantidad);
            for (const ing of receta.ingredientes) {
                if (ing.es_opcional)
                    continue;
                const cantidadNecesaria = Number(ing.cantidad) * cantidadPlatos;
                const stockActual = Number(ing.producto.stock_actual);
                if (stockActual < cantidadNecesaria) {
                    faltantes.push({
                        producto: detalle.producto.nombre,
                        ingrediente: ing.producto.nombre,
                        cantidad_necesaria: cantidadNecesaria,
                        stock_actual: stockActual,
                        unidad: ing.unidad,
                    });
                }
            }
        }
        if (faltantes.length > 0) {
            // Sincronizar alertas sin iterar variable innecesaria
            try {
                await alerta_service_1.alertaService.sincronizar();
            }
            catch { /* no bloquear */ }
            throw new HttpErrors_1.BadRequestError(`Stock insuficiente para completar la orden. Faltan ${faltantes.length} ingrediente(s).`, 
            // @ts-ignore
            { ingredientes_faltantes: faltantes });
        }
        return { ok: true };
    },
    async descontarIngredientesOrden(id_orden, tx) {
        const orden = await tx.orden.findUnique({
            where: { id: id_orden },
            include: { detalles: { include: { producto: true } } },
        });
        if (!orden)
            return;
        for (const detalle of orden.detalles) {
            const receta = await receta_repository_1.recetaRepository.findByProductoFinal(detalle.id_producto);
            if (!receta)
                continue;
            const cantidadPlatos = Number(detalle.cantidad);
            for (const ing of receta.ingredientes) {
                if (ing.es_opcional)
                    continue;
                const cantidadDescontar = Number(ing.cantidad) * cantidadPlatos;
                const producto = await tx.producto.findUnique({ where: { id: ing.id_producto } });
                if (!producto)
                    continue;
                const stockNuevo = Math.max(0, Number(producto.stock_actual) - cantidadDescontar);
                await tx.producto.update({
                    where: { id: ing.id_producto },
                    data: { stock_actual: (0, decimal_1.toDecimal)(stockNuevo) },
                });
                await tx.movimiento.create({
                    data: {
                        id_producto: ing.id_producto,
                        tipo_movimiento: 'salida',
                        cantidad: (0, decimal_1.toDecimal)(cantidadDescontar),
                        stock_anterior: (0, decimal_1.toDecimal)(Number(producto.stock_actual)),
                        stock_nuevo: (0, decimal_1.toDecimal)(stockNuevo),
                        motivo: `Ingrediente receta "${receta.nombre_receta}" - Orden ${orden.numero_orden}`,
                        id_orden: id_orden,
                    },
                });
            }
        }
        try {
            await alerta_service_1.alertaService.sincronizar();
        }
        catch { /* no bloquear el flujo principal */ }
    },
    async _verificarIngredientes(ingredientes) {
        const ids = [...new Set(ingredientes.map(i => i.id_producto))];
        const existentes = await database_1.default.producto.findMany({
            where: { id: { in: ids } }, select: { id: true, nombre: true, tipo_materia: true },
        });
        const encontrados = new Set(existentes.map(p => p.id));
        const faltantes = ids.filter(id => !encontrados.has(id));
        if (faltantes.length > 0)
            throw new HttpErrors_1.BadRequestError(`Los productos con ID [${faltantes.join(', ')}] no existen`);
        const procesados = existentes.filter(p => p.tipo_materia === 'procesada');
        return {
            advertencias_ingredientes_procesados: procesados.map(p => ({
                id: p.id,
                nombre: p.nombre,
                aviso: `'${p.nombre}' es un producto procesado. Si tiene stock insuficiente, se requerirá producirlo primero.`,
            })),
        };
    },
};
//# sourceMappingURL=receta.service.js.map