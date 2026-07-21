/**
 * estadoOrden.ts — Resolución del estado final de una orden.
 *
 * Este helper estaba duplicado palabra por palabra en reporte.service.ts y
 * dashboard.service.ts. Al necesitarse una tercera vez (KPIs del empleado) se
 * extrajo aquí para que los tres módulos midan "venta completada" con el mismo
 * criterio: si mañana cambia la definición, cambia en un solo sitio.
 *
 * Nota sobre el sistema DUAL de órdenes: se filtra por `id_estado` (modelo
 * legacy `EstadoOrden`) y no por `estado_global` (modelo nuevo `OrdenSede`),
 * porque es el criterio que ya usan reportes y dashboard. Mezclar ambos daría
 * cifras distintas entre pantallas.
 */

import prisma from '../config/database';

/**
 * Devuelve el id del estado 'ENTREGADA'.
 *
 * Si el estado no existe devuelve 0 — valor centinela deliberado: ninguna orden
 * tiene id_estado 0, así que las consultas devuelven vacío en lugar de romper.
 */
export const getEstadoFinalId = async (): Promise<number> => {
  const estado = await prisma.estadoOrden.findFirst({ where: { codigo: 'ENTREGADA' } });
  return estado?.id ?? 0;
};
