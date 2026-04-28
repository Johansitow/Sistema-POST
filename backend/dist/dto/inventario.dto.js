"use strict";
/**
 * InventarioDTO - Validación de forma para movimientos de inventario
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registrarMovimientoSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.registrarMovimientoSchema = zod_1.z.object({
    id_producto: zod_1.z.number().int().positive('ID de producto inválido'),
    tipo_movimiento: zod_1.z.nativeEnum(client_1.TipoMovimiento, {
        errorMap: () => ({ message: 'Tipo de movimiento inválido' }),
    }),
    cantidad: zod_1.z.number().positive('La cantidad debe ser positiva'),
    motivo: zod_1.z.string().min(1, 'El motivo es obligatorio').max(255),
    id_proveedor: zod_1.z.number().int().positive().optional(),
    id_lote: zod_1.z.number().int().positive().optional(),
    referencia: zod_1.z.string().max(100).optional(),
});
//# sourceMappingURL=inventario.dto.js.map