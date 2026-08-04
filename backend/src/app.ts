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

/**
 * On Vercel, static UI is served from `outputDirectory` (CDN).
 * Express must only handle /api/* — never SPA catch-all or static assets.
 */
function shouldServeFrontend(): boolean {
  return !isDevelopment && !isVercel;
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

  if (shouldServeFrontend()) {
    app.use(express.static(env.frontendDist, {
      maxAge: '1d',
      etag: true,
      lastModified: true,
    }));
  }

  mountRoutes(app);

  app.use('/api/*', apiNotFound);

  if (shouldServeFrontend()) {
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(env.frontendDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
