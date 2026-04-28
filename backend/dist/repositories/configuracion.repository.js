"use strict";
/**
 * ConfiguracionRepository
 * Maneja la tabla `configuracion` — clave/valor tipado para ajustes del sistema.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configuracionRepository = void 0;
const database_1 = __importDefault(require("../config/database"));
exports.configuracionRepository = {
    findAll: (categoria) => database_1.default.configuracion.findMany({
        where: categoria ? { categoria } : undefined,
        orderBy: [{ categoria: 'asc' }, { clave: 'asc' }],
    }),
    findByClave: (clave) => database_1.default.configuracion.findUnique({ where: { clave } }),
    findByCategoria: (categoria) => database_1.default.configuracion.findMany({
        where: { categoria },
        orderBy: { clave: 'asc' },
    }),
    update: (clave, valor) => database_1.default.configuracion.update({
        where: { clave },
        data: { valor },
    }),
    updateMany: (items) => database_1.default.$transaction(items.map(item => database_1.default.configuracion.update({ where: { clave: item.clave }, data: { valor: item.valor } }))),
    create: (data) => database_1.default.configuracion.create({ data }),
    // Helper: parsea el valor al tipo correcto
    parseValor: (config) => {
        switch (config.tipo_dato) {
            case 'number': return Number(config.valor);
            case 'boolean': return config.valor === 'true';
            case 'json': try {
                return JSON.parse(config.valor);
            }
            catch {
                return config.valor;
            }
            default: return config.valor;
        }
    },
};
//# sourceMappingURL=configuracion.repository.js.map