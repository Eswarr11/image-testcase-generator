import { Response } from 'express';
import { SESSION_COOKIE } from '../core/repositories/session.repository';

const isProduction = process.env.NODE_ENV === 'production';

export function setSessionCookie(res: Response, sessionId: string): void {
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
    secure: isProduction && process.env.FORCE_SECURE_COOKIE === 'true',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
}
