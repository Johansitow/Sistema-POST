/**
 * ListaComprasController
 */

import { Request, Response, NextFunction } from 'express';
import { listaComprasService } from '../services/lista-compras.service';
import { successResponse }     from '../lib/response';
import { EstadoListaCompras }  from '@prisma/client';

export const listaComprasController = {

  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, estado, id_proveedor, desde, hasta, id_restaurante } = req.query as Record<string, string>;
      const result = await listaComprasService.listar({
        page, limit,
        estado:         estado         as EstadoListaCompras | undefined,
        id_proveedor:   id_proveedor   ? Number(id_proveedor)   : undefined,
        desde:          desde          ? new Date(desde)         : undefined,
        hasta:          hasta          ? new Date(hasta)         : undefined,
        id_restaurante: req.restauranteId ?? (id_restaurante ? Number(id_restaurante) : undefined),
      });
      res.json({ success: true, ...result });
    } catch (e) { next(e); }
  },

  async obtener(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await listaComprasService.obtenerPorId(Number(req.params.id));
      res.json(successResponse(data));
    } catch (e) { next(e); }
  },

  async generar(req: Request, res: Response, next: NextFunction) {
    try {
      const idUsuario = (req as any).user?.id;
      if (!idUsuario) { res.status(401).json({ error: 'No autenticado' }); return; }
      // assertRestauranteId lanza ForbiddenError si llega undefined (tenant middleware no activo)
      const result = await listaComprasService.generarAutomatico(idUsuario, {
        ...req.body,
        id_restaurante: (req.restauranteId ?? req.body?.id_restaurante) as number,
      });
      res.status(201).json(successResponse(result, result.mensaje ?? 'Lista de compras generada'));
    } catch (e) { next(e); }
  },

  async cambiarEstado(req: Request, res: Response, next: NextFunction) {
    try {
      const { estado, notas, fecha_envio, fecha_recepcion } = req.body;
      const data = await listaComprasService.cambiarEstado(Number(req.params.id), {
        estado,
        notas,
        fecha_envio:     fecha_envio    ? new Date(fecha_envio)    : undefined,
        fecha_recepcion: fecha_recepcion ? new Date(fecha_recepcion) : undefined,
      });
      res.json(successResponse(data, 'Estado actualizado'));
    } catch (e) { next(e); }
  },

  async actualizarItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { cantidad_recibida, observaciones } = req.body;
      const data = await listaComprasService.actualizarItem(
        Number(req.params.id),
        Number(req.params.id_item),
        { cantidad_recibida: Number(cantidad_recibida), observaciones }
      );
      res.json(successResponse(data, 'Item actualizado'));
    } catch (e) { next(e); }
  },
};
