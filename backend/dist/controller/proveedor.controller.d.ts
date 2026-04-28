/**
 * ProveedorController - Recibe requests HTTP para proveedores
 */
import { Request, Response } from 'express';
export declare const proveedorController: {
    getAll: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
    getById: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
    create: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
    update: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
    cambiarEstado: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
    getProductos: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
    asociarProducto: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
    actualizarRelacion: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
    desasociarProducto: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
};
//# sourceMappingURL=proveedor.controller.d.ts.map