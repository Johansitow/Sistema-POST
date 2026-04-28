"use strict";
/**
 * Categorias Routes
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const categorias_controller_1 = require("../controller/categorias.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/', categorias_controller_1.getAll);
router.get('/:id', categorias_controller_1.getById);
router.post('/', categorias_controller_1.create);
router.put('/:id', categorias_controller_1.update);
router.delete('/:id', categorias_controller_1.remove);
exports.default = router;
//# sourceMappingURL=categorias.routes.js.map