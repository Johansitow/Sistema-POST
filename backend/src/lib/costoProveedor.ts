/**
 * costoProveedor — fuente única del precio de compra de un producto.
 *
 * El costo real de un insumo solo se conoce cuando existe una relación
 * ProveedorProducto con su precio bruto. `Producto.precio_unitario` NO sirve
 * para esto: es un costo del catálogo que nadie alimenta con las compras.
 *
 * Regla: sin ProveedorProducto → no hay precio (null), nunca 0 implícito.
 * Se usa tanto en rentabilidad de recetas como en la lista de compras.
 */

/** Forma mínima que necesita el cálculo — compatible con el select de Prisma. */
export interface PrecioProveedor {
  precio_unitario:        unknown;
  es_proveedor_preferido: boolean;
}

/**
 * Devuelve el precio de compra a usar: el del proveedor preferido si existe,
 * si no el primero de la lista (los repos ya ordenan preferido primero).
 * Devuelve null cuando no hay proveedor asociado o el precio no es utilizable.
 */
export function precioCompra(proveedores?: PrecioProveedor[] | null): number | null {
  if (!proveedores || proveedores.length === 0) return null;

  const elegido = proveedores.find(p => p.es_proveedor_preferido) ?? proveedores[0];
  const precio  = Number(elegido.precio_unitario);

  return Number.isFinite(precio) && precio > 0 ? precio : null;
}

/** Mensaje único para el aviso de insumo sin precio de compra. */
export const MSG_SIN_PRECIO_COMPRA =
  'Sin precio de compra. Asócialo a un proveedor en Proveedores → Asociar producto para calcular la rentabilidad.';
