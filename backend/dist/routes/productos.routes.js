"use strict";
/**
 * Productos Routes
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const productos_controller_1 = require("../controller/productos.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/', productos_controller_1.getAll);
router.get('/stock/bajo', productos_controller_1.getStockBajo);
router.get('/sku/:sku', productos_controller_1.getBySKU);
router.get('/:id', productos_controller_1.getById);
router.post('/', productos_controller_1.create);
router.put('/:id', productos_controller_1.update);
router.patch('/:id', productos_controller_1.patch);
router.delete('/:id', productos_controller_1.remove);
router.post('/:id/stock', productos_controller_1.updateStock);
exports.default = router;
//# sourceMappingURL=productos.routes.js.map