/**
 * verificarCaptcha — valida el token de Cloudflare Turnstile en endpoints públicos
 * sensibles (registro, solicitar reset), como barrera anti-bots.
 *
 * Provider-agnóstico por env: sin `TURNSTILE_SECRET_KEY` configurada (típico en
 * desarrollo) el middleware hace BYPASS y deja pasar. En producción, con la secret
 * puesta, exige y valida el `captchaToken` del body contra la API de siteverify.
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';
import { ForbiddenError } from '../exceptions/HttpErrors';
import logger from '../config/logger';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export const verificarCaptcha = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const secret = config.turnstile.secretKey;
  if (!secret) return next(); // dev: sin secret, no se exige captcha

  const token = (req.body?.captchaToken as string | undefined) ?? '';
  if (!token) return next(new ForbiddenError('Verificación anti-bots requerida'));

  try {
    const resp = await fetch(SITEVERIFY_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({ secret, response: token, remoteip: req.ip ?? '' }),
    });
    const data = (await resp.json()) as { success: boolean };
    if (!data.success) return next(new ForbiddenError('No pudimos verificar que no eres un bot. Intenta de nuevo.'));
    next();
  } catch (err) {
    // Fallo de red hacia Cloudflare: se rechaza (fail-closed) para no abrir la
    // puerta a bots. Es un evento raro; se registra para diagnóstico.
    logger.error(`Turnstile inaccesible: ${(err as Error).message}`);
    next(new ForbiddenError('No pudimos verificar el captcha. Intenta de nuevo en un momento.'));
  }
};
