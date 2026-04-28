/**
 * InventarioDTO - Validación de forma para movimientos de inventario
 */
import { z } from 'zod';
export declare const registrarMovimientoSchema: z.ZodObject<{
    id_producto: z.ZodNumber;
    tipo_movimiento: z.ZodNativeEnum<{
        entrada: "entrada";
        salida: "salida";
        ajuste: "ajuste";
        merma: "merma";
        produccion: "produccion";
        venta: "venta";
        devolucion: "devolucion";
    }>;
    cantidad: z.ZodNumber;
    motivo: z.ZodString;
    id_proveedor: z.ZodOptional<z.ZodNumber>;
    id_lote: z.ZodOptional<z.ZodNumber>;
    referencia: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id_producto: number;
    tipo_movimiento: "entrada" | "salida" | "ajuste" | "merma" | "produccion" | "venta" | "devolucion";
    cantidad: number;
    motivo: string;
    id_proveedor?: number | undefined;
    id_lote?: number | undefined;
    referencia?: string | undefined;
}, {
    id_producto: number;
    tipo_movimiento: "entrada" | "salida" | "ajuste" | "merma" | "produccion" | "venta" | "devolucion";
    cantidad: number;
    motivo: string;
    id_proveedor?: number | undefined;
    id_lote?: number | undefined;
    referencia?: string | undefined;
}>;
export type RegistrarMovimientoDTO = z.infer<typeof registrarMovimientoSchema>;
//# sourceMappingURL=inventario.dto.d.ts.map