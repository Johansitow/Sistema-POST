/**
 * ConfiguracionService
 *
 * Gestiona la configuración dinámica del sistema.
 * Solo superadmin (o permiso config.sistema) puede editar.
 *
 * Incluye también gestión de permisos: qué permisos puede
 * otorgar un superadmin a otros roles/usuarios.
 */
export declare const configuracionService: {
    listar(categoria?: string): Promise<{
        valor_parseado: unknown;
        categoria: string;
        id: number;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        descripcion: string | null;
        clave: string;
        valor: string;
        tipo_dato: import(".prisma/client").$Enums.TipoDato;
        es_editable: boolean;
    }[]>;
    obtenerPorClave(clave: string): Promise<{
        valor_parseado: unknown;
        categoria: string;
        id: number;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        descripcion: string | null;
        clave: string;
        valor: string;
        tipo_dato: import(".prisma/client").$Enums.TipoDato;
        es_editable: boolean;
    }>;
    /** Shortcut para leer un valor ya parseado directo */
    getValor<T = unknown>(clave: string): Promise<T>;
    actualizar(clave: string, valor: string): Promise<{
        categoria: string;
        id: number;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        descripcion: string | null;
        clave: string;
        valor: string;
        tipo_dato: import(".prisma/client").$Enums.TipoDato;
        es_editable: boolean;
    }>;
    actualizarVarias(items: {
        clave: string;
        valor: string;
    }[]): Promise<{
        categoria: string;
        id: number;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        descripcion: string | null;
        clave: string;
        valor: string;
        tipo_dato: import(".prisma/client").$Enums.TipoDato;
        es_editable: boolean;
    }[]>;
    _validarTipo(valor: string, tipo: string): void;
    /** Lista todos los permisos disponibles en el sistema */
    listarPermisos(): Promise<{
        id: number;
        fecha_creacion: Date;
        nombre: string;
        descripcion: string | null;
        es_sistema: boolean;
        codigo: string;
        modulo: string;
    }[]>;
    /** Lista permisos asignados a un rol */
    listarPermisosRol(id_rol: number): Promise<{
        id: number;
        fecha_creacion: Date;
        nombre: string;
        descripcion: string | null;
        es_sistema: boolean;
        codigo: string;
        modulo: string;
    }[]>;
    /** Asigna un permiso a un rol (solo superadmin puede llamar esto) */
    asignarPermiso(id_rol: number, id_permiso: number): Promise<{
        id: number;
        id_rol: number;
        id_permiso: number;
        fecha_asignacion: Date;
    }>;
    /** Revoca un permiso de un rol */
    revocarPermiso(id_rol: number, id_permiso: number): Promise<{
        id: number;
        id_rol: number;
        id_permiso: number;
        fecha_asignacion: Date;
    }>;
    /** Reemplaza todos los permisos de un rol en una sola operación */
    sincronizarPermisos(id_rol: number, ids_permisos: number[]): Promise<({
        permisos: ({
            permiso: {
                id: number;
                fecha_creacion: Date;
                nombre: string;
                descripcion: string | null;
                es_sistema: boolean;
                codigo: string;
                modulo: string;
            };
        } & {
            id: number;
            id_rol: number;
            id_permiso: number;
            fecha_asignacion: Date;
        })[];
    } & {
        id: number;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        nombre: string;
        descripcion: string | null;
        es_super_admin: boolean;
        es_sistema: boolean;
        color: string | null;
    }) | null>;
};
//# sourceMappingURL=configuracion.service.d.ts.map