import { NextFunction, Request, Response } from 'express';
import { isDevelopment } from '../config/env';
import { AppError } from '../exceptions/AppError';
import { logger } from '../logger/logger';
import { getTraceId } from '../logger/request-context';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const traceId = getTraceId();

  if (traceId) {
    res.setHeader('X-Trace-Id', traceId);
  }

  if (err instanceof AppError) {
    if (err.status === 429) {
      res.setHeader('Retry-After', '60');
    }

    logger.error(err.event || 'request_failed', {
      status: err.status,
      code: err.code,
      message: err.message,
      ...(err.fields || {}),
    });

    res.status(err.status).json({
      error: err.code,
      message: err.message,
      ...(traceId ? { traceId } : {}),
    });
    return;
  }

  logger.error('request_error', {
    error: err.name || 'Error',
    message: err.message,
    ...(isDevelopment && err.stack ? { stack: err.stack } : {}),
  });

  res.status(500).json({
    error: 'Internal Server Error',
    message: isDevelopment ? err.message : 'Something went wrong!',
    ...(traceId ? { traceId } : {}),
    ...(isDevelopment && err.stack ? { stack: err.stack } : {}),
  });
}
