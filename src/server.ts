import express, { Application, Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

interface HealthResponse {
  status: 'OK' | 'ERROR';
  message: string;
  timestamp: string;
  environment: string;
  version: string;
}

interface ApiError {
  error: string;
  message: string;
  path?: string;
  stack?: string;
}

interface RequestWithTiming extends Request {
  startTime?: number;
}

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CLIENT_BUILD_PATH = path.join(process.cwd(), 'client', 'dist');
const isDevelopment = NODE_ENV === 'development';

const app: Application = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openai.com"],
    },
  },
}));

app.use(compression());

app.use(cors({
  origin: isDevelopment ? ['http://localhost:5173', 'http://localhost:3000'] : true,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (isDevelopment) {
  app.use((req: RequestWithTiming, res: Response, next: NextFunction) => {
    req.startTime = Date.now();
    const originalSend = res.send;

    res.send = function(data) {
      const duration = Date.now() - (req.startTime || 0);
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
      return originalSend.call(this, data);
    };

    next();
  });
}

if (!isDevelopment) {
  app.use(express.static(CLIENT_BUILD_PATH, {
    maxAge: '1d',
    etag: true,
    lastModified: true,
  }));
}

app.get('/api/health', (req: Request, res: Response<HealthResponse>) => {
  const packageJson = require('../package.json') as { version: string };

  res.json({
    status: 'OK',
    message: 'Jira Test Case Generator API is running',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: packageJson.version || '1.0.0',
  });
});

app.post('/api/generate-test-case', (req: Request, res: Response<ApiError>) => {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'Server-side generation not implemented. Use client-side generation with your own API key.',
  });
});

if (!isDevelopment) {
  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(CLIENT_BUILD_PATH, 'index.html'));
  });
}

app.use('/api/*', (req: Request, res: Response<ApiError>) => {
  res.status(404).json({
    error: 'API endpoint not found',
    message: `The endpoint ${req.method} ${req.path} was not found`,
    path: req.path,
  });
});

app.use((err: Error, req: Request, res: Response<ApiError>, next: NextFunction) => {
  console.error('Server Error:', err.stack);

  const errorResponse: ApiError = {
    error: 'Internal Server Error',
    message: isDevelopment ? err.message : 'Something went wrong!',
  };

  if (isDevelopment && err.stack) {
    errorResponse.stack = err.stack;
  }

  res.status(500).json(errorResponse);
});

const gracefulShutdown = (signal: string) => {
  console.log(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const server = app.listen(PORT, () => {
  console.log('🚀 Jira Test Case Generator API Server');
  console.log(`📍 Server running on http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);

  if (isDevelopment) {
    console.log(`🎨 Frontend dev server: http://localhost:5173`);
    console.log(`🔗 API health check: http://localhost:${PORT}/api/health`);
  }

  console.log('🔄 Press Ctrl+C to stop the server');
});

export default app;
