/**
 * ErrorMiddleware - Maneja todos los errores de la aplicación
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../exceptions/AppError';
import { handlePrismaError } from '../exceptions/PrismaErrors';
import logger from '../config/logger';

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error('Error capturado:', {
    message: (err as Error).message,
    stack:   (err as Error).stack,
    url:     req.url,
    method:  req.method,
  });

  // Error de validación Zod
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: 'Error de validación',
      details: err.errors.map(e => ({ campo: e.path.join('.'), mensaje: e.message })),
    });
  }

  // Errores de Prisma → traducir a AppError
  const appError = err instanceof AppError ? err : handlePrismaError(err);

  return res.status(appError.statusCode).json({
    error: appError.message,
    ...(process.env.NODE_ENV === 'development' && { stack: appError.stack }),
  });
};

// Wrapper para capturar errores asíncronos sin try/catch en cada handler
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);
