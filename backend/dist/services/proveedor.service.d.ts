/**
 * ProveedorService - Lógica de negocio para proveedores y sus productos
 */
import { EstadoGeneral } from '@prisma/client';
export declare const proveedorService: {
    listar(params: {
        page?: unknown;
        limit?: unknown;
        search?: string;
        estado?: EstadoGeneral;
    }): Promise<import("../lib/pagination").PaginatedResult<{
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
    }>>;
    obtenerPorId(id: number): Promise<{
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
    }>;
    crear(data: {
        razon_social: string;
        nit?: string;
        contacto_nombre?: string;
        contacto_telefono?: string;
        contacto_email?: string;
        direccion?: string;
        ciudad?: string;
        calificacion?: number;
        tiempo_entrega_promedio?: number;
    }): Promise<{
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
    }>;
    actualizar(id: number, data: Partial<{
        razon_social: string;
        nit: string;
        contacto_nombre: string;
        contacto_telefono: string;
        contacto_email: string;
        direccion: string;
        ciudad: string;
        calificacion: number;
        tiempo_entrega_promedio: number;
    }>): Promise<{
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
    }>;
    cambiarEstado(id: number, estado: EstadoGeneral): Promise<{
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
    }>;
    listarProductos(id_proveedor: number): Promise<({
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
    asociarProducto(id_proveedor: number, data: {
        id_producto: number;
        precio_unitario: number;
        tiempo_entrega?: number;
        cantidad_minima?: number;
        es_proveedor_preferido?: boolean;
    }): Promise<{
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
    }>;
    actualizarRelacion(id_proveedor: number, id_producto: number, data: Partial<{
        precio_unitario: number;
        tiempo_entrega: number;
        cantidad_minima: number;
        es_proveedor_preferido: boolean;
    }>): Promise<{
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
    }>;
    desasociarProducto(id_proveedor: number, id_producto: number): Promise<{
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
    }>;
};
//# sourceMappingURL=proveedor.service.d.ts.map