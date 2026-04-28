/**
 * AuthMiddleware - Verifica JWT y permisos
 */
import { Request, Response, NextFunction } from 'express';
export interface TokenPayload {
    id: number;
    uuid: string;
    usuario: string;
    email: string;
    rol: {
        id: number;
        nombre: string;
        es_super_admin: boolean;
    };
}
declare global {
    namespace Express {
        interface Request {
            user?: TokenPayload;
        }
    }
}
export declare const authenticate: (req: Request, _res: Response, next: NextFunction) => void;
export declare const requireSuperAdmin: (req: Request, _res: Response, next: NextFunction) => void;
export declare const requireRole: (...roles: string[]) => (req: Request, _res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.middleware.d.ts.map