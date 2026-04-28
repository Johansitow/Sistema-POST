/**
 * ErrorMiddleware - Maneja todos los errores de la aplicación
 */
import { Request, Response, NextFunction } from 'express';
export declare const errorHandler: (err: unknown, req: Request, res: Response, _next: NextFunction) => Response<any, Record<string, any>>;
export declare const asyncHandler: (fn: Function) => (req: Request, res: Response, next: NextFunction) => Promise<any>;
//# sourceMappingURL=error.middleware.d.ts.map