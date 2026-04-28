/**
 * FacturaController - Recibe requests HTTP para facturas
 */
import { Request, Response } from 'express';
export declare const facturaController: {
    getAll: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
    getById: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
    getByOrden: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
};
//# sourceMappingURL=factura.controller.d.ts.map