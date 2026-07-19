/**
 * CreateProductoCommand — Comando para crear un nuevo producto en inventario
 */

import type { ICommand } from '../CommandBus';

export interface CreateProductoData {
  /** Obligatorio — viene de req.grupoId (contexto autenticado), nunca del body del cliente. */
  id_grupo:               number;
  /**
   * Sede donde se registra el producto (req.restauranteId). El catálogo es
   * por sucursal: el producto solo será visible en la sede que lo creó.
   */
  id_restaurante?:        number;
  sku:                    string;
  nombre:                 string;
  descripcion?:           string;
  id_categoria?:          number;
  tipo_materia:           string;
  unidad_medida:          string;
  precio_unitario:        number;
  precio_venta?:          number;
  stock_actual?:          number;
  stock_minimo?:          number;
  stock_maximo?:          number;
  requiere_refrigeracion?: boolean;
  es_vendible?:           boolean;
}

export class CreateProductoCommand implements ICommand {
  readonly commandName = 'CreateProductoCommand';

  constructor(
    public readonly data:      CreateProductoData,
    public readonly usuarioId: number,
  ) {}
}
