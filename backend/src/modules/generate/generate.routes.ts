import { Router } from 'express';
import generateController from './core/controllers/generate.controller';

const router = Router();

router.use('/', generateController);

export default router;
