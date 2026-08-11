/**
 * FacturacionController — emisión de FE a solicitud, consulta y config DIAN.
 * El grupo/tenant se toma de req (ctx / grupoAdminId), nunca del cliente.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middlewares/error.middleware';
import { facturaElectronicaService } from '../services/facturaElectronica.service';
import { buildTenantCtx } from '../lib/tenantCtx';
import { BadRequestError } from '../exceptions/HttpErrors';

const adquirienteSchema = z.object({
  tipo_documento:   z.string().min(1),
  numero_documento: z.string().min(1),
  nombre:           z.string().min(1),
  email:            z.string().email().optional(),
  telefono:         z.string().optional(),
  direccion:        z.string().optional(),
});

const configSchema = z.object({
  razon_social:       z.string().optional(),
  regimen:            z.string().optional(),
  responsabilidades:  z.string().optional(),
  ambiente:           z.enum(['pruebas', 'produccion']).optional(),
  numbering_range_id: z.number().int().positive().optional(),
  credenciales: z.object({
    clientId:     z.string().min(1),
    clientSecret: z.string().min(1),
    username:     z.string().min(1),
    password:     z.string().min(1),
  }).optional(),
});

export const emitir = asyncHandler(async (req: Request, res: Response) => {
  const idOrden = Number(req.params.idOrden);
  const adquiriente = adquirienteSchema.parse(req.body);
  const data = await facturaElectronicaService.emitirParaOrden(idOrden, buildTenantCtx(req), adquiriente);
  res.status(201).json({ success: true, data });
});

export const obtener = asyncHandler(async (req: Request, res: Response) => {
  const data = await facturaElectronicaService.obtener(Number(req.params.id), buildTenantCtx(req));
  res.json({ success: true, data });
});

export const listar = asyncHandler(async (req: Request, res: Response) => {
  const grupoId = req.grupoId ?? req.user?.grupos_admin?.[0]?.id_grupo;
  if (!grupoId) throw new BadRequestError('No hay un grupo activo en el contexto');
  const data = await facturaElectronicaService.listar(grupoId);
  res.json({ success: true, data });
});

export const getConfig = asyncHandler(async (req: Request, res: Response) => {
  const data = await facturaElectronicaService.getConfig(req.grupoAdminId!);
  res.json({ success: true, data });
});

export const guardarConfig = asyncHandler(async (req: Request, res: Response) => {
  const dto = configSchema.parse(req.body);
  const data = await facturaElectronicaService.guardarConfig(req.grupoAdminId!, dto);
  res.json({ success: true, data, message: 'Configuración de facturación electrónica guardada' });
});
