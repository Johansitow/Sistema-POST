/**
 * ClienteController - Handlers HTTP para el módulo de Clientes
 */

import { Request, Response } from 'express';
import { clienteService } from '../services/cliente.service';
import { asyncHandler } from '../middlewares/error.middleware';
import { EstadoGeneral, TipoCliente } from '@prisma/client';
import {
  createClienteSchema,
  updateClienteSchema,
  cambiarEstadoClienteSchema,
  addDireccionSchema,
  updateDireccionSchema,
  canjearPuntosSchema,
} from '../dto/cliente.dto';

export const clienteController = {

  // ── Listado y estadísticas ────────────────────────────────────────────────

  getAll: asyncHandler(async (req: Request, res: Response) => {
    const result = await clienteService.listar({
      page:         req.query.page,
      limit:        req.query.limit,
      search:       req.query.search as string,
      estado:       req.query.estado as EstadoGeneral,
      tipo_cliente: req.query.tipo_cliente as TipoCliente,
      id_grupo:     req.grupoId,
    });
    res.json({ success: true, ...result });
  }),

  getEstadisticas: asyncHandler(async (_req: Request, res: Response) => {
    const stats = await clienteService.estadisticas();
    res.json({ success: true, ...stats });
  }),

  // ── CRUD ──────────────────────────────────────────────────────────────────

  getById: asyncHandler(async (req: Request, res: Response) => {
    const cliente = await clienteService.obtenerPorId(Number(req.params.id));
    res.json({ success: true, cliente });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const data = createClienteSchema.parse(req.body);
    const cliente = await clienteService.crear(data);
    res.status(201).json({ success: true, cliente, message: 'Cliente creado correctamente' });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const data = updateClienteSchema.parse(req.body);
    const cliente = await clienteService.actualizar(Number(req.params.id), data);
    res.json({ success: true, cliente, message: 'Cliente actualizado correctamente' });
  }),

  cambiarEstado: asyncHandler(async (req: Request, res: Response) => {
    const { estado } = cambiarEstadoClienteSchema.parse(req.body);
    const cliente = await clienteService.cambiarEstado(Number(req.params.id), estado);
    res.json({ success: true, cliente, message: `Cliente ${estado} correctamente` });
  }),

  // ── Órdenes ───────────────────────────────────────────────────────────────

  getOrdenes: asyncHandler(async (req: Request, res: Response) => {
    const result = await clienteService.getOrdenes(Number(req.params.id), {
      page:  req.query.page,
      limit: req.query.limit,
    });
    res.json({ success: true, ...result });
  }),

  // ── Direcciones ───────────────────────────────────────────────────────────

  getDirecciones: asyncHandler(async (req: Request, res: Response) => {
    const direcciones = await clienteService.getDirecciones(Number(req.params.id));
    res.json({ success: true, direcciones });
  }),

  addDireccion: asyncHandler(async (req: Request, res: Response) => {
    const data = addDireccionSchema.parse(req.body);
    const direccion = await clienteService.addDireccion(Number(req.params.id), data);
    res.status(201).json({ success: true, direccion, message: 'Dirección agregada correctamente' });
  }),

  updateDireccion: asyncHandler(async (req: Request, res: Response) => {
    const data = updateDireccionSchema.parse(req.body);
    const direccion = await clienteService.updateDireccion(
      Number(req.params.id),
      Number(req.params.id_dir),
      data
    );
    res.json({ success: true, direccion, message: 'Dirección actualizada correctamente' });
  }),

  deleteDireccion: asyncHandler(async (req: Request, res: Response) => {
    await clienteService.deleteDireccion(
      Number(req.params.id),
      Number(req.params.id_dir)
    );
    res.json({ success: true, message: 'Dirección eliminada correctamente' });
  }),

  // ── Puntos de lealtad ─────────────────────────────────────────────────────

  getPuntos: asyncHandler(async (req: Request, res: Response) => {
    const result = await clienteService.getPuntos(Number(req.params.id), {
      page:  req.query.page,
      limit: req.query.limit,
    });
    res.json({ success: true, ...result });
  }),

  canjearPuntos: asyncHandler(async (req: Request, res: Response) => {
    const { puntos, descripcion } = canjearPuntosSchema.parse(req.body);
    const result = await clienteService.canjearPuntos(Number(req.params.id), puntos, descripcion);
    res.json({ success: true, ...result, message: 'Puntos canjeados correctamente' });
  }),
};
