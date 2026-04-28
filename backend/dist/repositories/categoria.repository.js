"use strict";
/**
 * CategoriaRepository - Solo queries Prisma para categorías
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoriaRepository = void 0;
const client_1 = require("@prisma/client");
const database_1 = __importDefault(require("../config/database"));
exports.categoriaRepository = {
    findAll: (estado) => database_1.default.categoria.findMany({
        where: estado ? { estado } : undefined,
        include: { _count: { select: { productos: true } } },
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    }),
    findById: (id) => database_1.default.categoria.findUnique({
        where: { id },
        include: {
            productos: { where: { estado: client_1.EstadoGeneral.activo } },
            subcategorias: true,
            padre: true,
        },
    }),
    findByNombre: (nombre) => database_1.default.categoria.findFirst({
        where: { nombre: { equals: nombre, mode: 'insensitive' } },
    }),
    countProductos: (id) => database_1.default.producto.count({ where: { id_categoria: id } }),
    countSubcategorias: (id) => database_1.default.categoria.count({ where: { categoria_padre: id } }),
    create: (data) => database_1.default.categoria.create({ data }),
    update: (id, data) => database_1.default.categoria.update({ where: { id }, data }),
    delete: (id) => database_1.default.categoria.delete({ where: { id } }),
};
//# sourceMappingURL=categoria.repository.js.map