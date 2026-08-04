import fs from 'fs';
import path from 'path';
import { env, isDevelopment } from '../config/env';
import { getRequestContext } from './request-context';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[env.logLevel];
}

function logsDir(): string {
  return path.resolve(__dirname, '..', '..', 'logs');
}

function logFilePath(): string {
  const day = new Date().toISOString().slice(0, 10);
  return path.join(logsDir(), `app-${day}.log`);
}

function writeLine(line: string): void {
  // Always stdout
  if (line.includes('"level":"error"') || line.includes('"level":"warn"')) {
    console.error(line);
  } else {
    console.log(line);
  }

  if (!env.logToFile) return;
  try {
    fs.mkdirSync(logsDir(), { recursive: true });
    fs.appendFileSync(logFilePath(), `${line}\n`, 'utf8');
  } catch {
    // Never throw from logger
  }
}

function emit(
  level: LogLevel,
  msg: string,
  fields?: Record<string, unknown>
): void {
  if (!shouldLog(level)) return;

  const ctx = getRequestContext();
  const payload: Record<string, unknown> = {
    level,
    msg,
    ts: new Date().toISOString(),
    ...(ctx?.traceId ? { traceId: ctx.traceId } : {}),
    ...(ctx?.sessionId ? { sessionId: ctx.sessionId } : {}),
    ...(ctx?.method ? { method: ctx.method } : {}),
    ...(ctx?.path ? { path: ctx.path } : {}),
    ...(isDevelopment ? { env: env.nodeEnv } : {}),
    ...fields,
  };

  writeLine(JSON.stringify(payload));
}

export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) =>
    emit('debug', msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) =>
    emit('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) =>
    emit('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) =>
    emit('error', msg, fields),
};
