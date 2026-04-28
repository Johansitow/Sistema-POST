/**
 * Configuración de conexión a la base de datos
 */

import { PrismaClient } from '@prisma/client';

/**
 * Obtiene la URL de conexión a la base de datos
 */
function getDatabaseUrl(): string {
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
  return new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
    log: ['query', 'error', 'warn'],
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

export default prisma;

// =============================================================================
// Multi-DB Client Factory — SaaS-ready
// =============================================================================

/**
 * Pool de clientes Prisma por tenant.
 * Clave: `grupo:{id}` → PrismaClient de su DB propia (enterprise)
 *        `shared`     → el cliente global (starter / professional)
 */
const clientPool = new Map<string, PrismaClient>();

/**
 * getClientForTenant — retorna el PrismaClient correcto para un grupo.
 *
 * Lógica:
 *   - Si GrupoNegocio.db_connection_url está definida → cliente de su propia DB
 *   - Si no → cliente global compartido
 *
 * El pool garantiza que se crea UN SOLO cliente por tenant (no uno por request).
 * En el futuro, reemplazar la consulta de metadata con un caché Redis para evitar
 * un query a la DB global en cada request.
 *
 * Uso:
 *   const db = await getClientForTenant(req.grupoId);
 *   const ordenes = await db.orden.findMany(...);
 */
export async function getClientForTenant(idGrupo: number): Promise<PrismaClient> {
  const cacheKey = `grupo:${idGrupo}`;
  if (clientPool.has(cacheKey)) return clientPool.get(cacheKey)!;

  // Consulta de metadata del grupo (usa el cliente global — no es dato de negocio)
  const grupo = await prisma.grupoNegocio.findUnique({
    where:  { id: idGrupo },
    select: { db_connection_url: true },
  });

  if (grupo?.db_connection_url) {
    // Plan enterprise: DB propia cifrada en el campo del grupo
    const dedicated = new PrismaClient({
      datasources: { db: { url: grupo.db_connection_url } },
      log: process.env.NODE_ENV !== 'production' ? ['error', 'warn'] : ['error'],
    });
    clientPool.set(cacheKey, dedicated);
    return dedicated;
  }

  // Plan starter / professional: DB compartida
  return prisma;
}

/**
 * closeTenantClient — cierra y elimina el cliente de un tenant del pool.
 * Llamar cuando se elimina un grupo o se cambia su db_connection_url.
 */
export async function closeTenantClient(idGrupo: number): Promise<void> {
  const cacheKey = `grupo:${idGrupo}`;
  const client   = clientPool.get(cacheKey);
  if (client && client !== prisma) {
    await client.$disconnect();
    clientPool.delete(cacheKey);
  }
}

/**
 * Función para verificar la conexión a la base de datos
 */
export async function testConnection(): Promise<boolean> {
  try {
    await prisma.$connect();
    console.log('✅ Conexión a la base de datos exitosa');
    return true;
  } catch (error) {
    console.error('❌ Error conectando a la base de datos:', error);
    return false;
  }
}

/**
 * Función para cerrar la conexión
 */
export async function closeConnection(): Promise<void> {
  await prisma.$disconnect();
  console.log('🔌 Conexión a la base de datos cerrada');
}