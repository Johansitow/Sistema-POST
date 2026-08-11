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

    // URL pública del frontend — base de los enlaces de verificación/reset del correo.
    APP_URL: z.string().url().default('http://localhost:5173'),

    // SMTP (opcional — sin esto el correo se loguea en consola, no rompe el flujo).
    // Para producción: Brevo/Resend/SendGrid/Gmail u otro SMTP.
    SMTP_HOST:   z.string().optional(),
    SMTP_PORT:   z.string().default('587'),
    SMTP_USER:   z.string().optional(),
    SMTP_PASS:   z.string().optional(),
    SMTP_FROM:   z.string().default('Krezco <no-reply@krezco.app>'),
    SMTP_SECURE: z.string().default('false'), // 'true' para puerto 465

    // Captcha Cloudflare Turnstile (opcional — sin secret se omite la verificación).
    TURNSTILE_SECRET_KEY: z.string().optional(),

    // Rate limit dedicado a los endpoints sensibles de auth (registro, reset).
    AUTH_SENSITIVE_RATE_MAX:       z.string().default('5'),
    AUTH_SENSITIVE_RATE_WINDOW_MS: z.string().default('900000'), // 15 min

    // ── Pagos / suscripciones (Wompi) ────────────────────────────────────────
    // `off`   → sin cobro real; el driver noop simula aprobaciones (dev/sin llaves).
    // `wompi` → integración real; requiere las 4 llaves (obligatorias en producción).
    PAGOS_DRIVER:           z.enum(['off', 'wompi']).default('off'),
    WOMPI_BASE_URL:         z.string().url().default('https://sandbox.wompi.co/v1'),
    WOMPI_PUBLIC_KEY:       z.string().optional(),
    WOMPI_PRIVATE_KEY:      z.string().optional(),
    WOMPI_EVENTS_SECRET:    z.string().optional(), // firma de los webhooks (events)
    WOMPI_INTEGRITY_SECRET: z.string().optional(), // firma de integridad al crear transacciones

    // ── Facturación electrónica DIAN ─────────────────────────────────────────
    // `off`    → driver noop (simula CUFE, no emite real). `factus` → proveedor real.
    // Las credenciales del proveedor son POR TENANT (ConfiguracionGrupo cifrado),
    // no aquí; a nivel plataforma solo el toggle, la URL base y la llave de cifrado.
    FACTURACION_DRIVER: z.enum(['off', 'factus']).default('off'),
    FACTUS_BASE_URL:    z.string().url().default('https://api-sandbox.factus.com.co'),
    FE_ENCRYPTION_KEY:  z.string().optional(), // cifra secretos fiscales por tenant
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
    // Con driver Wompi en producción, sus llaves son obligatorias: no arrancar
    // un backend "que cobra" sin credenciales reales.
    if (val.NODE_ENV === 'production' && val.PAGOS_DRIVER === 'wompi') {
      const faltantes = (['WOMPI_PUBLIC_KEY', 'WOMPI_PRIVATE_KEY', 'WOMPI_EVENTS_SECRET', 'WOMPI_INTEGRITY_SECRET'] as const)
        .filter((k) => !val[k]);
      faltantes.forEach((k) => ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [k],
        message: `${k} es obligatorio cuando PAGOS_DRIVER=wompi en producción`,
      }));
    }
    // Con facturación real (Factus) en producción, la llave de cifrado de secretos
    // fiscales por tenant es obligatoria (≥32 chars): sin ella no se pueden guardar
    // ni leer credenciales del proveedor de forma segura.
    if (val.NODE_ENV === 'production' && val.FACTURACION_DRIVER === 'factus') {
      if (!val.FE_ENCRYPTION_KEY || val.FE_ENCRYPTION_KEY.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['FE_ENCRYPTION_KEY'],
          message: 'FE_ENCRYPTION_KEY (≥32 chars) es obligatoria cuando FACTURACION_DRIVER=factus en producción',
        });
      }
    }
  });

export type EnvVars = z.infer<typeof envSchema>;
