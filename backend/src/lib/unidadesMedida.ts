/**
 * Conversión de unidades de medida (peso/volumen) y costeo seguro entre
 * unidad de ingrediente y unidad del producto.
 */

/** Convierte una cantidad a la unidad base del grupo (gramo o mililitro) */
export function toBase(qty: number, unit: string): { value: number; base: string } {
  switch (unit.toLowerCase()) {
    case 'kilogramo': return { value: qty * 1000, base: 'gramo' };
    case 'gramo':     return { value: qty,        base: 'gramo' };
    case 'litro':     return { value: qty * 1000, base: 'mililitro' };
    case 'mililitro': return { value: qty,        base: 'mililitro' };
    default:          return { value: qty,        base: unit.toLowerCase() };
  }
}

/** ¿El stock disponible cubre la cantidad necesaria teniendo en cuenta las unidades? */
export function tieneStock(stockActual: number, stockUnit: string, cantNecesaria: number, needUnit: string): boolean {
  const stock  = toBase(stockActual, stockUnit);
  const needed = toBase(cantNecesaria, needUnit);
  if (stock.base === needed.base) return stock.value >= needed.value;
  return stockActual >= cantNecesaria; // bases distintas: comparación directa como fallback
}

/** Convierte qty de fromUnit a toUnit (dentro del mismo grupo de medida) */
export function convertUnits(qty: number, fromUnit: string, toUnit: string): number {
  const from = toBase(qty, fromUnit);
  const one  = toBase(1, toUnit);
  if (from.base !== one.base || one.value === 0) return qty; // no convertible → sin cambio
  return from.value / one.value;
}

/**
 * Calcula el costo de un ingrediente convirtiendo su cantidad a la unidad en la
 * que está expresado el precio del producto (`precioUnitario`).
 *
 * Si `unidadIngrediente` y `unidadProducto` no son convertibles entre sí (bases
 * distintas de `toBase`, ej. peso vs conteo) NO se calcula un número — se marca
 * `incompatible: true` para que el caller reporte una alerta en vez de un costo
 * silenciosamente erróneo.
 */
export function costoConvertido(
  cantidad: number,
  unidadIngrediente: string,
  unidadProducto: string,
  precioUnitario: number,
): { costo: number | null; incompatible: boolean } {
  const cant = toBase(cantidad, unidadIngrediente);
  const uno  = toBase(1, unidadProducto);

  if (cant.base !== uno.base) {
    return { costo: null, incompatible: true };
  }

  const cantidadEnUnidadProducto = uno.value !== 0 ? cant.value / uno.value : cantidad;
  return { costo: cantidadEnUnidadProducto * precioUnitario, incompatible: false };
}
