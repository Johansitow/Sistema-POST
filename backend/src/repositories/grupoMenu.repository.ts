/**
 * GrupoMenuRepository
 * Maneja las tablas `grupos_menu` y `asignaciones_modulo_menu` — subdivisiones
 * editables del menú lateral (ver comentario en schema.prisma sobre por qué
 * reemplazan a items_ocultos/orden_items de UiConfiguracion).
 */

import prisma from '../config/database';

export const grupoMenuRepository = {

  findAll: () =>
    prisma.grupoMenu.findMany({
      orderBy: { orden: 'asc' },
      include: { items: { orderBy: { orden: 'asc' } } },
    }),

  /**
   * Reemplaza toda la estructura en una transacción (delete-all + recreate).
   * Mismo patrón que configuracionService.sincronizarPermisos: el volumen de
   * filas es mínimo (unos pocos grupos, una docena de módulos) y la edición
   * es infrecuente, así que un reemplazo completo es más simple y robusto
   * que diffear altas/bajas/renombres uno por uno.
   */
  reemplazarTodo: (
    grupos: { nombre: string; orden: number; items: { path: string; orden: number; visible: boolean }[] }[]
  ) =>
    prisma.$transaction(async (tx) => {
      await tx.asignacionModuloMenu.deleteMany({});
      await tx.grupoMenu.deleteMany({});
      for (const g of grupos) {
        await tx.grupoMenu.create({
          data: {
            nombre: g.nombre,
            orden:  g.orden,
            items: {
              create: g.items.map(i => ({ path: i.path, orden: i.orden, visible: i.visible })),
            },
          },
        });
      }
      return tx.grupoMenu.findMany({
        orderBy: { orden: 'asc' },
        include: { items: { orderBy: { orden: 'asc' } } },
      });
    }),
};
