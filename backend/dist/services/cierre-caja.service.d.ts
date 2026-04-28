/**
 * CierreCajaService
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
            fecha_cierre: Date;
            id_turno: number | null;
            numero_cierre: string;
            monto_inicial: import("@prisma/client/runtime/library").Decimal;
            monto_final: import("@prisma/client/runtime/library").Decimal;
            totales_por_metodo: import("@prisma/client/runtime/library").JsonValue | null;
            total_ventas: import("@prisma/client/runtime/library").Decimal;
            total_efectivo: import("@prisma/client/runtime/library").Decimal;
            diferencia: import("@prisma/client/runtime/library").Decimal;
            justificacion: string | null;
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
        fecha_cierre: Date;
        id_turno: number | null;
        numero_cierre: string;
        monto_inicial: import("@prisma/client/runtime/library").Decimal;
        monto_final: import("@prisma/client/runtime/library").Decimal;
        totales_por_metodo: import("@prisma/client/runtime/library").JsonValue | null;
        total_ventas: import("@prisma/client/runtime/library").Decimal;
        total_efectivo: import("@prisma/client/runtime/library").Decimal;
        diferencia: import("@prisma/client/runtime/library").Decimal;
        justificacion: string | null;
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
        fecha_cierre: Date;
        id_turno: number | null;
        numero_cierre: string;
        monto_inicial: import("@prisma/client/runtime/library").Decimal;
        monto_final: import("@prisma/client/runtime/library").Decimal;
        totales_por_metodo: import("@prisma/client/runtime/library").JsonValue | null;
        total_ventas: import("@prisma/client/runtime/library").Decimal;
        total_efectivo: import("@prisma/client/runtime/library").Decimal;
        diferencia: import("@prisma/client/runtime/library").Decimal;
        justificacion: string | null;
    }>;
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
        fecha_cierre: Date;
        id_turno: number | null;
        numero_cierre: string;
        monto_inicial: import("@prisma/client/runtime/library").Decimal;
        monto_final: import("@prisma/client/runtime/library").Decimal;
        totales_por_metodo: import("@prisma/client/runtime/library").JsonValue | null;
        total_ventas: import("@prisma/client/runtime/library").Decimal;
        total_efectivo: import("@prisma/client/runtime/library").Decimal;
        diferencia: import("@prisma/client/runtime/library").Decimal;
        justificacion: string | null;
    }>;
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
        fecha_cierre: Date;
        id_turno: number | null;
        numero_cierre: string;
        monto_inicial: import("@prisma/client/runtime/library").Decimal;
        monto_final: import("@prisma/client/runtime/library").Decimal;
        totales_por_metodo: import("@prisma/client/runtime/library").JsonValue | null;
        total_ventas: import("@prisma/client/runtime/library").Decimal;
        total_efectivo: import("@prisma/client/runtime/library").Decimal;
        diferencia: import("@prisma/client/runtime/library").Decimal;
        justificacion: string | null;
    }>;
    _calcularTotalesPeriodo(desde: Date, hasta: Date): Promise<{
        totalVentas: number;
        totalEfectivo: number;
        totalesPorMetodo: Record<string, number>;
    }>;
};
//# sourceMappingURL=cierre-caja.service.d.ts.map