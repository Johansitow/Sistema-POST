/**
 * Configuración de Logger con Winston
 */

import winston from 'winston';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// En producción los logs van a stdout como JSON estructurado, para que los
// capture el contenedor / orquestador (Docker, PaaS). Escribir a archivos dentro
// de un contenedor es efímero y se pierde al recrearlo.
// En desarrollo se conservan los archivos rotados + consola legible.
const transports: winston.transport[] =
  process.env.NODE_ENV === 'production'
    ? [new winston.transports.Console({ format: logFormat })]
    : [
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 5242880,
          maxFiles: 5,
        }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
          ),
        }),
      ];

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'cocina-oculta-api' },
  transports,
});

export default logger;