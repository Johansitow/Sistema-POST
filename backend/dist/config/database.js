"use strict";
/**
 * Configuración de conexión a la base de datos
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.testConnection = testConnection;
exports.closeConnection = closeConnection;
const client_1 = require("@prisma/client");
/**
 * Obtiene la URL de conexión a la base de datos
 */
function getDatabaseUrl() {
    const url = process.env.DATABASE_URL;
    if (!url) {
        throw new Error('DATABASE_URL no está definida en las variables de entorno');
    }
    return url;
}
/**
 * Singleton de Prisma Client
 */
const prismaClientSingleton = () => {
    return new client_1.PrismaClient({
        datasources: {
            db: {
                url: getDatabaseUrl(),
            },
        },
        log: ['query', 'error', 'warn'],
    });
};
const prisma = globalThis.prisma ?? prismaClientSingleton();
if (process.env.NODE_ENV !== 'production') {
    globalThis.prisma = prisma;
}
exports.default = prisma;
/**
 * Función para verificar la conexión a la base de datos
 */
async function testConnection() {
    try {
        await prisma.$connect();
        console.log('✅ Conexión a la base de datos exitosa');
        return true;
    }
    catch (error) {
        console.error('❌ Error conectando a la base de datos:', error);
        return false;
    }
}
/**
 * Función para cerrar la conexión
 */
async function closeConnection() {
    await prisma.$disconnect();
    console.log('🔌 Conexión a la base de datos cerrada');
}
//# sourceMappingURL=database.js.map