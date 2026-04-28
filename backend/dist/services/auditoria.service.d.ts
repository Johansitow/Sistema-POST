/**
 * AuditoriaService - Solo lectura del historial de auditoría
 * La escritura se hace directamente con registrarAuditoria() desde cada service.
 */
export declare const auditoriaService: {
    listar(params: {
        page?: unknown;
        limit?: unknown;
        id_usuario?: number;
        modulo?: string;
        accion?: string;
        fecha_desde?: Date;
        fecha_hasta?: Date;
    }): Promise<import("../lib/pagination").PaginatedResult<{
        usuario: {
            usuario: string;
            id: number;
            nombre_completo: string;
        } | null;
    } & {
        id: bigint;
        id_usuario: number | null;
        accion: string;
        modulo: string;
        tabla_afectada: string | null;
        id_registro_afectado: number | null;
        datos_anteriores: import("@prisma/client/runtime/library").JsonValue | null;
        datos_nuevos: import("@prisma/client/runtime/library").JsonValue | null;
        ip_address: string | null;
        user_agent: string | null;
        fecha_hora: Date;
    }>>;
};
//# sourceMappingURL=auditoria.service.d.ts.map