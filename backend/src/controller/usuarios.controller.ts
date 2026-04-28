/**
 * UsuariosController - Recibe request, valida con DTO, delega al service
 */

import { Request, Response } from 'express';
import { EstadoGeneral } from '@prisma/client';
import { usuarioService } from '../services/usuario.service';
import { asyncHandler } from '../middlewares/error.middleware';
import { BadRequestError } from '../exceptions/HttpErrors';
import {
  createUsuarioSchema,
  updateUsuarioSchema,
  nominaSchema,
  cambiarEstadoSchema,
  resetPasswordSchema,
  asignarRolSchema,
} from '../dto/usuarios.dto';

const qs  = (val: unknown): string | undefined => Array.isArray(val) ? val[0] : val as string | undefined;
const pid = (val: string | string[]): number => {
  const n = parseInt(Array.isArray(val) ? val[0] : val, 10);
  if (isNaN(n)) throw new BadRequestError('ID inválido');
  return n;
};

export const listar = asyncHandler(async (req: Request, res: Response) => {
  const result = await usuarioService.listar({
    page:   qs(req.query.page),
    limit:  qs(req.query.limit),
    search: qs(req.query.search),
    estado: qs(req.query.estado) as EstadoGeneral | undefined,
    id_rol: qs(req.query.id_rol) ? parseInt(qs(req.query.id_rol)!, 10) : undefined,
  });
  res.json(result);
});

export const obtener = asyncHandler(async (req: Request, res: Response) => {
  const usuario = await usuarioService.obtenerPorId(pid(req.params.id));
  res.json({ usuario });
});

export const crear = asyncHandler(async (req: Request, res: Response) => {
  const data    = createUsuarioSchema.parse(req.body);
  const usuario = await usuarioService.crear(data, (req as any).user!.id);
  res.status(201).json({ message: 'Usuario creado correctamente', usuario });
});

export const actualizar = asyncHandler(async (req: Request, res: Response) => {
  const data    = updateUsuarioSchema.parse(req.body);
  const usuario = await usuarioService.actualizar(pid(req.params.id), data);
  res.json({ message: 'Usuario actualizado correctamente', usuario });
});

export const cambiarEstado = asyncHandler(async (req: Request, res: Response) => {
  const { estado } = cambiarEstadoSchema.parse(req.body);
  const result = await usuarioService.cambiarEstado(
    pid(req.params.id),
    estado as EstadoGeneral,
    (req as any).user!.id   // solicitanteId
  );
  res.json(result);
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { newPassword } = resetPasswordSchema.parse(req.body);
  const result = await usuarioService.resetPassword(pid(req.params.id), newPassword);
  res.json(result);
});

export const asignarRol = asyncHandler(async (req: Request, res: Response) => {
  const { id_rol } = asignarRolSchema.parse(req.body);
  const result = await usuarioService.asignarRol(
    pid(req.params.id),
    id_rol,
    (req as any).user!.id   // solicitanteId — necesario para los guards de superadmin
  );
  res.json(result);
});

export const listarRoles = asyncHandler(async (_req: Request, res: Response) => {
  const roles = await usuarioService.listarRoles();
  res.json({ roles });
});

export const estadisticas = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await usuarioService.estadisticas();
  res.json({ stats });
});

export const getNomina = asyncHandler(async (req: Request, res: Response) => {
  const nomina = await usuarioService.getNomina(pid(req.params.id));
  res.json({ nomina });
});

export const upsertNomina = asyncHandler(async (req: Request, res: Response) => {
  const data   = nominaSchema.parse(req.body);
  const nomina = await usuarioService.upsertNomina(pid(req.params.id), data);
  res.json({ message: 'Nómina guardada correctamente', nomina });
});