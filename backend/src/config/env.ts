/**
 * Configuración centralizada de variables de entorno
 */

import dotenv from 'dotenv';
import { z } from 'zod';
import { envSchema, DEV_SUPER_ADMIN_UUID } from './env.schema';

// Cargar variables de entorno
dotenv.config();

// Validar variables de entorno
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Error en variables de entorno:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
};

const env = parseEnv();

// Exportar configuración
export const config = {
  // Database
  database: {
    url: env.DATABASE_URL,
  },
  
  // Server
  server: {
    port: parseInt(env.PORT, 10),
    env: env.NODE_ENV,
    isDevelopment: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
  },
  
  // JWT
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshSecret: env.JWT_REFRESH_SECRET,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },
  
  // CORS
  cors: {
    origin: env.CORS_ORIGIN,
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs:    parseInt(env.RATE_LIMIT_WINDOW_MS, 10),
    maxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS, 10),
    authMax:     parseInt(env.RATE_LIMIT_AUTH_MAX, 10),
  },
  
  // Logging
  logging: {
    level: env.LOG_LEVEL,
  },

  // Super Admin
  superAdmin: {
    // En prod el schema garantiza que SUPER_ADMIN_UUID esté presente;
    // en desarrollo/test se cae al UUID que crea el seed.
    uuid: env.SUPER_ADMIN_UUID ?? DEV_SUPER_ADMIN_UUID,
  },

  // URL pública del frontend (base de los enlaces de correo)
  appUrl: env.APP_URL,

  // SMTP — host vacío = modo consola (fail-open, ver email.service.ts)
  smtp: {
    host:   env.SMTP_HOST,
    port:   parseInt(env.SMTP_PORT, 10),
    user:   env.SMTP_USER,
    pass:   env.SMTP_PASS,
    from:   env.SMTP_FROM,
    secure: env.SMTP_SECURE === 'true',
  },

  // Captcha (Turnstile) — secret vacío = bypass en dev
  turnstile: {
    secretKey: env.TURNSTILE_SECRET_KEY,
  },

  // Rate limit dedicado a endpoints sensibles de auth
  authRateLimit: {
    max:      parseInt(env.AUTH_SENSITIVE_RATE_MAX, 10),
    windowMs: parseInt(env.AUTH_SENSITIVE_RATE_WINDOW_MS, 10),
  },
} as const;

export default config;