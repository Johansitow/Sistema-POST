/**
 * ReportesController - Recibe request, delega al service
 */
import { Request, Response } from 'express';
export declare const getVentas: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const getProductosMasVendidos: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const getVentasPorCategoria: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const getMetodosPago: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const getVentasPorHora: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
export declare const getReporteCompleto: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
//# sourceMappingURL=reportes.controller.d.ts.map