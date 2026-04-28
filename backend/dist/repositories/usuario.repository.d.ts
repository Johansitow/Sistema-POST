/**
 * UsuarioRepository - Queries Prisma para el módulo de usuarios
 *
 * Dos selectores principales:
 * - selectPublico: campos seguros para devolver al frontend (sin password_hash)
 * - findByCredencial: usa include completo porque necesita password_hash para bcrypt
 */
import { EstadoGeneral } from '@prisma/client';
import { PaginationParams } from '../lib/pagination';
export declare const usuarioRepository: {
    findAll: (pagination: PaginationParams, filters: {
        search?: string;
        estado?: EstadoGeneral;
        id_rol?: number;
    }) => Promise<[{
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
    }[], number]>;
    findById: (id: number) => import(".prisma/client").Prisma.Prisma__UsuarioClient<{
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
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    findByCredencial: (credencial: string) => import(".prisma/client").Prisma.Prisma__UsuarioClient<({
        rol: {
            id: number;
            nombre: string;
            es_super_admin: boolean;
            color: string | null;
        };
    } & {
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
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    findByEmail: (email: string, excludeId?: number) => import(".prisma/client").Prisma.Prisma__UsuarioClient<{
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
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    findByUsuario: (usuario: string) => import(".prisma/client").Prisma.Prisma__UsuarioClient<{
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
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    /**
     * findSuperAdminRol — devuelve el rol con es_super_admin = true si existe.
     * @param excludeRolId — excluye este rol de la búsqueda (útil en actualizarRol
     *   para no chocar el rol superadmin consigo mismo al editarlo).
     */
    findSuperAdminRol: (excludeRolId?: number) => import(".prisma/client").Prisma.Prisma__RolClient<{
        id: number;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        nombre: string;
        descripcion: string | null;
        es_super_admin: boolean;
        es_sistema: boolean;
        color: string | null;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    /**
     * findUsuarioActivoConRol — busca el primer usuario activo con el rol dado,
     * opcionalmente excluyendo un usuario específico.
     * Usado para verificar que no quede el sistema sin superadmin.
     */
    findUsuarioActivoConRol: (id_rol: number, excludeUsuarioId?: number) => import(".prisma/client").Prisma.Prisma__UsuarioClient<{
        usuario: string;
        id: number;
        nombre_completo: string;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    create: (data: {
        nombre_completo: string;
        email: string;
        usuario: string;
        password_hash: string;
        telefono?: string;
        id_rol: number;
        creado_por?: number;
    }) => import(".prisma/client").Prisma.Prisma__UsuarioClient<{
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
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    update: (id: number, data: Partial<{
        nombre_completo: string;
        email: string;
        telefono: string;
        id_rol: number;
        estado: EstadoGeneral;
        password_hash: string;
        ultimo_acceso: Date;
    }>) => import(".prisma/client").Prisma.Prisma__UsuarioClient<{
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
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    count: () => import(".prisma/client").Prisma.PrismaPromise<number>;
    countByEstado: (estado: EstadoGeneral) => import(".prisma/client").Prisma.PrismaPromise<number>;
    findRoles: () => import(".prisma/client").Prisma.PrismaPromise<{
        id: number;
        _count: {
            usuarios: number;
        };
        nombre: string;
        descripcion: string | null;
        es_super_admin: boolean;
        color: string | null;
    }[]>;
    findRolById: (id: number) => import(".prisma/client").Prisma.Prisma__RolClient<{
        id: number;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        nombre: string;
        descripcion: string | null;
        es_super_admin: boolean;
        es_sistema: boolean;
        color: string | null;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    /** createRol / updateRol — gestión de roles, llamados desde usuarioService */
    createRol: (data: {
        nombre: string;
        descripcion?: string;
        es_super_admin: boolean;
        color?: string;
    }) => import(".prisma/client").Prisma.Prisma__RolClient<{
        id: number;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        nombre: string;
        descripcion: string | null;
        es_super_admin: boolean;
        es_sistema: boolean;
        color: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    updateRol: (id: number, data: Partial<{
        nombre: string;
        descripcion: string;
        es_super_admin: boolean;
        color: string;
        estado: EstadoGeneral;
    }>) => import(".prisma/client").Prisma.Prisma__RolClient<{
        id: number;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        nombre: string;
        descripcion: string | null;
        es_super_admin: boolean;
        es_sistema: boolean;
        color: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
};
//# sourceMappingURL=usuario.repository.d.ts.map