/**
 * LoteRepository - Solo queries Prisma para lotes
 */
import { EstadoLote } from '@prisma/client';
import { PaginationParams } from '../lib/pagination';
export declare const loteRepository: {
    findAll: (pagination: PaginationParams, filters: {
        id_producto?: number;
        estado_lote?: EstadoLote;
        vence_antes_de?: Date;
    }) => Promise<[({
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
    })[], number]>;
    findById: (id: number) => import(".prisma/client").Prisma.Prisma__LoteClient<({
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
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    /**
     * findUltimo — busca el último lote creado para generar el número siguiente
     * Ordena por numero_lote descendente para obtener el mayor.
     */
    findUltimo: () => import(".prisma/client").Prisma.Prisma__LoteClient<{
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
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    create: (data: {
        numero_lote: string;
        id_producto: number;
        cantidad_producida: any;
        fecha_vencimiento?: Date;
        costo_produccion?: any;
        observaciones?: string;
    }) => import(".prisma/client").Prisma.Prisma__LoteClient<{
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
        observaciones: string | null;
        cantidad_producida: import("@prisma/client/runtime/library").Decimal;
        numero_lote: string;
        merma_cantidad: import("@prisma/client/runtime/library").Decimal;
        merma_porcentaje: import("@prisma/client/runtime/library").Decimal;
        fecha_produccion: Date;
        fecha_vencimiento: Date | null;
        estado_lote: import(".prisma/client").$Enums.EstadoLote;
        costo_produccion: import("@prisma/client/runtime/library").Decimal | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    update: (id: number, data: Partial<{
        estado_lote: EstadoLote;
        fecha_vencimiento: Date;
        observaciones: string;
        merma_cantidad: any;
        merma_porcentaje: any;
    }>) => import(".prisma/client").Prisma.Prisma__LoteClient<{
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
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
};
//# sourceMappingURL=lote.repository.d.ts.map