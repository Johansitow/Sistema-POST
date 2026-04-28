/**
 * InventarioService - Solo lógica de negocio para inventario
 *
 * Cambios respecto a la versión anterior:
 * 1. registrarMovimiento() requiere id_proveedor cuando tipo = 'entrada'
 * 2. Al registrar una entrada se crea automáticamente un lote
 *    con número secuencial global (LOTE-000001, LOTE-000002...)
 * 3. El id del lote generado se asocia al movimiento
 *
 * Correcciones de TypeScript:
 * - TIPOS_ENTRADA y TIPOS_SALIDA tipados como Set<TipoMovimiento> (fix error 2345)
 */
import { TipoMovimiento } from '@prisma/client';
export declare const inventarioService: {
    listarMovimientos(params: {
        page?: unknown;
        limit?: unknown;
        id_producto?: number;
        tipo?: TipoMovimiento;
        fecha_desde?: Date;
        fecha_hasta?: Date;
    }): Promise<import("../lib/pagination").PaginatedResult<{
        producto: {
            categoria: {
                orden: number;
                id: number;
                estado: import(".prisma/client").$Enums.EstadoGeneral;
                fecha_creacion: Date;
                nombre: string;
                descripcion: string | null;
                imagen_url: string | null;
                categoria_padre: number | null;
            } | null;
        } & {
            id: number;
            estado: import(".prisma/client").$Enums.EstadoGeneral;
            fecha_creacion: Date;
            fecha_modificacion: Date;
            nombre: string;
            descripcion: string | null;
            codigo_barras: string | null;
            sku: string;
            id_categoria: number | null;
            tipo_materia: import(".prisma/client").$Enums.TipoMateria;
            unidad_medida: import(".prisma/client").$Enums.UnidadMedida;
            precio_unitario: import("@prisma/client/runtime/library").Decimal;
            precio_venta: import("@prisma/client/runtime/library").Decimal | null;
            stock_actual: import("@prisma/client/runtime/library").Decimal;
            stock_minimo: import("@prisma/client/runtime/library").Decimal;
            stock_maximo: import("@prisma/client/runtime/library").Decimal | null;
            punto_reorden: import("@prisma/client/runtime/library").Decimal | null;
            dias_vida_util: number | null;
            requiere_refrigeracion: boolean;
            imagen_url: string | null;
            es_vendible: boolean;
        };
    } & {
        id: number;
        id_producto: number;
        tipo_movimiento: import(".prisma/client").$Enums.TipoMovimiento;
        cantidad: import("@prisma/client/runtime/library").Decimal;
        stock_anterior: import("@prisma/client/runtime/library").Decimal;
        stock_nuevo: import("@prisma/client/runtime/library").Decimal;
        motivo: string;
        id_proveedor: number | null;
        id_lote: number | null;
        id_orden: number | null;
        referencia: string | null;
        fecha_movimiento: Date;
    }>>;
    /**
     * registrarMovimiento — registra un movimiento de inventario
     *
     * Reglas:
     * - tipo 'entrada': id_proveedor es REQUERIDO, se crea un lote automáticamente
     * - tipo 'salida' / 'merma' / 'venta': verifica stock suficiente
     * - tipo 'ajuste': establece el stock en el valor exacto recibido
     * - tipo 'produccion' / 'devolucion': incrementa sin requerir proveedor
     *
     * El lote generado tiene número secuencial global (LOTE-000001...).
     * fecha_vencimiento y costo_produccion son opcionales en el lote.
     */
    registrarMovimiento(data: {
        id_producto: number;
        tipo_movimiento: TipoMovimiento;
        cantidad: number;
        motivo: string;
        id_proveedor?: number;
        referencia?: string;
        fecha_vencimiento?: Date;
        costo_produccion?: number;
        observaciones_lote?: string;
    }): Promise<{
        movimiento: {
            producto: {
                id: number;
                estado: import(".prisma/client").$Enums.EstadoGeneral;
                fecha_creacion: Date;
                fecha_modificacion: Date;
                nombre: string;
                descripcion: string | null;
                codigo_barras: string | null;
                sku: string;
                id_categoria: number | null;
                tipo_materia: import(".prisma/client").$Enums.TipoMateria;
                unidad_medida: import(".prisma/client").$Enums.UnidadMedida;
                precio_unitario: import("@prisma/client/runtime/library").Decimal;
                precio_venta: import("@prisma/client/runtime/library").Decimal | null;
                stock_actual: import("@prisma/client/runtime/library").Decimal;
                stock_minimo: import("@prisma/client/runtime/library").Decimal;
                stock_maximo: import("@prisma/client/runtime/library").Decimal | null;
                punto_reorden: import("@prisma/client/runtime/library").Decimal | null;
                dias_vida_util: number | null;
                requiere_refrigeracion: boolean;
                imagen_url: string | null;
                es_vendible: boolean;
            };
        } & {
            id: number;
            id_producto: number;
            tipo_movimiento: import(".prisma/client").$Enums.TipoMovimiento;
            cantidad: import("@prisma/client/runtime/library").Decimal;
            stock_anterior: import("@prisma/client/runtime/library").Decimal;
            stock_nuevo: import("@prisma/client/runtime/library").Decimal;
            motivo: string;
            id_proveedor: number | null;
            id_lote: number | null;
            id_orden: number | null;
            referencia: string | null;
            fecha_movimiento: Date;
        };
        lote_generado: {
            id: number;
            id_producto: number;
            observaciones: string | null;
            cantidad_producida: import("@prisma/client/runtime/library").Decimal;
            numero_lote: string;
            merma_cantidad: import("@prisma/client/runtime/library").Decimal;
            merma_porcentaje: import("@prisma/client/runtime/library").Decimal;
            fecha_produccion: Date;
            fecha_vencimiento: Date | null;
            estado_lote: import(".prisma/client").$Enums.EstadoLote;
            costo_produccion: import("@prisma/client/runtime/library").Decimal | null;
        } | null;
    }>;
    estadisticasMovimientos(dias?: number): Promise<{
        porTipo: {
            tipo: import(".prisma/client").$Enums.TipoMovimiento;
            cantidad_movimientos: number;
            cantidad_total: number;
        }[];
        totalMovimientos: number;
        productosAfectados: number;
        periodo: string;
    }>;
    listarLotes(params: {
        page?: unknown;
        limit?: unknown;
        id_producto?: number;
        estado_lote?: any;
        vence_antes_de?: Date;
    }): Promise<import("../lib/pagination").PaginatedResult<{
        producto: {
            categoria: {
                orden: number;
                id: number;
                estado: import(".prisma/client").$Enums.EstadoGeneral;
                fecha_creacion: Date;
                nombre: string;
                descripcion: string | null;
                imagen_url: string | null;
                categoria_padre: number | null;
            } | null;
        } & {
            id: number;
            estado: import(".prisma/client").$Enums.EstadoGeneral;
            fecha_creacion: Date;
            fecha_modificacion: Date;
            nombre: string;
            descripcion: string | null;
            codigo_barras: string | null;
            sku: string;
            id_categoria: number | null;
            tipo_materia: import(".prisma/client").$Enums.TipoMateria;
            unidad_medida: import(".prisma/client").$Enums.UnidadMedida;
            precio_unitario: import("@prisma/client/runtime/library").Decimal;
            precio_venta: import("@prisma/client/runtime/library").Decimal | null;
            stock_actual: import("@prisma/client/runtime/library").Decimal;
            stock_minimo: import("@prisma/client/runtime/library").Decimal;
            stock_maximo: import("@prisma/client/runtime/library").Decimal | null;
            punto_reorden: import("@prisma/client/runtime/library").Decimal | null;
            dias_vida_util: number | null;
            requiere_refrigeracion: boolean;
            imagen_url: string | null;
            es_vendible: boolean;
        };
    } & {
        id: number;
        id_producto: number;
        observaciones: string | null;
        cantidad_producida: import("@prisma/client/runtime/library").Decimal;
        numero_lote: string;
        merma_cantidad: import("@prisma/client/runtime/library").Decimal;
        merma_porcentaje: import("@prisma/client/runtime/library").Decimal;
        fecha_produccion: Date;
        fecha_vencimiento: Date | null;
        estado_lote: import(".prisma/client").$Enums.EstadoLote;
        costo_produccion: import("@prisma/client/runtime/library").Decimal | null;
    }>>;
    lotesProximosVencer(dias?: number): Promise<({
        producto: {
            categoria: {
                orden: number;
                id: number;
                estado: import(".prisma/client").$Enums.EstadoGeneral;
                fecha_creacion: Date;
                nombre: string;
                descripcion: string | null;
                imagen_url: string | null;
                categoria_padre: number | null;
            } | null;
        } & {
            id: number;
            estado: import(".prisma/client").$Enums.EstadoGeneral;
            fecha_creacion: Date;
            fecha_modificacion: Date;
            nombre: string;
            descripcion: string | null;
            codigo_barras: string | null;
            sku: string;
            id_categoria: number | null;
            tipo_materia: import(".prisma/client").$Enums.TipoMateria;
            unidad_medida: import(".prisma/client").$Enums.UnidadMedida;
            precio_unitario: import("@prisma/client/runtime/library").Decimal;
            precio_venta: import("@prisma/client/runtime/library").Decimal | null;
            stock_actual: import("@prisma/client/runtime/library").Decimal;
            stock_minimo: import("@prisma/client/runtime/library").Decimal;
            stock_maximo: import("@prisma/client/runtime/library").Decimal | null;
            punto_reorden: import("@prisma/client/runtime/library").Decimal | null;
            dias_vida_util: number | null;
            requiere_refrigeracion: boolean;
            imagen_url: string | null;
            es_vendible: boolean;
        };
    } & {
        id: number;
        id_producto: number;
        observaciones: string | null;
        cantidad_producida: import("@prisma/client/runtime/library").Decimal;
        numero_lote: string;
        merma_cantidad: import("@prisma/client/runtime/library").Decimal;
        merma_porcentaje: import("@prisma/client/runtime/library").Decimal;
        fecha_produccion: Date;
        fecha_vencimiento: Date | null;
        estado_lote: import(".prisma/client").$Enums.EstadoLote;
        costo_produccion: import("@prisma/client/runtime/library").Decimal | null;
    })[]>;
    actualizarEstadoLote(id: number, data: Partial<{
        estado_lote: any;
        fecha_vencimiento: Date;
        observaciones: string;
    }>): Promise<{
        id: number;
        id_producto: number;
        observaciones: string | null;
        cantidad_producida: import("@prisma/client/runtime/library").Decimal;
        numero_lote: string;
        merma_cantidad: import("@prisma/client/runtime/library").Decimal;
        merma_porcentaje: import("@prisma/client/runtime/library").Decimal;
        fecha_produccion: Date;
        fecha_vencimiento: Date | null;
        estado_lote: import(".prisma/client").$Enums.EstadoLote;
        costo_produccion: import("@prisma/client/runtime/library").Decimal | null;
    }>;
    valorInventario(): Promise<{
        valorTotal: number;
        totalProductos: number;
        productos: {
            stock_actual: number;
            precio_unitario: number;
            valor_total: number;
            categoria: {
                nombre: string;
            } | null;
            id: number;
            nombre: string;
            sku: string;
            stock_minimo: import("@prisma/client/runtime/library").Decimal;
        }[];
        porCategoria: unknown[];
    }>;
    alertasInventario(): Promise<{
        stockBajo: any[];
        stockAgotado: any[];
        totalAlertas: number;
    }>;
};
//# sourceMappingURL=inventario.service.d.ts.map