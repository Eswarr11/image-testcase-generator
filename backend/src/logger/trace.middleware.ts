import { createHash, randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { SESSION_COOKIE } from '../modules/session/core/repositories/session.repository';
import { logger } from './logger';
import { runWithRequestContext } from './request-context';

function readIncomingTraceId(req: Request): string | undefined {
  const trace = req.headers['x-trace-id'];
  const requestId = req.headers['x-request-id'];
  if (typeof trace === 'string' && trace.trim()) return trace.trim();
  if (typeof requestId === 'string' && requestId.trim()) return requestId.trim();
  return undefined;
}

function sessionIdForLog(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  // Short stable hash — never log the full cookie value
  return createHash('sha256').update(raw).digest('hex').slice(0, 12);
}

/**
 * Bind per-request AsyncLocalStorage context and emit access log on finish.
 */
export function traceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  const traceId = readIncomingTraceId(req) || randomUUID();
  const sessionId = sessionIdForLog(cookies?.[SESSION_COOKIE]);
  const method = req.method;
  const path = req.originalUrl || req.url;
  const startTime = Date.now();

  res.setHeader('X-Trace-Id', traceId);

  runWithRequestContext(
    {
      traceId,
      ...(sessionId ? { sessionId } : {}),
      method,
      path,
    },
    () => {
      res.on('finish', () => {
        logger.info('access', {
          status: res.statusCode,
          durationMs: Date.now() - startTime,
        });
      });
      next();
    }
  );
}
