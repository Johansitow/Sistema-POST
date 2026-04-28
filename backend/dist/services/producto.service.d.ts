/**
 * ProductoService - Solo lógica de negocio para productos
 */
import { EstadoGeneral } from '@prisma/client';
export declare const productoService: {
    listar(params: {
        page?: unknown;
        limit?: unknown;
        search?: string;
        categoria?: number;
        estado?: EstadoGeneral;
    }): Promise<import("../lib/pagination").PaginatedResult<{
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
    }>>;
    obtenerPorId(id: number): Promise<{
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
            cantidad: import("@prisma/client/runtime/library").Decimal;
            stock_anterior: import("@prisma/client/runtime/library").Decimal;
            stock_nuevo: import("@prisma/client/runtime/library").Decimal;
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
    }>;
    obtenerPorSKU(sku: string): Promise<{
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
    }>;
    crear(data: any): Promise<{
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
    }>;
    actualizar(id: number, data: any): Promise<{
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
    }>;
    eliminar(id: number): Promise<{
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
    }>;
    actualizarStock(id: number, cantidad: number, tipo: "entrada" | "salida"): Promise<({
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
            cantidad: import("@prisma/client/runtime/library").Decimal;
            stock_anterior: import("@prisma/client/runtime/library").Decimal;
            stock_nuevo: import("@prisma/client/runtime/library").Decimal;
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
    }) | null>;
    stockBajo(): Promise<{
        categoria: {
            nombre: string;
        } | null;
        id: number;
        nombre: string;
        sku: string;
        precio_unitario: import("@prisma/client/runtime/library").Decimal;
        stock_actual: import("@prisma/client/runtime/library").Decimal;
        stock_minimo: import("@prisma/client/runtime/library").Decimal;
    }[]>;
    estadisticas(): Promise<{
        total: number;
        activos: number;
        inactivos: number;
        stockBajo: number;
        valorTotal: number;
    }>;
};
//# sourceMappingURL=producto.service.d.ts.map