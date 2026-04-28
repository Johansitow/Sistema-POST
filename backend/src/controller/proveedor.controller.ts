/**
 * ProveedorController - Recibe requests HTTP para proveedores
 */

import { Request, Response } from 'express';
import { proveedorService } from '../services/proveedor.service';
import { asyncHandler } from '../middlewares/error.middleware';
import { EstadoGeneral } from '@prisma/client';

export const proveedorController = {

  getAll: asyncHandler(async (req: Request, res: Response) => {
    const result = await proveedorService.listar({
      page:     req.query.page,
      limit:    req.query.limit,
      search:   req.query.search as string,
      estado:   req.query.estado as EstadoGeneral,
      id_grupo: req.grupoId,
    });
    res.json({ success: true, ...result });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const proveedor = await proveedorService.obtenerPorId(Number(req.params.id));
    res.json({ success: true, data: proveedor });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const proveedor = await proveedorService.crear({ ...req.body, id_grupo: req.grupoId! });
    res.status(201).json({ success: true, data: proveedor, message: 'Proveedor creado correctamente' });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const proveedor = await proveedorService.actualizar(Number(req.params.id), req.body);
    res.json({ success: true, data: proveedor, message: 'Proveedor actualizado correctamente' });
  }),

  cambiarEstado: asyncHandler(async (req: Request, res: Response) => {
    const { estado } = req.body;
    const proveedor = await proveedorService.cambiarEstado(Number(req.params.id), estado);
    res.json({ success: true, data: proveedor, message: `Proveedor ${estado} correctamente` });
  }),

  // ─── Productos del proveedor ─────────────────────────────────────────────────

  getProductos: asyncHandler(async (req: Request, res: Response) => {
    const productos = await proveedorService.listarProductos(Number(req.params.id));
    res.json({ success: true, data: productos });
  }),

  asociarProducto: asyncHandler(async (req: Request, res: Response) => {
    const relacion = await proveedorService.asociarProducto(Number(req.params.id), req.body);
    res.status(201).json({ success: true, data: relacion, message: 'Producto asociado correctamente' });
  }),

  actualizarRelacion: asyncHandler(async (req: Request, res: Response) => {
    const relacion = await proveedorService.actualizarRelacion(
      Number(req.params.id),
      Number(req.params.productoId),
      req.body
    );
    res.json({ success: true, data: relacion, message: 'Relación actualizada correctamente' });
  }),

  desasociarProducto: asyncHandler(async (req: Request, res: Response) => {
    await proveedorService.desasociarProducto(
      Number(req.params.id),
      Number(req.params.productoId)
    );
    res.json({ success: true, message: 'Producto desasociado correctamente' });
  }),
};
