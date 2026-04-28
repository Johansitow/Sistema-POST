/**
 * UsuariosController - Recibe request, valida con DTO, delega al service
 */
import { Request, Response } from 'express';
export declare const listar: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const obtener: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const crear: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const actualizar: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const cambiarEstado: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const resetPassword: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const asignarRol: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const listarRoles: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const estadisticas: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
//# sourceMappingURL=usuarios.controller.d.ts.map