/**
 * AlertaRepository - Solo queries Prisma para alertas y tipos de alerta
 */
import { PaginationParams } from '../lib/pagination';
export declare const alertaRepository: {
    findTipoAll: () => import(".prisma/client").Prisma.PrismaPromise<{
        activo: boolean;
        id: number;
        fecha_creacion: Date;
        nombre: string;
        descripcion: string | null;
        es_sistema: boolean;
        color: string | null;
        codigo: string;
        icono: string | null;
        prioridad_default: string;
    }[]>;
    findTipoByCodigo: (codigo: string) => import(".prisma/client").Prisma.Prisma__TipoAlertaClient<{
        activo: boolean;
        id: number;
        fecha_creacion: Date;
        nombre: string;
        descripcion: string | null;
        es_sistema: boolean;
        color: string | null;
        codigo: string;
        icono: string | null;
        prioridad_default: string;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    findTipoById: (id: number) => import(".prisma/client").Prisma.Prisma__TipoAlertaClient<{
        activo: boolean;
        id: number;
        fecha_creacion: Date;
        nombre: string;
        descripcion: string | null;
        es_sistema: boolean;
        color: string | null;
        codigo: string;
        icono: string | null;
        prioridad_default: string;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    createTipo: (data: {
        nombre: string;
        codigo: string;
        descripcion?: string;
        icono?: string;
        color?: string;
        prioridad_default?: string;
    }) => import(".prisma/client").Prisma.Prisma__TipoAlertaClient<{
        activo: boolean;
        id: number;
        fecha_creacion: Date;
        nombre: string;
        descripcion: string | null;
        es_sistema: boolean;
        color: string | null;
        codigo: string;
        icono: string | null;
        prioridad_default: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    updateTipo: (id: number, data: Partial<{
        nombre: string;
        descripcion: string;
        icono: string;
        color: string;
        prioridad_default: string;
        activo: boolean;
    }>) => import(".prisma/client").Prisma.Prisma__TipoAlertaClient<{
        activo: boolean;
        id: number;
        fecha_creacion: Date;
        nombre: string;
        descripcion: string | null;
        es_sistema: boolean;
        color: string | null;
        codigo: string;
        icono: string | null;
        prioridad_default: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    findAll: (pagination: PaginationParams, filters: {
        es_leida?: boolean;
        nivel_prioridad?: string;
        id_tipo_alerta?: number;
    }) => Promise<[({
        producto: {
            id: number;
            nombre: string;
            sku: string;
            stock_actual: import("@prisma/client/runtime/library").Decimal;
            stock_minimo: import("@prisma/client/runtime/library").Decimal;
        } | null;
        tipo_alerta: {
            activo: boolean;
            id: number;
            fecha_creacion: Date;
            nombre: string;
            descripcion: string | null;
            es_sistema: boolean;
            color: string | null;
            codigo: string;
            icono: string | null;
            prioridad_default: string;
        };
    } & {
        id: number;
        fecha_creacion: Date;
        id_producto: number | null;
        id_tipo_alerta: number;
        mensaje: string;
        nivel_prioridad: string;
        es_leida: boolean;
        fecha_leida: Date | null;
    })[], number]>;
    countNoLeidas: () => import(".prisma/client").Prisma.PrismaPromise<number>;
    /**
     * findActivaByProductoYTipo — busca una alerta no resuelta para
     * un producto y tipo específico. Evita duplicados al sincronizar.
     */
    findActivaByProductoYTipo: (id_producto: number, id_tipo_alerta: number) => import(".prisma/client").Prisma.Prisma__AlertaClient<{
        id: number;
        fecha_creacion: Date;
        id_producto: number | null;
        id_tipo_alerta: number;
        mensaje: string;
        nivel_prioridad: string;
        es_leida: boolean;
        fecha_leida: Date | null;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    create: (data: {
        id_tipo_alerta: number;
        id_producto?: number;
        mensaje: string;
        nivel_prioridad: string;
    }) => import(".prisma/client").Prisma.Prisma__AlertaClient<{
        id: number;
        fecha_creacion: Date;
        id_producto: number | null;
        id_tipo_alerta: number;
        mensaje: string;
        nivel_prioridad: string;
        es_leida: boolean;
        fecha_leida: Date | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    marcarLeida: (id: number) => import(".prisma/client").Prisma.Prisma__AlertaClient<{
        id: number;
        fecha_creacion: Date;
        id_producto: number | null;
        id_tipo_alerta: number;
        mensaje: string;
        nivel_prioridad: string;
        es_leida: boolean;
        fecha_leida: Date | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    marcarTodasLeidas: () => import(".prisma/client").Prisma.PrismaPromise<import(".prisma/client").Prisma.BatchPayload>;
};
//# sourceMappingURL=alerta.repository.d.ts.map