"use strict";
/**
 * RecetaRepository
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recetaRepository = void 0;
const database_1 = __importDefault(require("../config/database"));
exports.recetaRepository = {
    findAll: (params) => database_1.default.$transaction([
        database_1.default.receta.findMany({
            skip: params.skip, take: params.take,
            where: {
                ...(params.id_producto && { id_producto_final: params.id_producto }),
                ...(params.estado && { estado: params.estado }),
            },
            include: {
                producto_final: {
                    select: { id: true, nombre: true, sku: true, precio_venta: true,
                        precio_unitario: true, unidad_medida: true },
                },
                ingredientes: {
                    include: {
                        producto: {
                            select: { id: true, nombre: true, sku: true, precio_unitario: true,
                                unidad_medida: true, stock_actual: true, tipo_materia: true },
                        },
                    },
                    orderBy: { orden: 'asc' },
                },
            },
            orderBy: { fecha_creacion: 'desc' },
        }),
        database_1.default.receta.count(),
    ]),
    findById: (id) => database_1.default.receta.findUnique({
        where: { id },
        include: {
            producto_final: true,
            ingredientes: {
                include: { producto: true },
                orderBy: { orden: 'asc' },
            },
        },
    }),
    findByProductoFinal: (id_producto) => database_1.default.receta.findFirst({
        where: { id_producto_final: id_producto, estado: 'activo' },
        include: {
            ingredientes: {
                include: { producto: true },
                orderBy: { orden: 'asc' },
            },
        },
    }),
    create: (data) => database_1.default.receta.create({
        data: {
            id_producto_final: data.id_producto_final,
            nombre_receta: data.nombre_receta,
            descripcion: data.descripcion,
            cantidad_producida: data.cantidad_producida,
            unidad_produccion: data.unidad_produccion,
            tiempo_preparacion: data.tiempo_preparacion,
            instrucciones: data.instrucciones,
            notas: data.notas,
            merma_esperada_porcentaje: data.merma_esperada_porcentaje,
            ingredientes: {
                create: data.ingredientes.map((ing, idx) => ({
                    id_producto: ing.id_producto,
                    cantidad: ing.cantidad,
                    unidad: ing.unidad,
                    es_opcional: ing.es_opcional ?? false,
                    notas: ing.notas,
                    orden: ing.orden ?? idx,
                })),
            },
        },
        include: {
            producto_final: true,
            ingredientes: { include: { producto: true }, orderBy: { orden: 'asc' } },
        },
    }),
    update: (id, data) => database_1.default.receta.update({
        where: { id }, data: data,
        include: { producto_final: true, ingredientes: { include: { producto: true } } },
    }),
    // Reemplaza ingredientes completamente
    reemplazarIngredientes: (id_receta, ingredientes) => database_1.default.$transaction(async (tx) => {
        await tx.recetaIngrediente.deleteMany({ where: { id_receta } });
        await tx.recetaIngrediente.createMany({
            data: ingredientes.map((ing, idx) => ({
                id_receta,
                id_producto: ing.id_producto,
                cantidad: ing.cantidad,
                unidad: ing.unidad,
                es_opcional: ing.es_opcional ?? false,
                notas: ing.notas,
                orden: ing.orden ?? idx,
            })),
        });
        return tx.receta.findUnique({
            where: { id: id_receta },
            include: { ingredientes: { include: { producto: true } } },
        });
    }),
};
//# sourceMappingURL=receta.repository.js.map