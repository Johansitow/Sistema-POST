/**
 * AuditoriaRepository - Solo queries Prisma para auditoría
 */
import { PaginationParams } from '../lib/pagination';
export declare const auditoriaRepository: {
    findAll: (pagination: PaginationParams, filters: {
        id_usuario?: number;
        modulo?: string;
        accion?: string;
        fecha_desde?: Date;
        fecha_hasta?: Date;
    }) => Promise<[({
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
    })[], number]>;
    create: (data: {
        id_usuario?: number;
        accion: string;
        modulo: string;
        tabla_afectada?: string;
        id_registro_afectado?: number;
        datos_anteriores?: any;
        datos_nuevos?: any;
        ip_address?: string;
        user_agent?: string;
    }) => import(".prisma/client").Prisma.Prisma__AuditoriaClient<{
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
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
};
/**
 * registrarAuditoria — helper que llaman los services para registrar acciones
 *
 * Es fire-and-forget: no lanza errores al caller si falla.
 * La auditoría nunca debe interrumpir el flujo de negocio.
 *
 * Uso en un service:
 *   await registrarAuditoria({
 *     id_usuario: req.user.id,
 *     accion: 'CREAR_PRODUCTO',
 *     modulo: 'inventario',
 *     tabla_afectada: 'productos',
 *     id_registro_afectado: producto.id,
 *     datos_nuevos: producto,
 *     ip_address: req.ip,
 *   });
 */
export declare const registrarAuditoria: (data: {
    id_usuario?: number;
    accion: string;
    modulo: string;
    tabla_afectada?: string;
    id_registro_afectado?: number;
    datos_anteriores?: any;
    datos_nuevos?: any;
    ip_address?: string;
    user_agent?: string;
}) => Promise<void>;
//# sourceMappingURL=auditoria.repository.d.ts.map