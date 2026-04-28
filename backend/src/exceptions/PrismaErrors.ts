/**
 * PrismaErrors - Traduce errores de Prisma a errores HTTP legibles
 */

import { Prisma } from '@prisma/client';
import { AppError } from './AppError';
import { ConflictError, NotFoundError, BadRequestError } from './HttpErrors';

export function handlePrismaError(error: unknown): AppError {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': {
        const fields = (error.meta?.target as string[])?.join(', ') ?? 'campo';
        return new ConflictError(`Ya existe un registro con ese ${fields}`);
      }
      case 'P2025':
        return new NotFoundError('Registro');
      case 'P2003':
        return new BadRequestError('Referencia inválida: el registro relacionado no existe');
      default:
        return new AppError(`Error de base de datos: ${error.code}`, 500);
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError)
    return new BadRequestError('Datos inválidos enviados a la base de datos');

  if (error instanceof AppError) return error;

  return new AppError('Error interno del servidor', 500);
}
