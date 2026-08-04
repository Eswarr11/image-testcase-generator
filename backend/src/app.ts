import express, { Application, Request, Response } from 'express';
import path from 'path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { corsMiddleware } from './config/cors';
import { env, isDevelopment, isVercel } from './config/env';
import { helmetMiddleware } from './config/helmet';
import { traceMiddleware } from './logger/trace.middleware';
import { errorHandler } from './middleware/errorHandler.middleware';
import { apiNotFound } from './middleware/notFound.middleware';
import { mountRoutes } from './modules';

function frontendRoot(): string {
  // Build copies Vite output to /public for Vercel CDN + serverless fallback
  if (isVercel) {
    return path.join(process.cwd(), 'public');
  }
  return env.frontendDist;
}

export function createApp(): Application {
  const app = express();

  app.use(helmetMiddleware);
  app.use(compression());
  app.use(corsMiddleware);
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));
  app.use(cookieParser());
  app.use(traceMiddleware);

  if (!isDevelopment) {
    app.use(express.static(frontendRoot(), {
      maxAge: '1d',
      etag: true,
      lastModified: true,
    }));
  }

  mountRoutes(app);

  app.use('/api/*', apiNotFound);

  if (!isDevelopment) {
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(frontendRoot(), 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
