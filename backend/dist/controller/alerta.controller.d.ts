/**
 * AlertaController - Recibe requests HTTP para alertas
 */
import { Request, Response } from 'express';
export declare const alertaController: {
    getTipos: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
    createTipo: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
    updateTipo: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
    getAll: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
    /**
     * getCountNoLeidas — endpoint liviano para el badge del Layout
     * El frontend lo llama al cargar y cada N segundos para el badge de notificaciones.
     */
    getCountNoLeidas: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
    marcarLeida: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
    marcarTodasLeidas: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
    sincronizar: (req: Request, res: Response, next: import("express").NextFunction) => Promise<any>;
};
//# sourceMappingURL=alerta.controller.d.ts.map