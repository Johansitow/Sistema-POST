/**
 * AuthController - Recibe request, valida con DTO, delega al service
 */
import { Request, Response } from 'express';
export declare const login: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const refreshToken: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const getProfile: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const changePassword: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const logout: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
//# sourceMappingURL=auth.controller.d.ts.map