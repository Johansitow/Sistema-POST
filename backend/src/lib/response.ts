/**
 * response.ts - Helper para respuestas HTTP estandarizadas
 */

export const successResponse = <T>(data: T, message?: string) => ({
  success: true,
  ...(message && { message }),
  data,
});
