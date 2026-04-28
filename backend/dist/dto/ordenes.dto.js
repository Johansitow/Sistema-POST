"use strict";
/**
 * DTOs y Validaciones de Órdenes
 * Adaptado al schema real de Prisma
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.pagarOrdenSchema = exports.updateDetalleSchema = exports.addDetalleSchema = exports.updateEstadoSchema = exports.updateOrdenSchema = exports.createOrdenSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
// ============================================================================
// SCHEMAS DE VALIDACIÓN
// ============================================================================
const ordenDetalleSchema = zod_1.z.object({
    id_producto: zod_1.z.number()
        .int('El ID del producto debe ser un número entero')
        .positive('El ID del producto debe ser positivo'),
    cantidad: zod_1.z.number()
        .positive('La cantidad debe ser un número positivo'),
    precio_unitario: zod_1.z.number()
        .positive('El precio unitario debe ser positivo'),
    descuento: zod_1.z.number()
        .nonnegative('El descuento no puede ser negativo')
        .default(0)
        .optional(),
    notas: zod_1.z.string()
        .max(255, 'Las notas no pueden exceder 255 caracteres')
        .optional(),
});
exports.createOrdenSchema = zod_1.z.object({
    tipo_orden: zod_1.z.nativeEnum(client_1.TipoOrden, {
        errorMap: () => ({ message: 'El tipo de orden debe ser "local" o "domicilio"' }),
    }),
    id_estado: zod_1.z.number()
        .int('El ID del estado debe ser un número entero')
        .positive('El ID del estado debe ser positivo'),
    id_usuario: zod_1.z.number()
        .int('El ID del usuario debe ser un número entero')
        .positive('El ID del usuario debe ser positivo'),
    // Campos para domicilio
    direccion_entrega: zod_1.z.string()
        .max(255, 'La dirección no puede exceder 255 caracteres')
        .optional(),
    telefono_contacto: zod_1.z.string()
        .max(20, 'El teléfono no puede exceder 20 caracteres')
        .optional(),
    nombre_contacto: zod_1.z.string()
        .max(100, 'El nombre de contacto no puede exceder 100 caracteres')
        .optional(),
    notas_entrega: zod_1.z.string()
        .max(1000, 'Las notas de entrega no pueden exceder 1000 caracteres')
        .optional(),
    costo_domicilio: zod_1.z.number()
        .nonnegative('El costo de domicilio no puede ser negativo')
        .optional(),
    plataforma_delivery: zod_1.z.string()
        .max(50, 'El nombre de la plataforma no puede exceder 50 caracteres')
        .optional(),
    // Totales
    descuento: zod_1.z.number()
        .nonnegative('El descuento no puede ser negativo')
        .default(0)
        .optional(),
    propina: zod_1.z.number()
        .nonnegative('La propina no puede ser negativa')
        .default(0)
        .optional(),
    observaciones: zod_1.z.string()
        .max(1000, 'Las observaciones no pueden exceder 1000 caracteres')
        .optional(),
    // Detalles de la orden
    detalles: zod_1.z.array(ordenDetalleSchema)
        .min(1, 'Debe incluir al menos un producto en la orden'),
});
exports.updateOrdenSchema = zod_1.z.object({
    id_estado: zod_1.z.number().int().positive().optional(),
    direccion_entrega: zod_1.z.string().max(255).optional(),
    telefono_contacto: zod_1.z.string().max(20).optional(),
    nombre_contacto: zod_1.z.string().max(100).optional(),
    notas_entrega: zod_1.z.string().max(1000).optional(),
    costo_domicilio: zod_1.z.number().nonnegative().optional(),
    plataforma_delivery: zod_1.z.string().max(50).optional(),
    descuento: zod_1.z.number().nonnegative().optional(),
    propina: zod_1.z.number().nonnegative().optional(),
    observaciones: zod_1.z.string().max(1000).optional(),
});
exports.updateEstadoSchema = zod_1.z.object({
    id_estado: zod_1.z.number()
        .int('El ID del estado debe ser un número entero')
        .positive('El ID del estado debe ser positivo'),
    motivo: zod_1.z.string()
        .max(1000, 'El motivo no puede exceder 1000 caracteres')
        .optional(),
});
exports.addDetalleSchema = zod_1.z.object({
    id_producto: zod_1.z.number()
        .int('El ID del producto debe ser un número entero')
        .positive('El ID del producto debe ser positivo'),
    cantidad: zod_1.z.number()
        .positive('La cantidad debe ser un número positivo'),
    precio_unitario: zod_1.z.number()
        .positive('El precio unitario debe ser positivo'),
    descuento: zod_1.z.number()
        .nonnegative('El descuento no puede ser negativo')
        .default(0)
        .optional(),
    notas: zod_1.z.string()
        .max(255, 'Las notas no pueden exceder 255 caracteres')
        .optional(),
});
exports.updateDetalleSchema = zod_1.z.object({
    cantidad: zod_1.z.number()
        .positive('La cantidad debe ser un número positivo')
        .optional(),
    precio_unitario: zod_1.z.number()
        .positive('El precio unitario debe ser positivo')
        .optional(),
    descuento: zod_1.z.number()
        .nonnegative('El descuento no puede ser negativo')
        .optional(),
    notas: zod_1.z.string()
        .max(255, 'Las notas no pueden exceder 255 caracteres')
        .optional(),
});
exports.pagarOrdenSchema = zod_1.z.object({
    id_metodo_pago: zod_1.z.number()
        .int('El ID del método de pago debe ser un número entero')
        .positive('El ID del método de pago debe ser positivo'),
    monto: zod_1.z.number()
        .positive('El monto debe ser un número positivo'),
    referencia: zod_1.z.string()
        .max(100, 'La referencia no puede exceder 100 caracteres')
        .optional(),
    notas: zod_1.z.string()
        .max(1000, 'Las notas no pueden exceder 1000 caracteres')
        .optional(),
});
//# sourceMappingURL=ordenes.dto.js.map