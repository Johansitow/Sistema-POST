/**
 * ConfiguracionRepository
 * Maneja la tabla `configuracion` — clave/valor tipado para ajustes del sistema.
 */
import { TipoDato } from '@prisma/client';
export declare const configuracionRepository: {
    findAll: (categoria?: string) => import(".prisma/client").Prisma.PrismaPromise<{
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
    findByClave: (clave: string) => import(".prisma/client").Prisma.Prisma__ConfiguracionClient<{
        categoria: string;
        id: number;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        descripcion: string | null;
        clave: string;
        valor: string;
        tipo_dato: import(".prisma/client").$Enums.TipoDato;
        es_editable: boolean;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    findByCategoria: (categoria: string) => import(".prisma/client").Prisma.PrismaPromise<{
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
    update: (clave: string, valor: string) => import(".prisma/client").Prisma.Prisma__ConfiguracionClient<{
        categoria: string;
        id: number;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        descripcion: string | null;
        clave: string;
        valor: string;
        tipo_dato: import(".prisma/client").$Enums.TipoDato;
        es_editable: boolean;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    updateMany: (items: {
        clave: string;
        valor: string;
    }[]) => Promise<{
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
    create: (data: {
        clave: string;
        valor: string;
        tipo_dato?: TipoDato;
        descripcion?: string;
        categoria: string;
        es_editable?: boolean;
    }) => import(".prisma/client").Prisma.Prisma__ConfiguracionClient<{
        categoria: string;
        id: number;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        descripcion: string | null;
        clave: string;
        valor: string;
        tipo_dato: import(".prisma/client").$Enums.TipoDato;
        es_editable: boolean;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    parseValor: (config: {
        valor: string;
        tipo_dato: TipoDato;
    }) => unknown;
};
//# sourceMappingURL=configuracion.repository.d.ts.map