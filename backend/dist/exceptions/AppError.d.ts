/**
 * AppError - Clase base para todos los errores de la aplicación
 */
export declare class AppError extends Error {
    statusCode: number;
    isOperational: boolean;
    constructor(message: string, statusCode?: number);
}
//# sourceMappingURL=AppError.d.ts.map