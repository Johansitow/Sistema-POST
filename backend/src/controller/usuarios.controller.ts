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

/**
 * Scope multi-tenant del módulo: undefined para superadmin (acceso global),
 * el grupo administrado (req.grupoAdminId de requireAdminAccess) para admins de grupo.
 */
const grupoScope = (req: Request): number | undefined =>
  req.esSuperAdmin ? undefined : req.grupoAdminId;

export const listar = asyncHandler(async (req: Request, res: Response) => {
  const result = await usuarioService.listar({
    page:   qs(req.query.page),
    limit:  qs(req.query.limit),
    search: qs(req.query.search),
    estado: qs(req.query.estado) as EstadoGeneral | undefined,
    id_rol: qs(req.query.id_rol) ? parseInt(qs(req.query.id_rol)!, 10) : undefined,
  }, grupoScope(req));
  res.json(result);
});

export const obtener = asyncHandler(async (req: Request, res: Response) => {
  const usuario = await usuarioService.obtenerPorId(pid(req.params.id), grupoScope(req));
  res.json({ usuario });
});

export const crear = asyncHandler(async (req: Request, res: Response) => {
  const data    = createUsuarioSchema.parse(req.body);
  const usuario = await usuarioService.crear(data, (req as any).user!.id, grupoScope(req));
  res.status(201).json({ message: 'Usuario creado correctamente', usuario });
});

export const actualizar = asyncHandler(async (req: Request, res: Response) => {
  const data    = updateUsuarioSchema.parse(req.body);
  const usuario = await usuarioService.actualizar(pid(req.params.id), data, grupoScope(req));
  res.json({ message: 'Usuario actualizado correctamente', usuario });
});

export const cambiarEstado = asyncHandler(async (req: Request, res: Response) => {
  const { estado } = cambiarEstadoSchema.parse(req.body);
  const result = await usuarioService.cambiarEstado(
    pid(req.params.id),
    estado as EstadoGeneral,
    (req as any).user!.id,  // solicitanteId
    grupoScope(req)
  );
  res.json(result);
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { newPassword } = resetPasswordSchema.parse(req.body);
  const result = await usuarioService.resetPassword(pid(req.params.id), newPassword, grupoScope(req));
  res.json(result);
});

export const asignarRol = asyncHandler(async (req: Request, res: Response) => {
  const { id_rol } = asignarRolSchema.parse(req.body);
  const result = await usuarioService.asignarRol(
    pid(req.params.id),
    id_rol,
    (req as any).user!.id,  // solicitanteId — necesario para los guards de superadmin
    grupoScope(req)
  );
  res.json(result);
});

export const listarRoles = asyncHandler(async (req: Request, res: Response) => {
  const roles = await usuarioService.listarRoles(grupoScope(req));
  res.json({ roles });
});

export const estadisticas = asyncHandler(async (req: Request, res: Response) => {
  const stats = await usuarioService.estadisticas(grupoScope(req));
  res.json({ stats });
});

// ── Permisos directos (UsuarioPermiso) — rutas solo superadmin ───────────────

export const listarAdminsDeGrupo = asyncHandler(async (_req: Request, res: Response) => {
  const admins = await usuarioService.listarAdminsDeGrupo();
  res.json({ admins });
});

export const listarPermisosDirectos = asyncHandler(async (req: Request, res: Response) => {
  const permisos = await usuarioService.listarPermisosDirectos(pid(req.params.id));
  res.json({ permisos });
});

export const sincronizarPermisosDirectos = asyncHandler(async (req: Request, res: Response) => {
  const { ids_permisos } = req.body;
  if (!Array.isArray(ids_permisos) || ids_permisos.some(x => typeof x !== 'number')) {
    throw new BadRequestError('ids_permisos debe ser un array de números');
  }
  const permisos = await usuarioService.sincronizarPermisosDirectos(pid(req.params.id), ids_permisos);
  res.json({ message: 'Permisos del administrador actualizados', permisos });
});

export const getNomina = asyncHandler(async (req: Request, res: Response) => {
  const nomina = await usuarioService.getNomina(pid(req.params.id), grupoScope(req));
  res.json({ nomina });
});

export const upsertNomina = asyncHandler(async (req: Request, res: Response) => {
  const data   = nominaSchema.parse(req.body);
  const nomina = await usuarioService.upsertNomina(
    pid(req.params.id),
    grupoScope(req),
    data,
    (req as any).user!.id,   // queda registrado quién cambió el salario
  );
  res.json({ message: 'Nómina guardada correctamente', nomina });
});

export const obtenerResumen = asyncHandler(async (req: Request, res: Response) => {
  const dias = qs(req.query.dias) ? parseInt(qs(req.query.dias)!, 10) : undefined;
  if (dias !== undefined && (isNaN(dias) || dias < 1 || dias > 365)) {
    throw new BadRequestError('El periodo debe estar entre 1 y 365 días');
  }
  const resumen = await usuarioService.obtenerResumen(pid(req.params.id), grupoScope(req), dias);
  res.json({ resumen });
});

export const listarHistorialSalarios = asyncHandler(async (req: Request, res: Response) => {
  const historial = await usuarioService.listarHistorialSalarios(pid(req.params.id), grupoScope(req));
  res.json({ historial });
});