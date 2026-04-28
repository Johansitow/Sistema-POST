"use strict";
/**
 * CategoriasController - Recibe request, valida con DTO, delega al service
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.remove = exports.update = exports.create = exports.getById = exports.getAll = void 0;
const categoria_service_1 = require("../services/categoria.service");
const error_middleware_1 = require("../middlewares/error.middleware");
const categorias_dto_1 = require("../dto/categorias.dto");
exports.getAll = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const estado = req.query.estado;
    const categorias = await categoria_service_1.categoriaService.listar(estado);
    res.json(categorias);
});
exports.getById = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const categoria = await categoria_service_1.categoriaService.obtenerPorId(Number(req.params.id));
    res.json(categoria);
});
exports.create = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const data = categorias_dto_1.createCategoriaSchema.parse(req.body);
    const categoria = await categoria_service_1.categoriaService.crear(data);
    res.status(201).json(categoria);
});
exports.update = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const data = categorias_dto_1.updateCategoriaSchema.parse(req.body);
    const categoria = await categoria_service_1.categoriaService.actualizar(Number(req.params.id), data);
    res.json(categoria);
});
exports.remove = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    await categoria_service_1.categoriaService.eliminar(Number(req.params.id));
    res.status(204).send();
});
//# sourceMappingURL=categorias.controller.js.map