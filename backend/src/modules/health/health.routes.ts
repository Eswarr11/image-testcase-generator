import { Router } from 'express';
import { getHealth } from './core/controllers/health.controller';

const router = Router();

router.get('/', getHealth);

export default router;
