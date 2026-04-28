/**
 * permission.middleware.ts
 * Verifica que el usuario autenticado tenga el permiso requerido.
 * Debe usarse siempre después de `authenticate`.
 */
import { Request, Response, NextFunction } from 'express';
export declare const requirePermission: (codigoPermiso: string) => (req: Request, _res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=permission.middleware.d.ts.map