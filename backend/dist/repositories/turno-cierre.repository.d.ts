/**
 * TurnoCajaRepository + CierreCajaRepository
 */
import { Prisma, EstadoCierre } from '@prisma/client';
export declare const turnoCajaRepository: {
    findAll: (soloActivos?: boolean) => Prisma.PrismaPromise<({
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
        dias_semana: Prisma.JsonValue;
    })[]>;
    findById: (id: number) => Prisma.Prisma__TurnoCajaClient<({
        cierres: {
            id: number;
            estado: import(".prisma/client").$Enums.EstadoCierre;
            id_usuario: number;
            observaciones: string | null;
            fecha_apertura: Date;
            fecha_cierre: Date;
            id_turno: number | null;
            numero_cierre: string;
            monto_inicial: Prisma.Decimal;
            monto_final: Prisma.Decimal;
            totales_por_metodo: Prisma.JsonValue | null;
            total_ventas: Prisma.Decimal;
            total_efectivo: Prisma.Decimal;
            diferencia: Prisma.Decimal;
            justificacion: string | null;
        }[];
    } & {
        activo: boolean;
        id: number;
        fecha_creacion: Date;
        nombre: string;
        hora_apertura: string;
        hora_cierre: string;
        dias_semana: Prisma.JsonValue;
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    create: (data: {
        nombre: string;
        hora_apertura: string;
        hora_cierre: string;
        dias_semana?: number[];
    }) => Prisma.Prisma__TurnoCajaClient<{
        activo: boolean;
        id: number;
        fecha_creacion: Date;
        nombre: string;
        hora_apertura: string;
        hora_cierre: string;
        dias_semana: Prisma.JsonValue;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    update: (id: number, data: Partial<{
        nombre: string;
        hora_apertura: string;
        hora_cierre: string;
        dias_semana: number[];
        activo: boolean;
    }>) => Prisma.Prisma__TurnoCajaClient<{
        activo: boolean;
        id: number;
        fecha_creacion: Date;
        nombre: string;
        hora_apertura: string;
        hora_cierre: string;
        dias_semana: Prisma.JsonValue;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    delete: (id: number) => Prisma.Prisma__TurnoCajaClient<{
        activo: boolean;
        id: number;
        fecha_creacion: Date;
        nombre: string;
        hora_apertura: string;
        hora_cierre: string;
        dias_semana: Prisma.JsonValue;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
};
export declare const cierreCajaRepository: {
    findAll: (params: {
        skip: number;
        take: number;
        fecha_desde?: Date;
        fecha_hasta?: Date;
        id_usuario?: number;
        estado?: EstadoCierre;
    }) => Promise<[({
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
            dias_semana: Prisma.JsonValue;
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
        monto_inicial: Prisma.Decimal;
        monto_final: Prisma.Decimal;
        totales_por_metodo: Prisma.JsonValue | null;
        total_ventas: Prisma.Decimal;
        total_efectivo: Prisma.Decimal;
        diferencia: Prisma.Decimal;
        justificacion: string | null;
    })[], number]>;
    findById: (id: number) => Prisma.Prisma__CierreCajaClient<({
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
            dias_semana: Prisma.JsonValue;
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
        monto_inicial: Prisma.Decimal;
        monto_final: Prisma.Decimal;
        totales_por_metodo: Prisma.JsonValue | null;
        total_ventas: Prisma.Decimal;
        total_efectivo: Prisma.Decimal;
        diferencia: Prisma.Decimal;
        justificacion: string | null;
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    findByNumeroCierre: (numero: string) => Prisma.Prisma__CierreCajaClient<{
        id: number;
        estado: import(".prisma/client").$Enums.EstadoCierre;
        id_usuario: number;
        observaciones: string | null;
        fecha_apertura: Date;
        fecha_cierre: Date;
        id_turno: number | null;
        numero_cierre: string;
        monto_inicial: Prisma.Decimal;
        monto_final: Prisma.Decimal;
        totales_por_metodo: Prisma.JsonValue | null;
        total_ventas: Prisma.Decimal;
        total_efectivo: Prisma.Decimal;
        diferencia: Prisma.Decimal;
        justificacion: string | null;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    findUltimo: () => Prisma.Prisma__CierreCajaClient<{
        id: number;
        estado: import(".prisma/client").$Enums.EstadoCierre;
        id_usuario: number;
        observaciones: string | null;
        fecha_apertura: Date;
        fecha_cierre: Date;
        id_turno: number | null;
        numero_cierre: string;
        monto_inicial: Prisma.Decimal;
        monto_final: Prisma.Decimal;
        totales_por_metodo: Prisma.JsonValue | null;
        total_ventas: Prisma.Decimal;
        total_efectivo: Prisma.Decimal;
        diferencia: Prisma.Decimal;
        justificacion: string | null;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    create: (data: {
        id_usuario: number;
        id_turno?: number;
        numero_cierre: string;
        fecha_apertura: Date;
        monto_inicial: number;
        monto_final: number;
        totales_por_metodo?: Record<string, number>;
        total_ventas: number;
        total_efectivo: number;
        diferencia: number;
        justificacion?: string;
        estado: EstadoCierre;
        observaciones?: string;
    }) => Prisma.Prisma__CierreCajaClient<{
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
            dias_semana: Prisma.JsonValue;
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
        monto_inicial: Prisma.Decimal;
        monto_final: Prisma.Decimal;
        totales_por_metodo: Prisma.JsonValue | null;
        total_ventas: Prisma.Decimal;
        total_efectivo: Prisma.Decimal;
        diferencia: Prisma.Decimal;
        justificacion: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    update: (id: number, data: Partial<{
        monto_final: number;
        diferencia: number;
        justificacion: string;
        estado: EstadoCierre;
        observaciones: string;
        totales_por_metodo: Record<string, number>;
    }>) => Prisma.Prisma__CierreCajaClient<{
        id: number;
        estado: import(".prisma/client").$Enums.EstadoCierre;
        id_usuario: number;
        observaciones: string | null;
        fecha_apertura: Date;
        fecha_cierre: Date;
        id_turno: number | null;
        numero_cierre: string;
        monto_inicial: Prisma.Decimal;
        monto_final: Prisma.Decimal;
        totales_por_metodo: Prisma.JsonValue | null;
        total_ventas: Prisma.Decimal;
        total_efectivo: Prisma.Decimal;
        diferencia: Prisma.Decimal;
        justificacion: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
};
//# sourceMappingURL=turno-cierre.repository.d.ts.map