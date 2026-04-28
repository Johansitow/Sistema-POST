import { Router } from 'express';
import { getAll } from '../controller/metodo-pago.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getAll);

export default router;
