/**
 * ProductosController — despacha via CQRS
 *
 * getAll   → QueryBus   (GetProductosQuery)
 * create   → CommandBus (CreateProductoCommand)
 * update   → CommandBus (UpdateProductoCommand)
 * El resto llama al service directamente (migración gradual).
 */

import { Request, Response } from 'express';
import { productoService } from '../services/producto.service';
import { createProductoSchema, updateProductoSchema, updateStockSchema } from '../dto/productos.dto';
import { asyncHandler } from '../middlewares/error.middleware';
import { registrarAuditoria } from '../repositories/auditoria.repository';
import { socketGateway } from '../config/socket.gateway';
import { commandBus } from '../application/commands/CommandBus';
import { queryBus }   from '../application/queries/QueryBus';
import { GetProductosQuery }      from '../application/queries/producto/GetProductosQuery';
import { CreateProductoCommand }  from '../application/commands/producto/CreateProductoCommand';
import { UpdateProductoCommand }  from '../application/commands/producto/UpdateProductoCommand';

const qs = (val: unknown): string | undefined => Array.isArray(val) ? val[0] : val as string | undefined;

export const getAll = asyncHandler(async (req: Request, res: Response) => {
  const result = await queryBus.execute(new GetProductosQuery({
    page:        req.query.page      ? Number(req.query.page)    : undefined,
    limit:       req.query.limit     ? Number(req.query.limit)   : undefined,
    search:      qs(req.query.search),
    categoria:   req.query.categoria ? Number(req.query.categoria) : undefined,
    estado:      qs(req.query.estado),
    es_vendible: req.query.es_vendible !== undefined ? req.query.es_vendible === 'true' : undefined,
    id_grupo:    req.grupoId,
  })) as any;
  res.json({ success: true, ...result });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const producto = await productoService.obtenerPorId(Number(req.params.id));
  res.json({ success: true, data: producto });
});

export const getBySKU = asyncHandler(async (req: Request, res: Response) => {
  const sku = Array.isArray(req.params.sku) ? req.params.sku[0] : req.params.sku;
  const producto = await productoService.obtenerPorSKU(sku);
  res.json({ success: true, data: producto });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = createProductoSchema.parse(req.body);
  // id_grupo viene del contexto autenticado (req.grupoId), nunca del body del cliente.
  // Mismo patrón que categorias.controller y proveedor.controller.
  const producto = await commandBus.dispatch(
    new CreateProductoCommand({ ...data, id_grupo: req.grupoId! }, (req as any).user?.id),
  ) as any;

  registrarAuditoria({
    id_usuario:            (req as any).user?.id,
    accion:                'CREAR_PRODUCTO',
    modulo:                'productos',
    tabla_afectada:        'productos',
    id_registro_afectado:  producto.id,
    datos_nuevos:          producto,
    ip_address:            req.auditContext?.ip,
    user_agent:            req.auditContext?.userAgent,
  });

  res.status(201).json({ success: true, data: producto, message: 'Producto creado correctamente' });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const data = updateProductoSchema.parse(req.body);
  const producto = await commandBus.dispatch(
    new UpdateProductoCommand(Number(req.params.id), data as any, (req as any).user?.id),
  ) as any;

  registrarAuditoria({
    id_usuario:            (req as any).user?.id,
    accion:                'ACTUALIZAR_PRODUCTO',
    modulo:                'productos',
    tabla_afectada:        'productos',
    id_registro_afectado:  producto.id,
    datos_nuevos:          data,
    ip_address:            req.auditContext?.ip,
    user_agent:            req.auditContext?.userAgent,
  });

  res.json({ success: true, data: producto, message: 'Producto actualizado correctamente' });
});

export const patch = asyncHandler(async (req: Request, res: Response) => {
  const data = updateProductoSchema.partial().parse(req.body);
  const producto = await productoService.actualizar(Number(req.params.id), data);
  res.json({ success: true, data: producto, message: 'Producto actualizado correctamente' });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await productoService.eliminar(id);

  registrarAuditoria({
    id_usuario:            (req as any).user?.id,
    accion:                'ELIMINAR_PRODUCTO',
    modulo:                'productos',
    tabla_afectada:        'productos',
    id_registro_afectado:  id,
    ip_address:            req.auditContext?.ip,
    user_agent:            req.auditContext?.userAgent,
  });

  res.status(204).send();
});

export const updateStock = asyncHandler(async (req: Request, res: Response) => {
  const { cantidad, tipo } = updateStockSchema.parse(req.body);
  const producto = await productoService.actualizarStock(Number(req.params.id), cantidad, tipo, req.restauranteId!);

  if (producto) {
    const stockActual = Number(producto.stock_actual);
    const stockMinimo = Number(producto.stock_minimo);
    if (stockActual <= stockMinimo) {
      socketGateway.emitStockBajo({
        id_producto:  producto.id,
        nombre:       producto.nombre,
        stock_actual: stockActual,
        stock_minimo: stockMinimo,
      });
    }
  }

  res.json({ success: true, data: producto, message: 'Stock actualizado correctamente' });
});

export const getStockBajo = asyncHandler(async (_req: Request, res: Response) => {
  const productos = await productoService.stockBajo();
  res.json({ success: true, data: productos });
});
