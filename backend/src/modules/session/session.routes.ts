import { Router } from 'express';
import sessionController from './core/controllers/session.controller';

const router = Router();

router.use('/', sessionController);

export default router;
