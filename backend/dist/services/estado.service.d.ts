/**
 * EstadoService - Lógica de negocio para estados de orden y transiciones
 *
 * La responsabilidad principal es validarTransicion(),
 * que es llamada por orden.service antes de cada cambio de estado.
 * El resto son operaciones de configuración para el superadmin.
 */
export declare const estadoService: {
    listar(): Promise<({
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
    obtenerPorId(id: number): Promise<{
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
    }>;
    actualizar(id: number, data: Partial<{
        nombre: string;
        descripcion: string;
        color: string;
        icono: string;
        orden: number;
        imprime_comanda: boolean;
        permite_edicion: boolean;
    }>): Promise<{
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
    }>;
    /**
     * validarTransicion — núcleo de la validación de flujo de órdenes
     *
     * Lanza BadRequestError si:
     * - El estado destino no existe
     * - La transición desde→hacia no está registrada en BD
     *
     * orden.service llama esto antes de cada updateEstado.
     * Al ser dinámico, el admin puede agregar o quitar transiciones
     * desde el frontend sin tocar código.
     */
    validarTransicion(id_estado_actual: number, id_estado_nuevo: number): Promise<void>;
    listarTransiciones(id_estado: number): Promise<({
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
    agregarTransicion(data: {
        id_estado_desde: number;
        id_estado_hacia: number;
        requiere_permiso?: string;
        puede_ser_automatico?: boolean;
        orden?: number;
    }): Promise<{
        orden: number;
        id: number;
        id_estado_desde: number;
        id_estado_hacia: number;
        requiere_permiso: string | null;
        puede_ser_automatico: boolean;
    }>;
    eliminarTransicion(id: number): Promise<{
        orden: number;
        id: number;
        id_estado_desde: number;
        id_estado_hacia: number;
        requiere_permiso: string | null;
        puede_ser_automatico: boolean;
    }>;
};
//# sourceMappingURL=estado.service.d.ts.map