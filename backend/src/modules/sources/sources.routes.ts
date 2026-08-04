import { Router } from 'express';
import sourcesController from './core/controllers/sources.controller';

const router = Router();

router.use('/', sourcesController);

export default router;
