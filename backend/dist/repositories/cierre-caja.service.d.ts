/**
 * CierreCajaService
 *
 * Flujo:
 * 1. Superadmin crea turnos con hora_apertura/hora_cierre
 * 2. Al llegar la hora de cierre, el frontend llama a iniciarCierre()
 * 3. El service verifica que no haya órdenes abiertas → si hay, lanza error con la lista
 * 4. Calcula totales del período desde la BD (sistema)
 * 5. El cajero declara cuánto hay físicamente → confirmarCierre()
 * 6. Si hay diferencia > umbral configurable, exige justificación
 * 7. Guarda el cierre en estado completado o con_diferencia
 */
import { EstadoCierre } from '@prisma/client';
export declare const cierreCajaService: {
    listarTurnos(soloActivos?: boolean): Promise<({
        _count: {
            cierres: number;
        };
    } & {
        activo: boolean;
        id: number;
        fecha_creacion: Date;
        nombre: string;
        hora_apertura: string;
        hora_cierre: string;
        dias_semana: import("@prisma/client/runtime/library").JsonValue;
    })[]>;
    obtenerTurno(id: number): Promise<{
        cierres: {
            id: number;
            estado: import(".prisma/client").$Enums.EstadoCierre;
            id_usuario: number;
            observaciones: string | null;
            fecha_apertura: Date;
            id_turno: number | null;
            monto_inicial: import("@prisma/client/runtime/library").Decimal;
            monto_final: import("@prisma/client/runtime/library").Decimal;
            justificacion: string | null;
            fecha_cierre: Date;
            numero_cierre: string;
            totales_por_metodo: import("@prisma/client/runtime/library").JsonValue | null;
            total_ventas: import("@prisma/client/runtime/library").Decimal;
            total_efectivo: import("@prisma/client/runtime/library").Decimal;
            diferencia: import("@prisma/client/runtime/library").Decimal;
        }[];
    } & {
        activo: boolean;
        id: number;
        fecha_creacion: Date;
        nombre: string;
        hora_apertura: string;
        hora_cierre: string;
        dias_semana: import("@prisma/client/runtime/library").JsonValue;
    }>;
    crearTurno(data: {
        nombre: string;
        hora_apertura: string;
        hora_cierre: string;
        dias_semana?: number[];
    }): Promise<{
        activo: boolean;
        id: number;
        fecha_creacion: Date;
        nombre: string;
        hora_apertura: string;
        hora_cierre: string;
        dias_semana: import("@prisma/client/runtime/library").JsonValue;
    }>;
    actualizarTurno(id: number, data: any): Promise<{
        activo: boolean;
        id: number;
        fecha_creacion: Date;
        nombre: string;
        hora_apertura: string;
        hora_cierre: string;
        dias_semana: import("@prisma/client/runtime/library").JsonValue;
    }>;
    eliminarTurno(id: number): Promise<{
        activo: boolean;
        id: number;
        fecha_creacion: Date;
        nombre: string;
        hora_apertura: string;
        hora_cierre: string;
        dias_semana: import("@prisma/client/runtime/library").JsonValue;
    }>;
    listar(params: {
        page?: unknown;
        limit?: unknown;
        fecha_desde?: Date;
        fecha_hasta?: Date;
        id_usuario?: number;
        estado?: EstadoCierre;
    }): Promise<import("../lib/pagination").PaginatedResult<{
        usuario: {
            usuario: string;
            id: number;
            nombre_completo: string;
        };
        turno: {
            activo: boolean;
            id: number;
            fecha_creacion: Date;
            nombre: string;
            hora_apertura: string;
            hora_cierre: string;
            dias_semana: import("@prisma/client/runtime/library").JsonValue;
        } | null;
    } & {
        id: number;
        estado: import(".prisma/client").$Enums.EstadoCierre;
        id_usuario: number;
        observaciones: string | null;
        fecha_apertura: Date;
        id_turno: number | null;
        monto_inicial: import("@prisma/client/runtime/library").Decimal;
        monto_final: import("@prisma/client/runtime/library").Decimal;
        justificacion: string | null;
        fecha_cierre: Date;
        numero_cierre: string;
        totales_por_metodo: import("@prisma/client/runtime/library").JsonValue | null;
        total_ventas: import("@prisma/client/runtime/library").Decimal;
        total_efectivo: import("@prisma/client/runtime/library").Decimal;
        diferencia: import("@prisma/client/runtime/library").Decimal;
    }>>;
    obtenerPorId(id: number): Promise<{
        usuario: {
            usuario: string;
            id: number;
            nombre_completo: string;
        };
        turno: {
            activo: boolean;
            id: number;
            fecha_creacion: Date;
            nombre: string;
            hora_apertura: string;
            hora_cierre: string;
            dias_semana: import("@prisma/client/runtime/library").JsonValue;
        } | null;
    } & {
        id: number;
        estado: import(".prisma/client").$Enums.EstadoCierre;
        id_usuario: number;
        observaciones: string | null;
        fecha_apertura: Date;
        id_turno: number | null;
        monto_inicial: import("@prisma/client/runtime/library").Decimal;
        monto_final: import("@prisma/client/runtime/library").Decimal;
        justificacion: string | null;
        fecha_cierre: Date;
        numero_cierre: string;
        totales_por_metodo: import("@prisma/client/runtime/library").JsonValue | null;
        total_ventas: import("@prisma/client/runtime/library").Decimal;
        total_efectivo: import("@prisma/client/runtime/library").Decimal;
        diferencia: import("@prisma/client/runtime/library").Decimal;
    }>;
    /**
     * iniciarCierre — llama el frontend cuando llega la hora de cierre
     * ó el superadmin lo fuerza manualmente.
     *
     * Verifica órdenes abiertas. Si existen, lanza error con la lista
     * para que el frontend pueda mostrarlas al cajero.
     */
    iniciarCierre(data: {
        id_usuario: number;
        id_turno?: number;
        fecha_apertura: Date;
        monto_inicial: number;
    }): Promise<{
        usuario: {
            usuario: string;
            id: number;
            uuid: string;
            nombre_completo: string;
            email: string;
            telefono: string | null;
            password_hash: string;
            id_rol: number;
            estado: import(".prisma/client").$Enums.EstadoGeneral;
            ultimo_acceso: Date | null;
            fecha_creacion: Date;
            fecha_modificacion: Date;
            creado_por: number | null;
        };
        turno: {
            activo: boolean;
            id: number;
            fecha_creacion: Date;
            nombre: string;
            hora_apertura: string;
            hora_cierre: string;
            dias_semana: import("@prisma/client/runtime/library").JsonValue;
        } | null;
    } & {
        id: number;
        estado: import(".prisma/client").$Enums.EstadoCierre;
        id_usuario: number;
        observaciones: string | null;
        fecha_apertura: Date;
        id_turno: number | null;
        monto_inicial: import("@prisma/client/runtime/library").Decimal;
        monto_final: import("@prisma/client/runtime/library").Decimal;
        justificacion: string | null;
        fecha_cierre: Date;
        numero_cierre: string;
        totales_por_metodo: import("@prisma/client/runtime/library").JsonValue | null;
        total_ventas: import("@prisma/client/runtime/library").Decimal;
        total_efectivo: import("@prisma/client/runtime/library").Decimal;
        diferencia: import("@prisma/client/runtime/library").Decimal;
    }>;
    /**
     * confirmarCierre — el cajero declara cuánto hay físicamente
     * Si |diferencia| > umbral configurable → justificacion es obligatoria
     */
    confirmarCierre(id: number, data: {
        monto_final: number;
        justificacion?: string;
        observaciones?: string;
    }): Promise<{
        id: number;
        estado: import(".prisma/client").$Enums.EstadoCierre;
        id_usuario: number;
        observaciones: string | null;
        fecha_apertura: Date;
        id_turno: number | null;
        monto_inicial: import("@prisma/client/runtime/library").Decimal;
        monto_final: import("@prisma/client/runtime/library").Decimal;
        justificacion: string | null;
        fecha_cierre: Date;
        numero_cierre: string;
        totales_por_metodo: import("@prisma/client/runtime/library").JsonValue | null;
        total_ventas: import("@prisma/client/runtime/library").Decimal;
        total_efectivo: import("@prisma/client/runtime/library").Decimal;
        diferencia: import("@prisma/client/runtime/library").Decimal;
    }>;
    _calcularTotalesPeriodo(desde: Date, hasta: Date): Promise<{
        totalVentas: number;
        totalEfectivo: number;
        totalesPorMetodo: Record<string, number>;
    }>;
};
//# sourceMappingURL=cierre-caja.service.d.ts.map