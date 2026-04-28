/**
 * UsuarioService - Lógica de negocio para usuarios y roles
 *
 * Restricción de superadmin único — se aplica en 4 puntos:
 *
 * 1. crear()        → si el rol asignado es superadmin, verifica que no haya
 *                     otro usuario activo con ese rol
 * 2. cambiarEstado() → no se puede desactivar al único usuario superadmin activo
 * 3. asignarRol()   → valida en ambas direcciones:
 *                     - si el rol nuevo es superadmin: no puede haber otro
 *                     - si se le quita el rol superadmin: debe quedar otro activo
 * 4. crearRol() /
 *    actualizarRol() → solo puede existir 1 rol con es_super_admin = true
 */
import { EstadoGeneral } from '@prisma/client';
export declare const usuarioService: {
    listar(params: {
        page?: unknown;
        limit?: unknown;
        search?: string;
        estado?: EstadoGeneral;
        id_rol?: number;
    }): Promise<import("../lib/pagination").PaginatedResult<{
        rol: {
            id: number;
            nombre: string;
            descripcion: string | null;
            es_super_admin: boolean;
            color: string | null;
        };
        usuario: string;
        id: number;
        uuid: string;
        nombre_completo: string;
        email: string;
        telefono: string | null;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        ultimo_acceso: Date | null;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        creador: {
            usuario: string;
            id: number;
            nombre_completo: string;
        } | null;
    }>>;
    obtenerPorId(id: number): Promise<{
        rol: {
            id: number;
            nombre: string;
            descripcion: string | null;
            es_super_admin: boolean;
            color: string | null;
        };
        usuario: string;
        id: number;
        uuid: string;
        nombre_completo: string;
        email: string;
        telefono: string | null;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        ultimo_acceso: Date | null;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        creador: {
            usuario: string;
            id: number;
            nombre_completo: string;
        } | null;
    }>;
    crear(data: {
        nombre_completo: string;
        email: string;
        usuario: string;
        password: string;
        telefono?: string;
        id_rol: number;
    }, creadoPorId: number): Promise<{
        rol: {
            id: number;
            nombre: string;
            descripcion: string | null;
            es_super_admin: boolean;
            color: string | null;
        };
        usuario: string;
        id: number;
        uuid: string;
        nombre_completo: string;
        email: string;
        telefono: string | null;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        ultimo_acceso: Date | null;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        creador: {
            usuario: string;
            id: number;
            nombre_completo: string;
        } | null;
    }>;
    actualizar(id: number, data: Partial<{
        nombre_completo: string;
        email: string;
        telefono: string;
        id_rol: number;
    }>): Promise<{
        rol: {
            id: number;
            nombre: string;
            descripcion: string | null;
            es_super_admin: boolean;
            color: string | null;
        };
        usuario: string;
        id: number;
        uuid: string;
        nombre_completo: string;
        email: string;
        telefono: string | null;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        ultimo_acceso: Date | null;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        creador: {
            usuario: string;
            id: number;
            nombre_completo: string;
        } | null;
    } | {
        message: string;
        usuario: {
            rol: {
                id: number;
                nombre: string;
                descripcion: string | null;
                es_super_admin: boolean;
                color: string | null;
            };
            usuario: string;
            id: number;
            uuid: string;
            nombre_completo: string;
            email: string;
            telefono: string | null;
            estado: import(".prisma/client").$Enums.EstadoGeneral;
            ultimo_acceso: Date | null;
            fecha_creacion: Date;
            fecha_modificacion: Date;
            creador: {
                usuario: string;
                id: number;
                nombre_completo: string;
            } | null;
        };
    }>;
    /**
     * cambiarEstado — no permite desactivar al único superadmin activo.
     * @param solicitanteId — ID del usuario que hace la petición (de req.user)
     */
    cambiarEstado(id: number, estado: EstadoGeneral, solicitanteId: number): Promise<{
        message: string;
        usuario: {
            rol: {
                id: number;
                nombre: string;
                descripcion: string | null;
                es_super_admin: boolean;
                color: string | null;
            };
            usuario: string;
            id: number;
            uuid: string;
            nombre_completo: string;
            email: string;
            telefono: string | null;
            estado: import(".prisma/client").$Enums.EstadoGeneral;
            ultimo_acceso: Date | null;
            fecha_creacion: Date;
            fecha_modificacion: Date;
            creador: {
                usuario: string;
                id: number;
                nombre_completo: string;
            } | null;
        };
    }>;
    resetPassword(id: number, newPassword: string): Promise<{
        message: string;
    }>;
    /**
     * asignarRol — valida las dos direcciones del cambio de rol superadmin.
     * @param solicitanteId — ID del usuario que hace la petición
     *
     * Caso A — nuevo rol ES superadmin:
     *   verifica que no haya otro usuario activo con ese rol
     *
     * Caso B — nuevo rol NO ES superadmin, pero el usuario actual SÍ lo era:
     *   verifica que quede al menos otro usuario activo con el rol superadmin
     */
    asignarRol(id: number, id_rol: number, solicitanteId: number): Promise<{
        message: string;
        usuario: {
            rol: {
                id: number;
                nombre: string;
                descripcion: string | null;
                es_super_admin: boolean;
                color: string | null;
            };
            usuario: string;
            id: number;
            uuid: string;
            nombre_completo: string;
            email: string;
            telefono: string | null;
            estado: import(".prisma/client").$Enums.EstadoGeneral;
            ultimo_acceso: Date | null;
            fecha_creacion: Date;
            fecha_modificacion: Date;
            creador: {
                usuario: string;
                id: number;
                nombre_completo: string;
            } | null;
        };
    }>;
    listarRoles(): Promise<{
        id: number;
        _count: {
            usuarios: number;
        };
        nombre: string;
        descripcion: string | null;
        es_super_admin: boolean;
        color: string | null;
    }[]>;
    estadisticas(): Promise<{
        total: number;
        activos: number;
        inactivos: number;
    }>;
    /**
     * crearRol — garantiza que no se cree un segundo rol superadmin.
     */
    crearRol(data: {
        nombre: string;
        descripcion?: string;
        es_super_admin: boolean;
        color?: string;
    }): Promise<{
        id: number;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        nombre: string;
        descripcion: string | null;
        es_super_admin: boolean;
        es_sistema: boolean;
        color: string | null;
    }>;
    /**
     * actualizarRol — tres guards de superadmin:
     * 1. No crear un segundo rol superadmin
     * 2. No quitar es_super_admin al único rol superadmin
     * 3. No desactivar el rol superadmin
     */
    actualizarRol(id: number, data: Partial<{
        nombre: string;
        descripcion: string;
        es_super_admin: boolean;
        color: string;
        estado: EstadoGeneral;
    }>): Promise<{
        id: number;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        nombre: string;
        descripcion: string | null;
        es_super_admin: boolean;
        es_sistema: boolean;
        color: string | null;
    }>;
};
//# sourceMappingURL=usuario.service.d.ts.map