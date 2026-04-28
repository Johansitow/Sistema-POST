"use strict";
/**
 * Auth Routes
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controller/auth.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Públicas
router.post('/login', auth_controller_1.login);
router.post('/refresh', auth_controller_1.refreshToken);
// Protegidas
router.get('/profile', auth_middleware_1.authenticate, auth_controller_1.getProfile);
router.post('/logout', auth_middleware_1.authenticate, auth_controller_1.logout);
router.put('/change-password', auth_middleware_1.authenticate, auth_controller_1.changePassword);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map