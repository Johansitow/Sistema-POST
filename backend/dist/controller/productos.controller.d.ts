/**
 * ProductosController - Recibe request, valida con Zod, delega al service
 */
import { Request, Response } from 'express';
export declare const getAll: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const getById: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const getBySKU: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const create: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const update: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const patch: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const remove: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const updateStock: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const getStockBajo: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
//# sourceMappingURL=productos.controller.d.ts.map