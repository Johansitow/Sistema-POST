/**
 * OrdenesController - Recibe request, valida con Zod, delega al service
 */
import { Request, Response } from 'express';
export declare const getAll: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const getById: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const create: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const update: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const updateEstado: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const remove: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const addDetalle: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const updateDetalle: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const removeDetalle: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const getEstadisticas: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
//# sourceMappingURL=ordenes.controller.d.ts.map