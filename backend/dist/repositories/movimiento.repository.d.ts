/**
 * MovimientoRepository - Solo queries Prisma para movimientos de inventario
 */
import { TipoMovimiento } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PaginationParams } from '../lib/pagination';
export interface MovimientoData {
    id_producto: number;
    tipo_movimiento: TipoMovimiento;
    cantidad: Decimal;
    stock_anterior: Decimal;
    stock_nuevo: Decimal;
    motivo: string;
    id_orden?: number;
    id_proveedor?: number;
    id_lote?: number;
    referencia?: string;
}
export declare const movimientoRepository: {
    findAll: (pagination: PaginationParams, filters: {
        id_producto?: number;
        tipo?: TipoMovimiento;
        fecha_desde?: Date;
        fecha_hasta?: Date;
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
            precio_unitario: Decimal;
            precio_venta: Decimal | null;
            stock_actual: Decimal;
            stock_minimo: Decimal;
            stock_maximo: Decimal | null;
            punto_reorden: Decimal | null;
            dias_vida_util: number | null;
            requiere_refrigeracion: boolean;
            imagen_url: string | null;
            es_vendible: boolean;
        };
    } & {
        id: number;
        id_producto: number;
        tipo_movimiento: import(".prisma/client").$Enums.TipoMovimiento;
        cantidad: Decimal;
        stock_anterior: Decimal;
        stock_nuevo: Decimal;
        motivo: string;
        id_proveedor: number | null;
        id_lote: number | null;
        id_orden: number | null;
        referencia: string | null;
        fecha_movimiento: Date;
    })[], number]>;
    create: (data: MovimientoData) => import(".prisma/client").Prisma.Prisma__MovimientoClient<{
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
            precio_unitario: Decimal;
            precio_venta: Decimal | null;
            stock_actual: Decimal;
            stock_minimo: Decimal;
            stock_maximo: Decimal | null;
            punto_reorden: Decimal | null;
            dias_vida_util: number | null;
            requiere_refrigeracion: boolean;
            imagen_url: string | null;
            es_vendible: boolean;
        };
    } & {
        id: number;
        id_producto: number;
        tipo_movimiento: import(".prisma/client").$Enums.TipoMovimiento;
        cantidad: Decimal;
        stock_anterior: Decimal;
        stock_nuevo: Decimal;
        motivo: string;
        id_proveedor: number | null;
        id_lote: number | null;
        id_orden: number | null;
        referencia: string | null;
        fecha_movimiento: Date;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    groupByTipo: (gte: Date) => import(".prisma/client").Prisma.GetMovimientoGroupByPayload<{
        by: "tipo_movimiento"[];
        where: {
            fecha_movimiento: {
                gte: Date;
            };
        };
        _count: true;
        _sum: {
            cantidad: true;
        };
    }>;
    count: (gte: Date) => import(".prisma/client").Prisma.PrismaPromise<number>;
    findDistinctProductos: (gte: Date) => import(".prisma/client").Prisma.PrismaPromise<{
        id_producto: number;
    }[]>;
};
//# sourceMappingURL=movimiento.repository.d.ts.map