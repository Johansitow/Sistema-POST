/**
 * Servicio de Productos
 * Adaptado al schema real de Prisma
 */
import { TipoMateria, UnidadMedida, EstadoGeneral } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
export interface ProductoCreateInput {
    codigo_barras?: string;
    sku: string;
    nombre: string;
    descripcion?: string;
    id_categoria?: number;
    tipo_materia: TipoMateria;
    unidad_medida: UnidadMedida;
    precio_unitario: number;
    precio_venta?: number;
    stock_actual?: number;
    stock_minimo?: number;
    stock_maximo?: number;
    punto_reorden?: number;
    dias_vida_util?: number;
    requiere_refrigeracion?: boolean;
    imagen_url?: string;
    es_vendible?: boolean;
    estado?: EstadoGeneral;
}
export interface ProductoUpdateInput {
    codigo_barras?: string;
    sku?: string;
    nombre?: string;
    descripcion?: string;
    id_categoria?: number;
    tipo_materia?: TipoMateria;
    unidad_medida?: UnidadMedida;
    precio_unitario?: number;
    precio_venta?: number;
    stock_actual?: number;
    stock_minimo?: number;
    stock_maximo?: number;
    punto_reorden?: number;
    dias_vida_util?: number;
    requiere_refrigeracion?: boolean;
    imagen_url?: string;
    es_vendible?: boolean;
    estado?: EstadoGeneral;
}
export interface ProductosFilter {
    search?: string;
    categoria?: number;
    estado?: EstadoGeneral;
    page?: number;
    limit?: number;
}
export declare class ProductosService {
    findAll(filter?: ProductosFilter): Promise<({
        categoria: {
            estado: import(".prisma/client").$Enums.EstadoGeneral;
            nombre: string;
            id: number;
            descripcion: string | null;
            imagen_url: string | null;
            fecha_creacion: Date;
            orden: number;
            categoria_padre: number | null;
        } | null;
    } & {
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        sku: string;
        nombre: string;
        id: number;
        codigo_barras: string | null;
        descripcion: string | null;
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
        fecha_creacion: Date;
        fecha_modificacion: Date;
    })[]>;
    findById(id: number): Promise<({
        categoria: {
            estado: import(".prisma/client").$Enums.EstadoGeneral;
            nombre: string;
            id: number;
            descripcion: string | null;
            imagen_url: string | null;
            fecha_creacion: Date;
            orden: number;
            categoria_padre: number | null;
        } | null;
        movimientos: {
            id: number;
            fecha_movimiento: Date;
            tipo_movimiento: import(".prisma/client").$Enums.TipoMovimiento;
            cantidad: Decimal;
            stock_anterior: Decimal;
            stock_nuevo: Decimal;
            motivo: string;
            id_proveedor: number | null;
            id_lote: number | null;
            id_orden: number | null;
            referencia: string | null;
            id_producto: number;
        }[];
    } & {
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        sku: string;
        nombre: string;
        id: number;
        codigo_barras: string | null;
        descripcion: string | null;
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
        fecha_creacion: Date;
        fecha_modificacion: Date;
    }) | null>;
    findBySKU(sku: string): Promise<({
        categoria: {
            estado: import(".prisma/client").$Enums.EstadoGeneral;
            nombre: string;
            id: number;
            descripcion: string | null;
            imagen_url: string | null;
            fecha_creacion: Date;
            orden: number;
            categoria_padre: number | null;
        } | null;
    } & {
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        sku: string;
        nombre: string;
        id: number;
        codigo_barras: string | null;
        descripcion: string | null;
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
        fecha_creacion: Date;
        fecha_modificacion: Date;
    }) | null>;
    create(data: ProductoCreateInput): Promise<{
        categoria: {
            estado: import(".prisma/client").$Enums.EstadoGeneral;
            nombre: string;
            id: number;
            descripcion: string | null;
            imagen_url: string | null;
            fecha_creacion: Date;
            orden: number;
            categoria_padre: number | null;
        } | null;
    } & {
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        sku: string;
        nombre: string;
        id: number;
        codigo_barras: string | null;
        descripcion: string | null;
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
        fecha_creacion: Date;
        fecha_modificacion: Date;
    }>;
    update(id: number, data: ProductoUpdateInput): Promise<{
        categoria: {
            estado: import(".prisma/client").$Enums.EstadoGeneral;
            nombre: string;
            id: number;
            descripcion: string | null;
            imagen_url: string | null;
            fecha_creacion: Date;
            orden: number;
            categoria_padre: number | null;
        } | null;
    } & {
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        sku: string;
        nombre: string;
        id: number;
        codigo_barras: string | null;
        descripcion: string | null;
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
        fecha_creacion: Date;
        fecha_modificacion: Date;
    }>;
    delete(id: number): Promise<{
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        sku: string;
        nombre: string;
        id: number;
        codigo_barras: string | null;
        descripcion: string | null;
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
        fecha_creacion: Date;
        fecha_modificacion: Date;
    }>;
    updateStock(id: number, cantidad: number, tipo: 'entrada' | 'salida'): Promise<{
        categoria: {
            estado: import(".prisma/client").$Enums.EstadoGeneral;
            nombre: string;
            id: number;
            descripcion: string | null;
            imagen_url: string | null;
            fecha_creacion: Date;
            orden: number;
            categoria_padre: number | null;
        } | null;
    } & {
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        sku: string;
        nombre: string;
        id: number;
        codigo_barras: string | null;
        descripcion: string | null;
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
        fecha_creacion: Date;
        fecha_modificacion: Date;
    }>;
    findStockBajo(): Promise<({
        categoria: {
            estado: import(".prisma/client").$Enums.EstadoGeneral;
            nombre: string;
            id: number;
            descripcion: string | null;
            imagen_url: string | null;
            fecha_creacion: Date;
            orden: number;
            categoria_padre: number | null;
        } | null;
    } & {
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        sku: string;
        nombre: string;
        id: number;
        codigo_barras: string | null;
        descripcion: string | null;
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
        fecha_creacion: Date;
        fecha_modificacion: Date;
    })[]>;
    getEstadisticas(): Promise<{
        total: number;
        activos: number;
        inactivos: number;
        stockBajo: number;
        valorTotal: number;
    }>;
}
//# sourceMappingURL=productos.service.d.ts.map