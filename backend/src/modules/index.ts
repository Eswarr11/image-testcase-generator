import { Application } from 'express';
import generateRoutes from './generate/generate.routes';
import healthRoutes from './health/health.routes';
import sessionRoutes from './session/session.routes';
import sourcesRoutes from './sources/sources.routes';

export function mountRoutes(app: Application): void {
  app.use('/api/health', healthRoutes);
  app.use('/api/session', sessionRoutes);
  app.use('/api/sources', sourcesRoutes);
  app.use('/api/generate-test-case', generateRoutes);
}
