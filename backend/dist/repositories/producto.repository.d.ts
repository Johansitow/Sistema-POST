/**
 * ProductoRepository - Solo queries Prisma para productos
 */
import { EstadoGeneral } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PaginationParams } from '../lib/pagination';
export interface ProductoData {
    codigo_barras?: string;
    sku: string;
    nombre: string;
    descripcion?: string;
    id_categoria?: number;
    tipo_materia: any;
    unidad_medida: any;
    precio_unitario: Decimal;
    precio_venta?: Decimal;
    stock_actual?: Decimal;
    stock_minimo?: Decimal;
    stock_maximo?: Decimal;
    punto_reorden?: Decimal;
    dias_vida_util?: number;
    requiere_refrigeracion?: boolean;
    imagen_url?: string;
    es_vendible?: boolean;
    estado?: EstadoGeneral;
}
export declare const productoRepository: {
    findAll: (pagination: PaginationParams, filters: {
        search?: string;
        id_categoria?: number;
        estado?: EstadoGeneral;
    }) => Promise<[({
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
    })[], number]>;
    findById: (id: number) => import(".prisma/client").Prisma.Prisma__ProductoClient<({
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
        movimientos: {
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
        }[];
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
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    findBySKU: (sku: string) => import(".prisma/client").Prisma.Prisma__ProductoClient<({
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
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    findActivos: () => import(".prisma/client").Prisma.PrismaPromise<{
        categoria: {
            nombre: string;
        } | null;
        id: number;
        nombre: string;
        sku: string;
        precio_unitario: Decimal;
        stock_actual: Decimal;
        stock_minimo: Decimal;
    }[]>;
    create: (data: ProductoData) => import(".prisma/client").Prisma.Prisma__ProductoClient<{
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
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    update: (id: number, data: Partial<ProductoData>) => import(".prisma/client").Prisma.Prisma__ProductoClient<{
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
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    updateStock: (id: number, stock_actual: Decimal) => import(".prisma/client").Prisma.Prisma__ProductoClient<{
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
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    softDelete: (id: number) => import(".prisma/client").Prisma.Prisma__ProductoClient<{
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
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    count: () => import(".prisma/client").Prisma.PrismaPromise<number>;
    countByEstado: (estado: EstadoGeneral) => import(".prisma/client").Prisma.PrismaPromise<number>;
};
//# sourceMappingURL=producto.repository.d.ts.map