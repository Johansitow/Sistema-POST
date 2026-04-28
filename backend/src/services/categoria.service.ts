/**
 * CategoriaService - Solo lógica de negocio para categorías
 */

import { EstadoGeneral } from '@prisma/client';
import { categoriaRepository } from '../repositories/categoria.repository';
import { NotFoundError, ConflictError } from '../exceptions/HttpErrors';
import { cacheGetOrSet, cacheDel, CACHE_TTL } from '../config/redis';
import { assertGrupoId } from '../lib/tenantQuery';

const KEY_ALL = 'cat:all';
const keyOne  = (id: number) => `cat:${id}`;

export const categoriaService = {
  async listar(estado?: EstadoGeneral, id_grupo?: number) {
    const key = `cat:all:${id_grupo ?? 'g'}:${estado ?? 'all'}`;
    return cacheGetOrSet(key, CACHE_TTL.LONG, () => categoriaRepository.findAll(estado, id_grupo));
  },

  async obtenerPorId(id: number) {
    const categoria = await cacheGetOrSet(
      keyOne(id),
      CACHE_TTL.LONG,
      async () => categoriaRepository.findById(id)
    );
    if (!categoria) throw new NotFoundError('Categoría');
    return categoria;
  },

  async crear(data: {
    nombre: string; descripcion?: string; categoria_padre?: number;
    imagen_url?: string; estado?: EstadoGeneral; orden?: number;
    id_grupo: number;  // obligatorio — categorías siempre pertenecen a un grupo empresarial
  }) {
    assertGrupoId(data.id_grupo);
    const existe = await categoriaRepository.findByNombre(data.nombre, data.id_grupo);
    if (existe) throw new ConflictError('Ya existe una categoría con ese nombre');
    const categoria = await categoriaRepository.create(data);
    await cacheDel(`cat:all:${data.id_grupo ?? 'g'}:all`, `cat:all:${data.id_grupo ?? 'g'}:${EstadoGeneral.activo}`);
    return categoria;
  },

  async actualizar(id: number, data: Partial<{
    nombre: string; descripcion: string; categoria_padre: number;
    imagen_url: string; estado: EstadoGeneral; orden: number;
  }>) {
    await this.obtenerPorId(id);
    const categoria = await categoriaRepository.update(id, data);
    await cacheDel(KEY_ALL, keyOne(id), `cat:all:${EstadoGeneral.activo}`);
    return categoria;
  },

  async eliminar(id: number) {
    await this.obtenerPorId(id);

    const productos = await categoriaRepository.countProductos(id);
    if (productos > 0) throw new ConflictError('No se puede eliminar: tiene productos asociados');

    const subcategorias = await categoriaRepository.countSubcategorias(id);
    if (subcategorias > 0) throw new ConflictError('No se puede eliminar: tiene subcategorías');

    await categoriaRepository.delete(id);
    await cacheDel(KEY_ALL, keyOne(id), `cat:all:${EstadoGeneral.activo}`);
  },

  async reordenar(items: { id: number; orden: number }[]) {
    await categoriaRepository.reorder(items);
    await cacheDel(KEY_ALL, `cat:all:${EstadoGeneral.activo}`);
  },
};
