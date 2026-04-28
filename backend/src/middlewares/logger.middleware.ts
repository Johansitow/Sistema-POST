/**
 * LoggerMiddleware - Registra cada request HTTP
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const logData = {
      method:    req.method,
      url:       req.url,
      status:    res.statusCode,
      duration:  `${Date.now() - start}ms`,
      ip:        req.ip,
      userAgent: req.get('user-agent'),
    };

    if (res.statusCode >= 400) logger.error('Request error:', logData);
    else                       logger.info('Request:', logData);
  });

  next();
};
