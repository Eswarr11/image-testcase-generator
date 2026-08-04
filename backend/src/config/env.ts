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
export const isVercel = Boolean(process.env.VERCEL);

/** Local: repo data/; Vercel without Turso: ephemeral /tmp (set DATABASE_URL for Turso). */
const defaultDatabaseUrl = isVercel
  ? 'file:/tmp/testcase-generator.db'
  : `file:${path.resolve(__dirname, '..', '..', '..', 'data', 'testcase-generator.db')}`;

function resolveEncryptionKey(): string {
  const raw = process.env.SESSION_ENCRYPTION_KEY?.trim();
  if (raw && raw.length >= 16) return raw;
  // Local/dev default — override in production via SESSION_ENCRYPTION_KEY
  return 'local-dev-session-encryption-key';
}

export const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv,
  frontendDist:
    process.env.FRONTEND_DIST ||
    path.resolve(__dirname, '..', '..', 'frontend', 'dist'),
  logLevel: parseLogLevel(process.env.LOG_LEVEL),
  // Vercel filesystem is read-only (except /tmp); never write log files there
  logToFile:
    process.env.LOG_TO_FILE !== undefined
      ? process.env.LOG_TO_FILE === 'true'
      : isProd && !isVercel,
  databaseUrl: process.env.DATABASE_URL || defaultDatabaseUrl,
  tursoAuthToken: process.env.TURSO_AUTH_TOKEN || undefined,
  sessionEncryptionKey: resolveEncryptionKey(),
};

export const isDevelopment = env.nodeEnv === 'development';
