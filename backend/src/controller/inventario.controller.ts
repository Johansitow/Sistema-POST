/**
 * InventarioController — despacha via CQRS
 *
 * getMovimientos        → QueryBus  (GetMovimientosQuery)
 * registrarMovimiento   → CommandBus (RegistrarMovimientoCommand)
 * El resto llama al service directamente (migración gradual).
 */

import { Request, Response } from 'express';
import { TipoMovimiento } from '@prisma/client';
import { inventarioService } from '../services/inventario.service';
import { asyncHandler } from '../middlewares/error.middleware';
import { registrarMovimientoSchema } from '../dto/inventario.dto';
import { commandBus } from '../application/commands/CommandBus';
import { queryBus }   from '../application/queries/QueryBus';
import { GetMovimientosQuery }        from '../application/queries/inventario/GetMovimientosQuery';
import { RegistrarMovimientoCommand } from '../application/commands/inventario/RegistrarMovimientoCommand';

const qs = (val: unknown): string | undefined => Array.isArray(val) ? val[0] : val as string | undefined;

export const getMovimientos = asyncHandler(async (req: Request, res: Response) => {
  const result = await queryBus.execute(new GetMovimientosQuery({
    page:           req.query.page        ? Number(req.query.page)        : undefined,
    limit:          req.query.limit       ? Number(req.query.limit)       : undefined,
    id_producto:    req.query.id_producto ? Number(req.query.id_producto) : undefined,
    tipo:           qs(req.query.tipo) as TipoMovimiento | undefined,
    fecha_desde:    req.query.fecha_desde ? new Date(qs(req.query.fecha_desde)!) : undefined,
    fecha_hasta:    req.query.fecha_hasta ? new Date(qs(req.query.fecha_hasta)!) : undefined,
    id_restaurante: req.restauranteId!,
  })) as any;
  res.json({ success: true, ...result });
});

export const registrarMovimiento = asyncHandler(async (req: Request, res: Response) => {
  const data = registrarMovimientoSchema.parse(req.body);
  const movimiento = await commandBus.dispatch(new RegistrarMovimientoCommand(
    {
      ...data,
      fecha_vencimiento: data.fecha_vencimiento ? new Date(data.fecha_vencimiento) : undefined,
      id_restaurante:    req.restauranteId!,
    } as any,
    req.user!.id,
  )) as any;
  res.status(201).json({ success: true, data: movimiento, message: 'Movimiento registrado correctamente' });
});

export const getEstadisticas = asyncHandler(async (req: Request, res: Response) => {
  const dias = req.query.dias ? Number(req.query.dias) : 30;
  const stats = await inventarioService.estadisticasMovimientos(req.restauranteId!, dias);
  res.json({ success: true, data: stats });
});

export const getLotesVencimiento = asyncHandler(async (req: Request, res: Response) => {
  const dias = req.query.dias ? Number(req.query.dias) : 30;
  const lotes = await inventarioService.lotesProximosVencer(dias, req.restauranteId);
  res.json({ success: true, data: lotes });
});

export const getValorInventario = asyncHandler(async (req: Request, res: Response) => {
  const valor = await inventarioService.valorInventario(req.restauranteId);
  res.json({ success: true, data: valor });
});

export const getLotes = asyncHandler(async (req: Request, res: Response) => {
  const result = await inventarioService.listarLotes({
    page:           req.query.page,
    limit:          req.query.limit,
    id_producto:    req.query.id_producto    ? Number(req.query.id_producto)           : undefined,
    estado_lote:    qs(req.query.estado_lote) as any,
    vence_antes_de: req.query.vence_antes_de ? new Date(qs(req.query.vence_antes_de)!) : undefined,
    id_restaurante: req.restauranteId ?? (req.query.id_restaurante ? Number(req.query.id_restaurante) : undefined),
  });
  res.json({ success: true, ...result });
});
