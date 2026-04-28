/**
 * Configuración de conexión a la base de datos
 */
import { PrismaClient } from '@prisma/client';
/**
 * Singleton de Prisma Client
 */
declare const prismaClientSingleton: () => PrismaClient<{
    datasources: {
        db: {
            url: string;
        };
    };
    log: ("error" | "warn" | "query")[];
}, never, import("@prisma/client/runtime/library").DefaultArgs>;
declare global {
    var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}
declare const prisma: PrismaClient<{
    datasources: {
        db: {
            url: string;
        };
    };
    log: ("error" | "warn" | "query")[];
}, never, import("@prisma/client/runtime/library").DefaultArgs>;
export default prisma;
/**
 * Función para verificar la conexión a la base de datos
 */
export declare function testConnection(): Promise<boolean>;
/**
 * Función para cerrar la conexión
 */
export declare function closeConnection(): Promise<void>;
//# sourceMappingURL=database.d.ts.map