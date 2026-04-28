"use strict";
/**
 * CategoriaService - Solo lógica de negocio para categorías
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoriaService = void 0;
const categoria_repository_1 = require("../repositories/categoria.repository");
const HttpErrors_1 = require("../exceptions/HttpErrors");
exports.categoriaService = {
    async listar(estado) {
        return categoria_repository_1.categoriaRepository.findAll(estado);
    },
    async obtenerPorId(id) {
        const categoria = await categoria_repository_1.categoriaRepository.findById(id);
        if (!categoria)
            throw new HttpErrors_1.NotFoundError('Categoría');
        return categoria;
    },
    async crear(data) {
        const existe = await categoria_repository_1.categoriaRepository.findByNombre(data.nombre);
        if (existe)
            throw new HttpErrors_1.ConflictError('Ya existe una categoría con ese nombre');
        return categoria_repository_1.categoriaRepository.create(data);
    },
    async actualizar(id, data) {
        await this.obtenerPorId(id);
        return categoria_repository_1.categoriaRepository.update(id, data);
    },
    async eliminar(id) {
        await this.obtenerPorId(id);
        const productos = await categoria_repository_1.categoriaRepository.countProductos(id);
        if (productos > 0)
            throw new HttpErrors_1.ConflictError('No se puede eliminar: tiene productos asociados');
        const subcategorias = await categoria_repository_1.categoriaRepository.countSubcategorias(id);
        if (subcategorias > 0)
            throw new HttpErrors_1.ConflictError('No se puede eliminar: tiene subcategorías');
        await categoria_repository_1.categoriaRepository.delete(id);
    },
};
//# sourceMappingURL=categoria.service.js.map