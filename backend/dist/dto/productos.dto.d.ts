/**
 * DTOs y Validaciones de Productos
 * Adaptado al schema real de Prisma
 */
import { z } from 'zod';
export declare const createProductoSchema: z.ZodObject<{
    codigo_barras: z.ZodOptional<z.ZodString>;
    sku: z.ZodString;
    nombre: z.ZodString;
    descripcion: z.ZodOptional<z.ZodString>;
    id_categoria: z.ZodOptional<z.ZodNumber>;
    tipo_materia: z.ZodNativeEnum<{
        prima: "prima";
        procesada: "procesada";
    }>;
    unidad_medida: z.ZodNativeEnum<{
        unidad: "unidad";
        gramo: "gramo";
        kilogramo: "kilogramo";
        litro: "litro";
        mililitro: "mililitro";
        porcion: "porcion";
    }>;
    precio_unitario: z.ZodNumber;
    precio_venta: z.ZodOptional<z.ZodNumber>;
    stock_actual: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    stock_minimo: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    stock_maximo: z.ZodOptional<z.ZodNumber>;
    punto_reorden: z.ZodOptional<z.ZodNumber>;
    dias_vida_util: z.ZodOptional<z.ZodNumber>;
    requiere_refrigeracion: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    imagen_url: z.ZodOptional<z.ZodString>;
    es_vendible: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    estado: z.ZodOptional<z.ZodDefault<z.ZodNativeEnum<{
        activo: "activo";
        inactivo: "inactivo";
        eliminado: "eliminado";
    }>>>;
}, "strip", z.ZodTypeAny, {
    nombre: string;
    sku: string;
    tipo_materia: "prima" | "procesada";
    unidad_medida: "unidad" | "gramo" | "kilogramo" | "litro" | "mililitro" | "porcion";
    precio_unitario: number;
    estado?: "activo" | "inactivo" | "eliminado" | undefined;
    descripcion?: string | undefined;
    codigo_barras?: string | undefined;
    id_categoria?: number | undefined;
    precio_venta?: number | undefined;
    stock_actual?: number | undefined;
    stock_minimo?: number | undefined;
    stock_maximo?: number | undefined;
    punto_reorden?: number | undefined;
    dias_vida_util?: number | undefined;
    requiere_refrigeracion?: boolean | undefined;
    imagen_url?: string | undefined;
    es_vendible?: boolean | undefined;
}, {
    nombre: string;
    sku: string;
    tipo_materia: "prima" | "procesada";
    unidad_medida: "unidad" | "gramo" | "kilogramo" | "litro" | "mililitro" | "porcion";
    precio_unitario: number;
    estado?: "activo" | "inactivo" | "eliminado" | undefined;
    descripcion?: string | undefined;
    codigo_barras?: string | undefined;
    id_categoria?: number | undefined;
    precio_venta?: number | undefined;
    stock_actual?: number | undefined;
    stock_minimo?: number | undefined;
    stock_maximo?: number | undefined;
    punto_reorden?: number | undefined;
    dias_vida_util?: number | undefined;
    requiere_refrigeracion?: boolean | undefined;
    imagen_url?: string | undefined;
    es_vendible?: boolean | undefined;
}>;
export declare const updateProductoSchema: z.ZodObject<{
    codigo_barras: z.ZodOptional<z.ZodString>;
    sku: z.ZodOptional<z.ZodString>;
    nombre: z.ZodOptional<z.ZodString>;
    descripcion: z.ZodOptional<z.ZodString>;
    id_categoria: z.ZodOptional<z.ZodNumber>;
    tipo_materia: z.ZodOptional<z.ZodNativeEnum<{
        prima: "prima";
        procesada: "procesada";
    }>>;
    unidad_medida: z.ZodOptional<z.ZodNativeEnum<{
        unidad: "unidad";
        gramo: "gramo";
        kilogramo: "kilogramo";
        litro: "litro";
        mililitro: "mililitro";
        porcion: "porcion";
    }>>;
    precio_unitario: z.ZodOptional<z.ZodNumber>;
    precio_venta: z.ZodOptional<z.ZodNumber>;
    stock_actual: z.ZodOptional<z.ZodNumber>;
    stock_minimo: z.ZodOptional<z.ZodNumber>;
    stock_maximo: z.ZodOptional<z.ZodNumber>;
    punto_reorden: z.ZodOptional<z.ZodNumber>;
    dias_vida_util: z.ZodOptional<z.ZodNumber>;
    requiere_refrigeracion: z.ZodOptional<z.ZodBoolean>;
    imagen_url: z.ZodOptional<z.ZodString>;
    es_vendible: z.ZodOptional<z.ZodBoolean>;
    estado: z.ZodOptional<z.ZodNativeEnum<{
        activo: "activo";
        inactivo: "inactivo";
        eliminado: "eliminado";
    }>>;
}, "strip", z.ZodTypeAny, {
    estado?: "activo" | "inactivo" | "eliminado" | undefined;
    nombre?: string | undefined;
    descripcion?: string | undefined;
    codigo_barras?: string | undefined;
    sku?: string | undefined;
    id_categoria?: number | undefined;
    tipo_materia?: "prima" | "procesada" | undefined;
    unidad_medida?: "unidad" | "gramo" | "kilogramo" | "litro" | "mililitro" | "porcion" | undefined;
    precio_unitario?: number | undefined;
    precio_venta?: number | undefined;
    stock_actual?: number | undefined;
    stock_minimo?: number | undefined;
    stock_maximo?: number | undefined;
    punto_reorden?: number | undefined;
    dias_vida_util?: number | undefined;
    requiere_refrigeracion?: boolean | undefined;
    imagen_url?: string | undefined;
    es_vendible?: boolean | undefined;
}, {
    estado?: "activo" | "inactivo" | "eliminado" | undefined;
    nombre?: string | undefined;
    descripcion?: string | undefined;
    codigo_barras?: string | undefined;
    sku?: string | undefined;
    id_categoria?: number | undefined;
    tipo_materia?: "prima" | "procesada" | undefined;
    unidad_medida?: "unidad" | "gramo" | "kilogramo" | "litro" | "mililitro" | "porcion" | undefined;
    precio_unitario?: number | undefined;
    precio_venta?: number | undefined;
    stock_actual?: number | undefined;
    stock_minimo?: number | undefined;
    stock_maximo?: number | undefined;
    punto_reorden?: number | undefined;
    dias_vida_util?: number | undefined;
    requiere_refrigeracion?: boolean | undefined;
    imagen_url?: string | undefined;
    es_vendible?: boolean | undefined;
}>;
export declare const updateStockSchema: z.ZodObject<{
    cantidad: z.ZodNumber;
    tipo: z.ZodEnum<["entrada", "salida"]>;
    motivo: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    cantidad: number;
    tipo: "entrada" | "salida";
    motivo?: string | undefined;
}, {
    cantidad: number;
    tipo: "entrada" | "salida";
    motivo?: string | undefined;
}>;
export type CreateProductoDTO = z.infer<typeof createProductoSchema>;
export type UpdateProductoDTO = z.infer<typeof updateProductoSchema>;
export type UpdateStockDTO = z.infer<typeof updateStockSchema>;
//# sourceMappingURL=productos.dto.d.ts.map