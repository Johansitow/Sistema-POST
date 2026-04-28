/**
 * ProveedorRepository - Solo queries Prisma para proveedores
 */
import { EstadoGeneral } from '@prisma/client';
import { PaginationParams } from '../lib/pagination';
export declare const proveedorRepository: {
    findAll: (pagination: PaginationParams, filters: {
        search?: string;
        estado?: EstadoGeneral;
    }) => Promise<[({
        _count: {
            productos: number;
        };
    } & {
        id: number;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        razon_social: string;
        nit: string | null;
        contacto_nombre: string | null;
        contacto_telefono: string | null;
        contacto_email: string | null;
        direccion: string | null;
        ciudad: string | null;
        calificacion: import("@prisma/client/runtime/library").Decimal | null;
        tiempo_entrega_promedio: number | null;
    })[], number]>;
    findById: (id: number) => import(".prisma/client").Prisma.Prisma__ProveedorClient<({
        productos: ({
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
            estado: import(".prisma/client").$Enums.EstadoGeneral;
            fecha_creacion: Date;
            fecha_modificacion: Date;
            precio_unitario: import("@prisma/client/runtime/library").Decimal;
            id_producto: number;
            id_proveedor: number;
            tiempo_entrega: number | null;
            cantidad_minima: import("@prisma/client/runtime/library").Decimal | null;
            es_proveedor_preferido: boolean;
        })[];
    } & {
        id: number;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        razon_social: string;
        nit: string | null;
        contacto_nombre: string | null;
        contacto_telefono: string | null;
        contacto_email: string | null;
        direccion: string | null;
        ciudad: string | null;
        calificacion: import("@prisma/client/runtime/library").Decimal | null;
        tiempo_entrega_promedio: number | null;
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    findByNit: (nit: string, excludeId?: number) => import(".prisma/client").Prisma.Prisma__ProveedorClient<{
        id: number;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        razon_social: string;
        nit: string | null;
        contacto_nombre: string | null;
        contacto_telefono: string | null;
        contacto_email: string | null;
        direccion: string | null;
        ciudad: string | null;
        calificacion: import("@prisma/client/runtime/library").Decimal | null;
        tiempo_entrega_promedio: number | null;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    create: (data: {
        razon_social: string;
        nit?: string;
        contacto_nombre?: string;
        contacto_telefono?: string;
        contacto_email?: string;
        direccion?: string;
        ciudad?: string;
        calificacion?: number;
        tiempo_entrega_promedio?: number;
    }) => import(".prisma/client").Prisma.Prisma__ProveedorClient<{
        id: number;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        razon_social: string;
        nit: string | null;
        contacto_nombre: string | null;
        contacto_telefono: string | null;
        contacto_email: string | null;
        direccion: string | null;
        ciudad: string | null;
        calificacion: import("@prisma/client/runtime/library").Decimal | null;
        tiempo_entrega_promedio: number | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    update: (id: number, data: Partial<{
        razon_social: string;
        nit: string;
        contacto_nombre: string;
        contacto_telefono: string;
        contacto_email: string;
        direccion: string;
        ciudad: string;
        calificacion: number;
        tiempo_entrega_promedio: number;
        estado: EstadoGeneral;
    }>) => import(".prisma/client").Prisma.Prisma__ProveedorClient<{
        id: number;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        razon_social: string;
        nit: string | null;
        contacto_nombre: string | null;
        contacto_telefono: string | null;
        contacto_email: string | null;
        direccion: string | null;
        ciudad: string | null;
        calificacion: import("@prisma/client/runtime/library").Decimal | null;
        tiempo_entrega_promedio: number | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    findProductosByProveedor: (id_proveedor: number) => import(".prisma/client").Prisma.PrismaPromise<({
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
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        precio_unitario: import("@prisma/client/runtime/library").Decimal;
        id_producto: number;
        id_proveedor: number;
        tiempo_entrega: number | null;
        cantidad_minima: import("@prisma/client/runtime/library").Decimal | null;
        es_proveedor_preferido: boolean;
    })[]>;
    findProveedoresByProducto: (id_producto: number) => import(".prisma/client").Prisma.PrismaPromise<({
        proveedor: {
            id: number;
            estado: import(".prisma/client").$Enums.EstadoGeneral;
            fecha_creacion: Date;
            fecha_modificacion: Date;
            razon_social: string;
            nit: string | null;
            contacto_nombre: string | null;
            contacto_telefono: string | null;
            contacto_email: string | null;
            direccion: string | null;
            ciudad: string | null;
            calificacion: import("@prisma/client/runtime/library").Decimal | null;
            tiempo_entrega_promedio: number | null;
        };
    } & {
        id: number;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        precio_unitario: import("@prisma/client/runtime/library").Decimal;
        id_producto: number;
        id_proveedor: number;
        tiempo_entrega: number | null;
        cantidad_minima: import("@prisma/client/runtime/library").Decimal | null;
        es_proveedor_preferido: boolean;
    })[]>;
    findRelacion: (id_proveedor: number, id_producto: number) => import(".prisma/client").Prisma.Prisma__ProveedorProductoClient<{
        id: number;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        precio_unitario: import("@prisma/client/runtime/library").Decimal;
        id_producto: number;
        id_proveedor: number;
        tiempo_entrega: number | null;
        cantidad_minima: import("@prisma/client/runtime/library").Decimal | null;
        es_proveedor_preferido: boolean;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    createRelacion: (data: {
        id_proveedor: number;
        id_producto: number;
        precio_unitario: any;
        tiempo_entrega?: number;
        cantidad_minima?: any;
        es_proveedor_preferido?: boolean;
    }) => import(".prisma/client").Prisma.Prisma__ProveedorProductoClient<{
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
        proveedor: {
            id: number;
            estado: import(".prisma/client").$Enums.EstadoGeneral;
            fecha_creacion: Date;
            fecha_modificacion: Date;
            razon_social: string;
            nit: string | null;
            contacto_nombre: string | null;
            contacto_telefono: string | null;
            contacto_email: string | null;
            direccion: string | null;
            ciudad: string | null;
            calificacion: import("@prisma/client/runtime/library").Decimal | null;
            tiempo_entrega_promedio: number | null;
        };
    } & {
        id: number;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        precio_unitario: import("@prisma/client/runtime/library").Decimal;
        id_producto: number;
        id_proveedor: number;
        tiempo_entrega: number | null;
        cantidad_minima: import("@prisma/client/runtime/library").Decimal | null;
        es_proveedor_preferido: boolean;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    updateRelacion: (id_proveedor: number, id_producto: number, data: Partial<{
        precio_unitario: any;
        tiempo_entrega: number;
        cantidad_minima: any;
        es_proveedor_preferido: boolean;
        estado: EstadoGeneral;
    }>) => import(".prisma/client").Prisma.Prisma__ProveedorProductoClient<{
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
        proveedor: {
            id: number;
            estado: import(".prisma/client").$Enums.EstadoGeneral;
            fecha_creacion: Date;
            fecha_modificacion: Date;
            razon_social: string;
            nit: string | null;
            contacto_nombre: string | null;
            contacto_telefono: string | null;
            contacto_email: string | null;
            direccion: string | null;
            ciudad: string | null;
            calificacion: import("@prisma/client/runtime/library").Decimal | null;
            tiempo_entrega_promedio: number | null;
        };
    } & {
        id: number;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        precio_unitario: import("@prisma/client/runtime/library").Decimal;
        id_producto: number;
        id_proveedor: number;
        tiempo_entrega: number | null;
        cantidad_minima: import("@prisma/client/runtime/library").Decimal | null;
        es_proveedor_preferido: boolean;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
};
//# sourceMappingURL=proveedor.repository.d.ts.map