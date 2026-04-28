"use strict";
/**
 * CategoriasDTO - Validación de forma para categorías
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCategoriaSchema = exports.createCategoriaSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.createCategoriaSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(1, 'El nombre es obligatorio').max(100),
    descripcion: zod_1.z.string().max(1000).optional(),
    categoria_padre: zod_1.z.number().int().positive().optional(),
    imagen_url: zod_1.z.string().url('URL inválida').max(255).optional(),
    estado: zod_1.z.nativeEnum(client_1.EstadoGeneral).default(client_1.EstadoGeneral.activo).optional(),
    orden: zod_1.z.number().int().default(0).optional(),
});
exports.updateCategoriaSchema = exports.createCategoriaSchema.partial();
//# sourceMappingURL=categorias.dto.js.map