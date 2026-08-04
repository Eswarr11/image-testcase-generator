import cors from 'cors';
import { isDevelopment } from './env';

export const corsMiddleware = cors({
  origin: isDevelopment ? ['http://localhost:5173', 'http://localhost:3000'] : true,
  credentials: true,
});
