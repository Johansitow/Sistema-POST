"use strict";
/**
 * RecetaService
 *
 * Responsabilidades:
 * 1. CRUD de recetas con sus ingredientes
 * 2. Cálculo de rentabilidad (costo real vs precio sugerido vs precio actual)
 * 3. Verificar stock de ingredientes antes de marcar ENTREGADA
 * 4. Descontar ingredientes automáticamente al marcar ENTREGADA
 * 5. Alertar cuando un ingrediente necesario está agotado
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
// Margen mínimo de rentabilidad por defecto (40%)
const MARGEN_DEFAULT = 0.40;
exports.recetaService = {
    // ── CRUD ─────────────────────────────────────────────────────────────────────
    async listar(params) {
        const p = (0, pagination_1.getPaginationParams)(params.page, params.limit);
        const [data, total] = await receta_repository_1.recetaRepository.findAll({
            skip: p.skip, take: p.take,
            id_producto: params.id_producto,
            estado: params.estado,
        });
        // Agregar análisis de rentabilidad a cada receta
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
        // El producto final debe existir
        const producto = await database_1.default.producto.findUnique({ where: { id: data.id_producto_final } });
        if (!producto)
            throw new HttpErrors_1.NotFoundError('Producto final');
        // No puede tener dos recetas activas
        const existente = await receta_repository_1.recetaRepository.findByProductoFinal(data.id_producto_final);
        if (existente)
            throw new HttpErrors_1.ConflictError('Este producto ya tiene una receta activa');
        // Verificar que todos los ingredientes existen
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
    // ── RENTABILIDAD ──────────────────────────────────────────────────────────────
    /**
     * Calcula la rentabilidad de una receta.
     *
     * Lógica:
     * - costo_ingredientes: suma(precio_unitario_ingrediente * cantidad_receta)
     * - costo_con_merma: costo_ingredientes / (1 - merma_esperada/100)
     * - precio_sugerido_minimo: costo_con_merma / (1 - MARGEN_DEFAULT)
     * - margen_actual: si el producto tiene precio_venta definido,
     *                  (precio_venta - costo_con_merma) / precio_venta * 100
     * - es_rentable: margen_actual >= MARGEN_DEFAULT * 100
     */
    _calcularRentabilidad(receta) {
        const costoIngredientes = receta.ingredientes.reduce((sum, ing) => {
            return sum + Number(ing.cantidad) * Number(ing.producto.precio_unitario);
        }, 0);
        const merma = Number(receta.merma_esperada_porcentaje ?? 0) / 100;
        const costoCon = merma > 0 ? costoIngredientes / (1 - merma) : costoIngredientes;
        // Costo por unidad producida
        const costoUnitario = costoCon / Number(receta.cantidad_producida);
        // Precio sugerido para alcanzar margen mínimo
        const precioSugeridoMinimo = Math.ceil(costoUnitario / (1 - MARGEN_DEFAULT));
        const precioActual = Number(receta.producto_final.precio_venta ?? receta.producto_final.precio_unitario);
        const margenActual = precioActual > 0
            ? ((precioActual - costoUnitario) / precioActual) * 100
            : 0;
        return {
            costo_ingredientes: Math.round(costoIngredientes),
            costo_con_merma: Math.round(costoCon),
            costo_unitario: Math.round(costoUnitario),
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
    // ── STOCK AL ENTREGAR ─────────────────────────────────────────────────────────
    /**
     * verificarStockParaOrden — llama orden.service antes de marcar ENTREGADA
     *
     * Por cada producto vendible en la orden:
     *   - Si tiene receta activa → verifica stock de cada ingrediente
     *   - Si no tiene receta → solo verifica el stock del producto mismo
     *
     * Retorna { ok: true } o lanza BadRequestError con el detalle de ingredientes sin stock.
     */
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
                // Sin receta → verificar stock directo del producto
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
            // Con receta → verificar cada ingrediente
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
            // Crear alertas de stock por cada ingrediente faltante
            for (const f of faltantes) {
                try {
                    await alerta_service_1.alertaService.sincronizar();
                }
                catch { /* no bloquear */ }
            }
            throw new HttpErrors_1.BadRequestError(`Stock insuficiente para completar la orden. Faltan ${faltantes.length} ingrediente(s).`, 
            // @ts-ignore
            { ingredientes_faltantes: faltantes });
        }
        return { ok: true };
    },
    /**
     * descontarIngredientesOrden — llama orden.service DESPUÉS de marcar ENTREGADA
     * Descuenta del inventario los ingredientes de cada receta.
     * Se ejecuta dentro de la misma transacción del cambio de estado.
     */
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
        // Sincronizar alertas de stock después del descuento
        try {
            await alerta_service_1.alertaService.sincronizar();
        }
        catch { /* no bloquear el flujo principal */ }
    },
    // ── HELPERS PRIVADOS ─────────────────────────────────────────────────────────
    async _verificarIngredientes(ingredientes) {
        const ids = [...new Set(ingredientes.map(i => i.id_producto))];
        const existentes = await database_1.default.producto.findMany({
            where: { id: { in: ids } }, select: { id: true, nombre: true, tipo_materia: true },
        });
        const encontrados = new Set(existentes.map(p => p.id));
        const faltantes = ids.filter(id => !encontrados.has(id));
        if (faltantes.length > 0)
            throw new HttpErrors_1.BadRequestError(`Los productos con ID [${faltantes.join(', ')}] no existen`);
        // Advertir si algún ingrediente es procesado (puede que necesite su propia receta)
        const procesados = existentes.filter(p => p.tipo_materia === 'procesada');
        if (procesados.length > 0) {
            // No es un error, solo es información que se devuelve al frontend
            return {
                advertencias_ingredientes_procesados: procesados.map(p => ({
                    id: p.id,
                    nombre: p.nombre,
                    aviso: `'${p.nombre}' es un producto procesado. Si tiene stock insuficiente, se requerirá producirlo primero.`,
                })),
            };
        }
        return { advertencias_ingredientes_procesados: [] };
    },
};
//# sourceMappingURL=receta.service.js.map