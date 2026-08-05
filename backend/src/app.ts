import express, { Application, Request, Response } from 'express';
import path from 'path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { corsMiddleware } from './config/cors';
import { env, isDevelopment, isVercel } from './config/env';
import { helmetMiddleware } from './config/helmet';
import { migrateDb } from './db/client';
import { logger } from './logger/logger';
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

let bootPromise: Promise<void> | null = null;

async function ensureBootstrapped(): Promise<void> {
  if (!bootPromise) {
    bootPromise = migrateDb().catch((err) => {
      bootPromise = null;
      logger.error('db_migrate_fail', { message: (err as Error).message });
      throw err;
    });
  }
  await bootPromise;
}

export function createApp(): Application {
  const app = express();

  // Ensure DB schema before handling requests (local + Vercel)
  app.use((req, res, next) => {
    void ensureBootstrapped()
      .then(() => next())
      .catch(next);
  });

  app.use(helmetMiddleware);
  app.use(compression());
  app.use(corsMiddleware);
  // Base64 inflates ~33%; 50MB images need headroom beyond the raw file size
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));
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
