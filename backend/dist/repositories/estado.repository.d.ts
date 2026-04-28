/**
 * EstadoRepository - Queries Prisma para estados de orden y transiciones
 *
 * Separado del orden.repository porque estados y transiciones
 * son configuración del sistema, no datos de negocio.
 * El admin los gestiona desde el frontend; las órdenes solo los consultan.
 */
export declare const estadoRepository: {
    /**
     * findAll — lista todos los estados con sus transiciones de salida
     * Incluye transiciones para que el frontend pueda construir el flujo visual.
     */
    findAll: () => import(".prisma/client").Prisma.PrismaPromise<({
        transiciones_desde: ({
            estado_hacia: {
                orden: number;
                activo: boolean;
                id: number;
                fecha_creacion: Date;
                nombre: string;
                descripcion: string | null;
                es_sistema: boolean;
                color: string | null;
                codigo: string;
                icono: string | null;
                es_inicial: boolean;
                es_final: boolean;
                permite_edicion: boolean;
                imprime_comanda: boolean;
            };
        } & {
            orden: number;
            id: number;
            id_estado_desde: number;
            id_estado_hacia: number;
            requiere_permiso: string | null;
            puede_ser_automatico: boolean;
        })[];
    } & {
        orden: number;
        activo: boolean;
        id: number;
        fecha_creacion: Date;
        nombre: string;
        descripcion: string | null;
        es_sistema: boolean;
        color: string | null;
        codigo: string;
        icono: string | null;
        es_inicial: boolean;
        es_final: boolean;
        permite_edicion: boolean;
        imprime_comanda: boolean;
    })[]>;
    findById: (id: number) => import(".prisma/client").Prisma.Prisma__EstadoOrdenClient<({
        transiciones_desde: ({
            estado_hacia: {
                orden: number;
                activo: boolean;
                id: number;
                fecha_creacion: Date;
                nombre: string;
                descripcion: string | null;
                es_sistema: boolean;
                color: string | null;
                codigo: string;
                icono: string | null;
                es_inicial: boolean;
                es_final: boolean;
                permite_edicion: boolean;
                imprime_comanda: boolean;
            };
        } & {
            orden: number;
            id: number;
            id_estado_desde: number;
            id_estado_hacia: number;
            requiere_permiso: string | null;
            puede_ser_automatico: boolean;
        })[];
        transiciones_hacia: ({
            estado_desde: {
                orden: number;
                activo: boolean;
                id: number;
                fecha_creacion: Date;
                nombre: string;
                descripcion: string | null;
                es_sistema: boolean;
                color: string | null;
                codigo: string;
                icono: string | null;
                es_inicial: boolean;
                es_final: boolean;
                permite_edicion: boolean;
                imprime_comanda: boolean;
            };
        } & {
            orden: number;
            id: number;
            id_estado_desde: number;
            id_estado_hacia: number;
            requiere_permiso: string | null;
            puede_ser_automatico: boolean;
        })[];
    } & {
        orden: number;
        activo: boolean;
        id: number;
        fecha_creacion: Date;
        nombre: string;
        descripcion: string | null;
        es_sistema: boolean;
        color: string | null;
        codigo: string;
        icono: string | null;
        es_inicial: boolean;
        es_final: boolean;
        permite_edicion: boolean;
        imprime_comanda: boolean;
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    findByCodigo: (codigo: string) => import(".prisma/client").Prisma.Prisma__EstadoOrdenClient<{
        orden: number;
        activo: boolean;
        id: number;
        fecha_creacion: Date;
        nombre: string;
        descripcion: string | null;
        es_sistema: boolean;
        color: string | null;
        codigo: string;
        icono: string | null;
        es_inicial: boolean;
        es_final: boolean;
        permite_edicion: boolean;
        imprime_comanda: boolean;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    /**
     * update — solo permite cambiar campos visuales (nombre, color, icono)
     * Los campos de sistema (es_inicial, es_final, codigo) no se tocan desde aquí.
     */
    update: (id: number, data: Partial<{
        nombre: string;
        descripcion: string;
        color: string;
        icono: string;
        orden: number;
        activo: boolean;
        imprime_comanda: boolean;
        permite_edicion: boolean;
    }>) => import(".prisma/client").Prisma.Prisma__EstadoOrdenClient<{
        orden: number;
        activo: boolean;
        id: number;
        fecha_creacion: Date;
        nombre: string;
        descripcion: string | null;
        es_sistema: boolean;
        color: string | null;
        codigo: string;
        icono: string | null;
        es_inicial: boolean;
        es_final: boolean;
        permite_edicion: boolean;
        imprime_comanda: boolean;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    /**
     * findTransicion — verifica si una transición específica existe
     * Usado por orden.service para validar antes de cambiar estado.
     * Retorna null si la transición no está permitida.
     */
    findTransicion: (id_estado_desde: number, id_estado_hacia: number) => import(".prisma/client").Prisma.Prisma__EstadoTransicionClient<{
        orden: number;
        id: number;
        id_estado_desde: number;
        id_estado_hacia: number;
        requiere_permiso: string | null;
        puede_ser_automatico: boolean;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    findTransicionesByEstado: (id_estado_desde: number) => import(".prisma/client").Prisma.PrismaPromise<({
        estado_hacia: {
            orden: number;
            activo: boolean;
            id: number;
            fecha_creacion: Date;
            nombre: string;
            descripcion: string | null;
            es_sistema: boolean;
            color: string | null;
            codigo: string;
            icono: string | null;
            es_inicial: boolean;
            es_final: boolean;
            permite_edicion: boolean;
            imprime_comanda: boolean;
        };
    } & {
        orden: number;
        id: number;
        id_estado_desde: number;
        id_estado_hacia: number;
        requiere_permiso: string | null;
        puede_ser_automatico: boolean;
    })[]>;
    createTransicion: (data: {
        id_estado_desde: number;
        id_estado_hacia: number;
        requiere_permiso?: string;
        puede_ser_automatico?: boolean;
        orden?: number;
    }) => import(".prisma/client").Prisma.Prisma__EstadoTransicionClient<{
        orden: number;
        id: number;
        id_estado_desde: number;
        id_estado_hacia: number;
        requiere_permiso: string | null;
        puede_ser_automatico: boolean;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    deleteTransicion: (id: number) => import(".prisma/client").Prisma.Prisma__EstadoTransicionClient<{
        orden: number;
        id: number;
        id_estado_desde: number;
        id_estado_hacia: number;
        requiere_permiso: string | null;
        puede_ser_automatico: boolean;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    findTransicionById: (id: number) => import(".prisma/client").Prisma.Prisma__EstadoTransicionClient<({
        estado_hacia: {
            orden: number;
            activo: boolean;
            id: number;
            fecha_creacion: Date;
            nombre: string;
            descripcion: string | null;
            es_sistema: boolean;
            color: string | null;
            codigo: string;
            icono: string | null;
            es_inicial: boolean;
            es_final: boolean;
            permite_edicion: boolean;
            imprime_comanda: boolean;
        };
        estado_desde: {
            orden: number;
            activo: boolean;
            id: number;
            fecha_creacion: Date;
            nombre: string;
            descripcion: string | null;
            es_sistema: boolean;
            color: string | null;
            codigo: string;
            icono: string | null;
            es_inicial: boolean;
            es_final: boolean;
            permite_edicion: boolean;
            imprime_comanda: boolean;
        };
    } & {
        orden: number;
        id: number;
        id_estado_desde: number;
        id_estado_hacia: number;
        requiere_permiso: string | null;
        puede_ser_automatico: boolean;
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
};
//# sourceMappingURL=estado.repository.d.ts.map