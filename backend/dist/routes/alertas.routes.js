"use strict";
/**
 * Alertas Routes
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const alerta_controller_1 = require("../controller/alerta.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/', alerta_controller_1.alertaController.getAll);
router.get('/no-leidas/count', alerta_controller_1.alertaController.getCountNoLeidas);
router.patch('/leer-todas', alerta_controller_1.alertaController.marcarTodasLeidas);
router.patch('/:id/leer', alerta_controller_1.alertaController.marcarLeida);
router.post('/sincronizar', alerta_controller_1.alertaController.sincronizar);
exports.default = router;
//# sourceMappingURL=alertas.routes.js.map