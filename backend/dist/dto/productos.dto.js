"use strict";
/**
 * DTOs y Validaciones de Productos
 * Adaptado al schema real de Prisma
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateStockSchema = exports.updateProductoSchema = exports.createProductoSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
// ============================================================================
// SCHEMAS DE VALIDACIÓN
// ============================================================================
exports.createProductoSchema = zod_1.z.object({
    codigo_barras: zod_1.z.string()
        .max(50, 'El código de barras no puede exceder 50 caracteres')
        .optional(),
    sku: zod_1.z.string()
        .min(1, 'El SKU es obligatorio')
        .max(50, 'El SKU no puede exceder 50 caracteres')
        .regex(/^[A-Z0-9-]+$/, 'El SKU solo puede contener letras mayúsculas, números y guiones'),
    nombre: zod_1.z.string()
        .min(1, 'El nombre es obligatorio')
        .max(150, 'El nombre no puede exceder 150 caracteres'),
    descripcion: zod_1.z.string()
        .max(1000, 'La descripción no puede exceder 1000 caracteres')
        .optional(),
    id_categoria: zod_1.z.number()
        .int('La categoría debe ser un número entero')
        .positive('La categoría debe ser un número positivo')
        .optional(),
    tipo_materia: zod_1.z.nativeEnum(client_1.TipoMateria, {
        errorMap: () => ({ message: 'El tipo de materia debe ser "prima" o "procesada"' }),
    }),
    unidad_medida: zod_1.z.nativeEnum(client_1.UnidadMedida, {
        errorMap: () => ({
            message: 'La unidad de medida debe ser: unidad, gramo, kilogramo, litro, mililitro o porcion'
        }),
    }),
    precio_unitario: zod_1.z.number()
        .nonnegative('El precio unitario no puede ser negativo')
        .max(999999999.99, 'El precio unitario es demasiado alto'),
    precio_venta: zod_1.z.number()
        .nonnegative('El precio de venta no puede ser negativo')
        .max(999999999.99, 'El precio de venta es demasiado alto')
        .optional(),
    stock_actual: zod_1.z.number()
        .nonnegative('El stock actual no puede ser negativo')
        .default(0)
        .optional(),
    stock_minimo: zod_1.z.number()
        .nonnegative('El stock mínimo no puede ser negativo')
        .default(0)
        .optional(),
    stock_maximo: zod_1.z.number()
        .nonnegative('El stock máximo no puede ser negativo')
        .optional(),
    punto_reorden: zod_1.z.number()
        .nonnegative('El punto de reorden no puede ser negativo')
        .optional(),
    dias_vida_util: zod_1.z.number()
        .int('Los días de vida útil deben ser un número entero')
        .positive('Los días de vida útil deben ser positivos')
        .optional(),
    requiere_refrigeracion: zod_1.z.boolean()
        .default(false)
        .optional(),
    imagen_url: zod_1.z.string()
        .url('La URL de la imagen no es válida')
        .max(255, 'La URL de la imagen no puede exceder 255 caracteres')
        .optional(),
    es_vendible: zod_1.z.boolean()
        .default(false)
        .optional(),
    estado: zod_1.z.nativeEnum(client_1.EstadoGeneral)
        .default(client_1.EstadoGeneral.activo)
        .optional(),
});
exports.updateProductoSchema = zod_1.z.object({
    codigo_barras: zod_1.z.string().max(50).optional(),
    sku: zod_1.z.string().min(1).max(50).regex(/^[A-Z0-9-]+$/).optional(),
    nombre: zod_1.z.string().min(1).max(150).optional(),
    descripcion: zod_1.z.string().max(1000).optional(),
    id_categoria: zod_1.z.number().int().positive().optional(),
    tipo_materia: zod_1.z.nativeEnum(client_1.TipoMateria).optional(),
    unidad_medida: zod_1.z.nativeEnum(client_1.UnidadMedida).optional(),
    precio_unitario: zod_1.z.number().nonnegative().optional(),
    precio_venta: zod_1.z.number().nonnegative().optional(),
    stock_actual: zod_1.z.number().nonnegative().optional(),
    stock_minimo: zod_1.z.number().nonnegative().optional(),
    stock_maximo: zod_1.z.number().nonnegative().optional(),
    punto_reorden: zod_1.z.number().nonnegative().optional(),
    dias_vida_util: zod_1.z.number().int().positive().optional(),
    requiere_refrigeracion: zod_1.z.boolean().optional(),
    imagen_url: zod_1.z.string().url().max(255).optional(),
    es_vendible: zod_1.z.boolean().optional(),
    estado: zod_1.z.nativeEnum(client_1.EstadoGeneral).optional(),
});
exports.updateStockSchema = zod_1.z.object({
    cantidad: zod_1.z.number()
        .positive('La cantidad debe ser un número positivo'),
    tipo: zod_1.z.enum(['entrada', 'salida'], {
        errorMap: () => ({ message: 'El tipo debe ser "entrada" o "salida"' }),
    }),
    motivo: zod_1.z.string()
        .min(1, 'El motivo es obligatorio')
        .max(255, 'El motivo no puede exceder 255 caracteres')
        .optional(),
});
//# sourceMappingURL=productos.dto.js.map