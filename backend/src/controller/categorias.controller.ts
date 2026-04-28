/**
 * CategoriasController - Recibe request, valida con DTO, delega al service
 */

import { Request, Response } from 'express';
import { categoriaService } from '../services/categoria.service';
import { asyncHandler } from '../middlewares/error.middleware';
import { createCategoriaSchema, updateCategoriaSchema } from '../dto/categorias.dto';
import { EstadoGeneral } from '@prisma/client';
import { z } from 'zod';

const reorderSchema = z.object({
  items: z.array(z.object({
    id:    z.number().int().positive(),
    orden: z.number().int().min(0),
  })).min(1),
});

export const getAll = asyncHandler(async (req: Request, res: Response) => {
  const estado = req.query.estado as EstadoGeneral | undefined;
  const categorias = await categoriaService.listar(estado, req.grupoId);
  res.json({ success: true, data: categorias });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const categoria = await categoriaService.obtenerPorId(Number(req.params.id));
  res.json({ success: true, data: categoria });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = createCategoriaSchema.parse(req.body);
  // req.grupoId viene del tenant middleware; assertGrupoId en el service valida en runtime
  const categoria = await categoriaService.crear({ ...data, id_grupo: req.grupoId as number });
  res.status(201).json({ success: true, data: categoria, message: 'Categoría creada correctamente' });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const data = updateCategoriaSchema.parse(req.body);
  const categoria = await categoriaService.actualizar(Number(req.params.id), data);
  res.json({ success: true, data: categoria, message: 'Categoría actualizada correctamente' });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await categoriaService.eliminar(Number(req.params.id));
  res.status(204).send();
});

export const reorder = asyncHandler(async (req: Request, res: Response) => {
  const { items } = reorderSchema.parse(req.body);
  await categoriaService.reordenar(items);
  res.json({ success: true, message: 'Orden de categorías actualizado correctamente' });
});
