import { Server } from 'http';
import { createApp } from './app';
import { env, isDevelopment } from './config/env';

const app = createApp();
const server = app.listen(env.port, () => {
  console.log('🚀 Jira Test Case Generator API Server');
  console.log(`📍 Server running on http://localhost:${env.port}`);
  console.log(`🌍 Environment: ${env.nodeEnv}`);
  if (isDevelopment) {
    console.log('🎨 Frontend dev server: http://localhost:5173');
    console.log(`🔗 API health check: http://localhost:${env.port}/api/health`);
  }
  console.log('🔄 Press Ctrl+C to stop the server');
});

function gracefulShutdown(signal: string, httpServer: Server): void {
  console.log(`${signal} received. Shutting down gracefully...`);
  httpServer.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM', server));
process.on('SIGINT', () => gracefulShutdown('SIGINT', server));
