/**
 * EstadoController - Recibe requests HTTP para estados y transiciones
 */
import { Request, Response } from 'express';
export declare const estadoController: {
    getAll: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
    getById: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
    update: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
    getTransiciones: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
    addTransicion: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
    deleteTransicion: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
};
//# sourceMappingURL=estado.controller.d.ts.map