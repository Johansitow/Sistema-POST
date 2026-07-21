/**
 * DocumentosController — documentos laborales.
 *
 * Emitir y anular son operaciones sensibles: quedan auditadas siempre.
 */

import { Request, Response } from 'express';
import { documentoService } from '../services/documento.service';
import { asyncHandler } from '../middlewares/error.middleware';
import { BadRequestError } from '../exceptions/HttpErrors';
import { registrarAuditoria } from '../repositories/auditoria.repository';
import { emitirDocumentoSchema, anularDocumentoSchema } from '../dto/documentos.dto';

const pid = (val: string | string[]): number => {
  const n = parseInt(Array.isArray(val) ? val[0] : val, 10);
  if (isNaN(n)) throw new BadRequestError('ID inválido');
  return n;
};

const grupoScope = (req: Request): number | undefined =>
  req.esSuperAdmin ? undefined : req.grupoAdminId;

export const listarTipos = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ tipos: documentoService.listarTipos() });
});

export const listarVariables = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ variables: documentoService.listarVariables() });
});

export const previsualizar = asyncHandler(async (req: Request, res: Response) => {
  const { tipo, id_empleado, observaciones } = emitirDocumentoSchema.parse(req.body);
  const usuario = (req as any).user!;

  const resultado = await documentoService.previsualizar(
    tipo, id_empleado,
    { observaciones, firmante: usuario.nombre_completo ?? '' },
    grupoScope(req),
  );
  res.json(resultado);
});

export const emitir = asyncHandler(async (req: Request, res: Response) => {
  const { tipo, id_empleado, observaciones } = emitirDocumentoSchema.parse(req.body);
  const usuario = (req as any).user!;

  const documento = await documentoService.emitir(
    tipo, id_empleado, { observaciones },
    { id: usuario.id, nombre: usuario.nombre_completo ?? '' },
    grupoScope(req),
  );

  registrarAuditoria({
    id_usuario:           usuario.id,
    accion:               'EMITIR_DOCUMENTO',
    modulo:               'personal',
    tabla_afectada:       'documentos_emitidos',
    id_registro_afectado: documento.id,
    datos_nuevos:         {
      tipo, consecutivo: documento.consecutivo, id_empleado,
      codigo: documento.codigo_verificacion,
    },
    ip_address: req.auditContext?.ip,
    user_agent: req.auditContext?.userAgent,
  });

  res.status(201).json({ message: 'Documento emitido correctamente', documento });
});

export const listarPorEmpleado = asyncHandler(async (req: Request, res: Response) => {
  const documentos = await documentoService.listarPorEmpleado(pid(req.params.idEmpleado), grupoScope(req));
  res.json({ documentos });
});

export const obtenerContenido = asyncHandler(async (req: Request, res: Response) => {
  const documento = await documentoService.obtenerContenido(pid(req.params.id), grupoScope(req));
  res.json({ documento });
});

export const anular = asyncHandler(async (req: Request, res: Response) => {
  const { motivo } = anularDocumentoSchema.parse(req.body);
  const id = pid(req.params.id);
  const documento = await documentoService.anular(id, motivo, grupoScope(req));

  registrarAuditoria({
    id_usuario:           (req as any).user!.id,
    accion:               'ANULAR_DOCUMENTO',
    modulo:               'personal',
    tabla_afectada:       'documentos_emitidos',
    id_registro_afectado: id,
    datos_nuevos:         { motivo },
    ip_address: req.auditContext?.ip,
    user_agent: req.auditContext?.userAgent,
  });

  res.json({ message: 'Documento anulado', documento });
});

/**
 * verificar — endpoint PÚBLICO, sin autenticación.
 * Es el destino del QR impreso: un banco o una embajada deben poder
 * comprobar el documento sin tener cuenta en el sistema.
 */
export const verificar = asyncHandler(async (req: Request, res: Response) => {
  const codigo = Array.isArray(req.params.codigo) ? req.params.codigo[0] : req.params.codigo;
  if (!codigo || codigo.length > 32) throw new BadRequestError('Código inválido');
  res.json(await documentoService.verificar(codigo));
});
