"use strict";
/**
 * LoggerMiddleware - Registra cada request HTTP
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = void 0;
const logger_1 = __importDefault(require("../config/logger"));
const requestLogger = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const logData = {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${Date.now() - start}ms`,
            ip: req.ip,
            userAgent: req.get('user-agent'),
        };
        if (res.statusCode >= 400)
            logger_1.default.error('Request error:', logData);
        else
            logger_1.default.info('Request:', logData);
    });
    next();
};
exports.requestLogger = requestLogger;
//# sourceMappingURL=logger.middleware.js.map