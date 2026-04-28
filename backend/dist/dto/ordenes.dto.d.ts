/**
 * DTOs y Validaciones de Órdenes
 * Adaptado al schema real de Prisma
 */
import { z } from 'zod';
export declare const createOrdenSchema: z.ZodObject<{
    tipo_orden: z.ZodNativeEnum<{
        local: "local";
        domicilio: "domicilio";
    }>;
    id_estado: z.ZodNumber;
    id_usuario: z.ZodNumber;
    direccion_entrega: z.ZodOptional<z.ZodString>;
    telefono_contacto: z.ZodOptional<z.ZodString>;
    nombre_contacto: z.ZodOptional<z.ZodString>;
    notas_entrega: z.ZodOptional<z.ZodString>;
    costo_domicilio: z.ZodOptional<z.ZodNumber>;
    plataforma_delivery: z.ZodOptional<z.ZodString>;
    descuento: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    propina: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    observaciones: z.ZodOptional<z.ZodString>;
    detalles: z.ZodArray<z.ZodObject<{
        id_producto: z.ZodNumber;
        cantidad: z.ZodNumber;
        precio_unitario: z.ZodNumber;
        descuento: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
        notas: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        precio_unitario: number;
        id_producto: number;
        cantidad: number;
        descuento?: number | undefined;
        notas?: string | undefined;
    }, {
        precio_unitario: number;
        id_producto: number;
        cantidad: number;
        descuento?: number | undefined;
        notas?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    tipo_orden: "local" | "domicilio";
    id_estado: number;
    id_usuario: number;
    detalles: {
        precio_unitario: number;
        id_producto: number;
        cantidad: number;
        descuento?: number | undefined;
        notas?: string | undefined;
    }[];
    direccion_entrega?: string | undefined;
    telefono_contacto?: string | undefined;
    nombre_contacto?: string | undefined;
    notas_entrega?: string | undefined;
    costo_domicilio?: number | undefined;
    plataforma_delivery?: string | undefined;
    descuento?: number | undefined;
    propina?: number | undefined;
    observaciones?: string | undefined;
}, {
    tipo_orden: "local" | "domicilio";
    id_estado: number;
    id_usuario: number;
    detalles: {
        precio_unitario: number;
        id_producto: number;
        cantidad: number;
        descuento?: number | undefined;
        notas?: string | undefined;
    }[];
    direccion_entrega?: string | undefined;
    telefono_contacto?: string | undefined;
    nombre_contacto?: string | undefined;
    notas_entrega?: string | undefined;
    costo_domicilio?: number | undefined;
    plataforma_delivery?: string | undefined;
    descuento?: number | undefined;
    propina?: number | undefined;
    observaciones?: string | undefined;
}>;
export declare const updateOrdenSchema: z.ZodObject<{
    id_estado: z.ZodOptional<z.ZodNumber>;
    direccion_entrega: z.ZodOptional<z.ZodString>;
    telefono_contacto: z.ZodOptional<z.ZodString>;
    nombre_contacto: z.ZodOptional<z.ZodString>;
    notas_entrega: z.ZodOptional<z.ZodString>;
    costo_domicilio: z.ZodOptional<z.ZodNumber>;
    plataforma_delivery: z.ZodOptional<z.ZodString>;
    descuento: z.ZodOptional<z.ZodNumber>;
    propina: z.ZodOptional<z.ZodNumber>;
    observaciones: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id_estado?: number | undefined;
    direccion_entrega?: string | undefined;
    telefono_contacto?: string | undefined;
    nombre_contacto?: string | undefined;
    notas_entrega?: string | undefined;
    costo_domicilio?: number | undefined;
    plataforma_delivery?: string | undefined;
    descuento?: number | undefined;
    propina?: number | undefined;
    observaciones?: string | undefined;
}, {
    id_estado?: number | undefined;
    direccion_entrega?: string | undefined;
    telefono_contacto?: string | undefined;
    nombre_contacto?: string | undefined;
    notas_entrega?: string | undefined;
    costo_domicilio?: number | undefined;
    plataforma_delivery?: string | undefined;
    descuento?: number | undefined;
    propina?: number | undefined;
    observaciones?: string | undefined;
}>;
export declare const updateEstadoSchema: z.ZodObject<{
    id_estado: z.ZodNumber;
    motivo: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id_estado: number;
    motivo?: string | undefined;
}, {
    id_estado: number;
    motivo?: string | undefined;
}>;
export declare const addDetalleSchema: z.ZodObject<{
    id_producto: z.ZodNumber;
    cantidad: z.ZodNumber;
    precio_unitario: z.ZodNumber;
    descuento: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    notas: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    precio_unitario: number;
    id_producto: number;
    cantidad: number;
    descuento?: number | undefined;
    notas?: string | undefined;
}, {
    precio_unitario: number;
    id_producto: number;
    cantidad: number;
    descuento?: number | undefined;
    notas?: string | undefined;
}>;
export declare const updateDetalleSchema: z.ZodObject<{
    cantidad: z.ZodOptional<z.ZodNumber>;
    precio_unitario: z.ZodOptional<z.ZodNumber>;
    descuento: z.ZodOptional<z.ZodNumber>;
    notas: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    precio_unitario?: number | undefined;
    cantidad?: number | undefined;
    descuento?: number | undefined;
    notas?: string | undefined;
}, {
    precio_unitario?: number | undefined;
    cantidad?: number | undefined;
    descuento?: number | undefined;
    notas?: string | undefined;
}>;
export declare const pagarOrdenSchema: z.ZodObject<{
    id_metodo_pago: z.ZodNumber;
    monto: z.ZodNumber;
    referencia: z.ZodOptional<z.ZodString>;
    notas: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    monto: number;
    id_metodo_pago: number;
    referencia?: string | undefined;
    notas?: string | undefined;
}, {
    monto: number;
    id_metodo_pago: number;
    referencia?: string | undefined;
    notas?: string | undefined;
}>;
export type CreateOrdenDTO = z.infer<typeof createOrdenSchema>;
export type UpdateOrdenDTO = z.infer<typeof updateOrdenSchema>;
export type UpdateEstadoDTO = z.infer<typeof updateEstadoSchema>;
export type AddDetalleDTO = z.infer<typeof addDetalleSchema>;
export type UpdateDetalleDTO = z.infer<typeof updateDetalleSchema>;
export type PagarOrdenDTO = z.infer<typeof pagarOrdenSchema>;
//# sourceMappingURL=ordenes.dto.d.ts.map