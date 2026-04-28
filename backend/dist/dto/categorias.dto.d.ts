/**
 * CategoriasDTO - Validación de forma para categorías
 */
import { z } from 'zod';
export declare const createCategoriaSchema: z.ZodObject<{
    nombre: z.ZodString;
    descripcion: z.ZodOptional<z.ZodString>;
    categoria_padre: z.ZodOptional<z.ZodNumber>;
    imagen_url: z.ZodOptional<z.ZodString>;
    estado: z.ZodOptional<z.ZodDefault<z.ZodNativeEnum<{
        activo: "activo";
        inactivo: "inactivo";
        eliminado: "eliminado";
    }>>>;
    orden: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    nombre: string;
    orden?: number | undefined;
    estado?: "activo" | "inactivo" | "eliminado" | undefined;
    descripcion?: string | undefined;
    imagen_url?: string | undefined;
    categoria_padre?: number | undefined;
}, {
    nombre: string;
    orden?: number | undefined;
    estado?: "activo" | "inactivo" | "eliminado" | undefined;
    descripcion?: string | undefined;
    imagen_url?: string | undefined;
    categoria_padre?: number | undefined;
}>;
export declare const updateCategoriaSchema: z.ZodObject<{
    nombre: z.ZodOptional<z.ZodString>;
    descripcion: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    categoria_padre: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    imagen_url: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    estado: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodNativeEnum<{
        activo: "activo";
        inactivo: "inactivo";
        eliminado: "eliminado";
    }>>>>;
    orden: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodNumber>>>;
}, "strip", z.ZodTypeAny, {
    orden?: number | undefined;
    estado?: "activo" | "inactivo" | "eliminado" | undefined;
    nombre?: string | undefined;
    descripcion?: string | undefined;
    imagen_url?: string | undefined;
    categoria_padre?: number | undefined;
}, {
    orden?: number | undefined;
    estado?: "activo" | "inactivo" | "eliminado" | undefined;
    nombre?: string | undefined;
    descripcion?: string | undefined;
    imagen_url?: string | undefined;
    categoria_padre?: number | undefined;
}>;
export type CreateCategoriaDTO = z.infer<typeof createCategoriaSchema>;
export type UpdateCategoriaDTO = z.infer<typeof updateCategoriaSchema>;
//# sourceMappingURL=categorias.dto.d.ts.map