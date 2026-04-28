/**
 * CategoriaRepository - Solo queries Prisma para categorías
 *
 * Scoping: id_grupo = null → categoría global del sistema (visible a todos)
 *          id_grupo = N    → categoría del grupo N
 *
 * Patrón de consulta para un usuario de grupo G:
 *   where: { OR: [{ id_grupo: null }, { id_grupo: G }] }
 * Esto devuelve las globales + las del grupo, pero nunca las de otro grupo.
 */

import { EstadoGeneral } from '@prisma/client';
import prisma from '../config/database';

/**
 * Construye el filtro de tenant para categorías:
 * - superadmin (id_grupo = undefined) → sin filtro (ve todo)
 * - usuario normal → categorías globales + las de su grupo
 */
function tenantWhere(id_grupo?: number | null) {
  if (id_grupo == null) return {};   // superadmin o sin contexto: sin filtro
  return { OR: [{ id_grupo: null }, { id_grupo }] };
}

export const categoriaRepository = {
  findAll: (estado?: EstadoGeneral, id_grupo?: number | null) =>
    prisma.categoria.findMany({
      where: {
        ...tenantWhere(id_grupo),
        ...(estado ? { estado } : {}),
      },
      include: { _count: { select: { productos: true } } },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    }),

  findById: (id: number) =>
    prisma.categoria.findUnique({
      where: { id },
      include: {
        productos:     { where: { estado: EstadoGeneral.activo } },
        subcategorias: true,
        padre:         true,
      },
    }),

  findByNombre: (nombre: string, id_grupo?: number | null) =>
    prisma.categoria.findFirst({
      where: {
        nombre:   { equals: nombre, mode: 'insensitive' },
        id_grupo: id_grupo ?? null,
      },
    }),

  countProductos: (id: number) =>
    prisma.producto.count({ where: { id_categoria: id } }),

  countSubcategorias: (id: number) =>
    prisma.categoria.count({ where: { categoria_padre: id } }),

  create: (data: {
    nombre:          string;
    descripcion?:    string;
    categoria_padre?: number;
    imagen_url?:     string;
    estado?:         EstadoGeneral;
    orden?:          number;
    icono?:          string;
    color?:          string;
    id_grupo?:       number;   // null = global del sistema
  }) => prisma.categoria.create({ data }),

  update: (
    id: number,
    data: Partial<{
      nombre:          string;
      descripcion:     string;
      categoria_padre: number;
      imagen_url:      string;
      estado:          EstadoGeneral;
      orden:           number;
      icono:           string;
      color:           string;
    }>
  ) => prisma.categoria.update({ where: { id }, data }),

  delete: (id: number) =>
    prisma.categoria.delete({ where: { id } }),

  reorder: (items: { id: number; orden: number }[]) =>
    prisma.$transaction(
      items.map(({ id, orden }) =>
        prisma.categoria.update({ where: { id }, data: { orden } })
      )
    ),
};
