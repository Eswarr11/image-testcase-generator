import { Request, Response } from 'express';
import { env } from '../../../../config/env';

interface HealthResponse {
  status: 'OK';
  message: string;
  timestamp: string;
  environment: string;
  version: string;
}

export function getHealth(_req: Request, res: Response<HealthResponse>): void {
  const packageJson = require('../../../../../package.json') as { version: string };

  res.json({
    status: 'OK',
    message: 'Jira Test Case Generator API is running',
    timestamp: new Date().toISOString(),
    environment: env.nodeEnv,
    version: packageJson.version || '1.0.0',
  });
}
