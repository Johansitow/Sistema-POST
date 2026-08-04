/**
 * Webhooks Routes — endpoints PÚBLICOS (sin authenticate) para callbacks de
 * pasarelas de pago. La autenticidad se valida por firma dentro del service.
 * Se montan FUERA del rate-limit por tenant (no tienen restauranteId).
 */

import { Router } from 'express';
import { recibirWebhookWompi } from '../controller/wompiWebhook.controller';

const router = Router();

router.post('/wompi', recibirWebhookWompi);

export default router;
