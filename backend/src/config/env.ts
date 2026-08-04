import path from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function parseLogLevel(raw: string | undefined): LogLevel {
  const value = (raw || 'info').toLowerCase();
  if (value === 'debug' || value === 'info' || value === 'warn' || value === 'error') {
    return value;
  }
  return 'info';
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

export const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv,
  frontendDist:
    process.env.FRONTEND_DIST ||
    path.resolve(__dirname, '..', '..', 'frontend', 'dist'),
  logLevel: parseLogLevel(process.env.LOG_LEVEL),
  logToFile:
    process.env.LOG_TO_FILE !== undefined
      ? process.env.LOG_TO_FILE === 'true'
      : isProd,
};

export const isDevelopment = env.nodeEnv === 'development';
