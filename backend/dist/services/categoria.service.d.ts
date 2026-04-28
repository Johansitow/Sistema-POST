/**
 * CategoriaService - Solo lógica de negocio para categorías
 */
import { EstadoGeneral } from '@prisma/client';
export declare const categoriaService: {
    listar(estado?: EstadoGeneral): Promise<({
        _count: {
            productos: number;
        };
    } & {
        orden: number;
        id: number;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        fecha_creacion: Date;
        nombre: string;
        descripcion: string | null;
        imagen_url: string | null;
        categoria_padre: number | null;
    })[]>;
    obtenerPorId(id: number): Promise<{
        padre: {
            orden: number;
            id: number;
            estado: import(".prisma/client").$Enums.EstadoGeneral;
            fecha_creacion: Date;
            nombre: string;
            descripcion: string | null;
            imagen_url: string | null;
            categoria_padre: number | null;
        } | null;
        subcategorias: {
            orden: number;
            id: number;
            estado: import(".prisma/client").$Enums.EstadoGeneral;
            fecha_creacion: Date;
            nombre: string;
            descripcion: string | null;
            imagen_url: string | null;
            categoria_padre: number | null;
        }[];
        productos: {
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
        }[];
    } & {
        orden: number;
        id: number;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        fecha_creacion: Date;
        nombre: string;
        descripcion: string | null;
        imagen_url: string | null;
        categoria_padre: number | null;
    }>;
    crear(data: {
        nombre: string;
        descripcion?: string;
        categoria_padre?: number;
        imagen_url?: string;
        estado?: EstadoGeneral;
        orden?: number;
    }): Promise<{
        orden: number;
        id: number;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        fecha_creacion: Date;
        nombre: string;
        descripcion: string | null;
        imagen_url: string | null;
        categoria_padre: number | null;
    }>;
    actualizar(id: number, data: Partial<{
        nombre: string;
        descripcion: string;
        categoria_padre: number;
        imagen_url: string;
        estado: EstadoGeneral;
        orden: number;
    }>): Promise<{
        orden: number;
        id: number;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        fecha_creacion: Date;
        nombre: string;
        descripcion: string | null;
        imagen_url: string | null;
        categoria_padre: number | null;
    }>;
    eliminar(id: number): Promise<void>;
};
//# sourceMappingURL=categoria.service.d.ts.map