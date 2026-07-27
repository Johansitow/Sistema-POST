/**
 * Schema de validación de variables de entorno (sin efectos secundarios).
 *
 * Se separa de `env.ts` para poder testearlo sin disparar `dotenv.config()`
 * ni `process.exit()`. `env.ts` importa de aquí y sí ejecuta la validación.
 */

import { z } from 'zod';

/**
 * UUID del superadmin usado SOLO en desarrollo/test (coincide con el que crea el seed).
 * En producción, `SUPER_ADMIN_UUID` es obligatorio y no hay valor por defecto.
 */
export const DEV_SUPER_ADMIN_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

export const envSchema = z
  .object({
    // Database
    DATABASE_URL: z.string().url(),

    // Server
    PORT: z.string().default('3000'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    // JWT
    JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
    JWT_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

    // CORS
    CORS_ORIGIN: z.string().default('http://localhost:5173'),

    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
    RATE_LIMIT_MAX_REQUESTS: z.string().default('500'),
    RATE_LIMIT_AUTH_MAX: z.string().default('20'),

    // Logging
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

    // Redis (opcional — el sistema funciona sin Redis)
    REDIS_URL: z.string().default('redis://localhost:6379'),

    // Super Admin Único — UUID fijo del superadmin en DB.
    // En desarrollo/test puede omitirse (se usa DEV_SUPER_ADMIN_UUID).
    // En producción DEBE estar presente y coincidir con Usuario.uuid en DB.
    SUPER_ADMIN_UUID: z.string().uuid('SUPER_ADMIN_UUID debe ser un UUID válido').optional(),
  })
  .superRefine((val, ctx) => {
    // En producción no se permite arrancar sin SUPER_ADMIN_UUID explícito:
    // un default silencioso abriría la puerta a un superadmin conocido.
    if (val.NODE_ENV === 'production' && !val.SUPER_ADMIN_UUID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SUPER_ADMIN_UUID'],
        message: 'SUPER_ADMIN_UUID es obligatorio en producción (sin valor por defecto)',
      });
    }
  });

export type EnvVars = z.infer<typeof envSchema>;
