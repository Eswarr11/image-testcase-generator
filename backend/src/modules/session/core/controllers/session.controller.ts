import { Router, Request, Response } from 'express';
import {
  SESSION_COOKIE,
} from '../repositories/session.repository';
import {
  clearSession,
  ensureSession,
  getSession,
  sessionStatus,
  updateSession,
} from '../services/session.service';
import { clearSessionCookie, setSessionCookie } from '../../middleware/sessionCookie';
import {
  normalizeApiToken,
  normalizeSiteUrl,
  resolveAtlassianAuth,
  fetchWithTimeout,
} from '../../../sources/core/services/atlassian-auth.service';
import { figmaFetch } from '../../../../utils/figmaFetch';
import { logger } from '../../../../logger/logger';
import { AppError } from '../../../../exceptions/AppError';
import { asyncHandler } from '../../../../utils/asyncHandler';

const router = Router();

function readCookieSessionId(req: Request): string | undefined {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[SESSION_COOKIE];
}

router.get(
  '/status',
  asyncHandler(async (req: Request, res: Response) => {
    const record = await getSession(readCookieSessionId(req));
    return res.json(sessionStatus(record));
  })
);

router.delete(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('session_clear');
    await clearSession(readCookieSessionId(req));
    clearSessionCookie(res);
    return res.json({ ok: true });
  })
);

/**
 * Save credentials into the server session vault (secrets appear only on this request).
 * Body may include any of: openai, atlassian { siteUrl, email, apiToken }, figma { accessToken }
 * Empty string / null for a provider clears it. Omit field to leave unchanged.
 */
router.post(
  '/credentials',
  asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body || {}) as {
      openai?: string | null;
      atlassian?: { siteUrl?: string; email?: string; apiToken?: string } | null;
      figma?: { accessToken?: string } | null;
    };

    const providers = [
      body.openai !== undefined ? 'openai' : null,
      body.atlassian !== undefined ? 'atlassian' : null,
      body.figma !== undefined ? 'figma' : null,
    ].filter(Boolean);

    logger.info('credentials_save_start', { providers });

    const { id } = await ensureSession(readCookieSessionId(req));

    try {
      // OpenAI
      if (body.openai !== undefined) {
        if (body.openai === null || body.openai === '') {
          await updateSession(id, { openai: null });
          logger.info('credentials_cleared', { provider: 'openai' });
        } else {
          const key = body.openai.trim();
          if (!key.startsWith('sk-') || key.length <= 20) {
            throw new AppError(400, 'Bad Request', 'Invalid OpenAI API key format', {
              event: 'credentials_save_failed',
              fields: { provider: 'openai', reason: 'invalid_format' },
            });
          }
          const probe = await fetchWithTimeout('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${key}` },
          });
          if (!probe.ok) {
            throw new AppError(401, 'Unauthorized', 'OpenAI API key was rejected', {
              event: 'credentials_save_failed',
              fields: { provider: 'openai', reason: 'rejected', status: probe.status },
            });
          }
          await updateSession(id, { openai: key });
          logger.info('credentials_saved', { provider: 'openai' });
        }
      }

      // Atlassian
      if (body.atlassian !== undefined) {
        if (body.atlassian === null) {
          await updateSession(id, { atlassian: null });
          logger.info('credentials_cleared', { provider: 'atlassian' });
        } else {
          const siteUrl = normalizeSiteUrl(String(body.atlassian.siteUrl || ''));
          const email = String(body.atlassian.email || '').trim();
          const apiToken = normalizeApiToken(String(body.atlassian.apiToken || ''));
          if (!siteUrl || !email || !apiToken) {
            throw new AppError(
              400,
              'Bad Request',
              'Atlassian requires siteUrl, email, and apiToken',
              {
                event: 'credentials_save_failed',
                fields: { provider: 'atlassian', reason: 'missing_fields' },
              }
            );
          }
          const resolved = await resolveAtlassianAuth({ siteUrl, email, token: apiToken });
          if ('error' in resolved) {
            throw new AppError(401, 'Unauthorized', resolved.error, {
              event: 'credentials_save_failed',
              fields: { provider: 'atlassian', reason: 'auth_failed' },
            });
          }
          await updateSession(id, {
            atlassian: { siteUrl, email, apiToken },
          });
          logger.info('credentials_saved', {
            provider: 'atlassian',
            mode: resolved.resolved.mode,
          });
        }
      }

      // Figma
      if (body.figma !== undefined) {
        if (body.figma === null) {
          await updateSession(id, { figma: null });
          logger.info('credentials_cleared', { provider: 'figma' });
        } else {
          const accessToken = String(body.figma.accessToken || '').trim();
          if (!accessToken) {
            throw new AppError(400, 'Bad Request', 'Figma accessToken is required', {
              event: 'credentials_save_failed',
              fields: { provider: 'figma', reason: 'missing_token' },
            });
          }
          const me = await figmaFetch('https://api.figma.com/v1/me', accessToken, 30_000);
          if (!me.ok) {
            throw new AppError(401, 'Unauthorized', 'Figma token was rejected', {
              event: 'credentials_save_failed',
              fields: { provider: 'figma', reason: 'rejected', status: me.status },
            });
          }
          await updateSession(id, { figma: { accessToken } });
          logger.info('credentials_saved', { provider: 'figma' });
        }
      }

      setSessionCookie(res, id);
      const updated = await getSession(id);
      logger.info('credentials_save_success', { providers });
      return res.json(sessionStatus(updated));
    } catch (err) {
      if (err instanceof AppError) throw err;
      const message =
        (err as Error).name === 'AbortError'
          ? 'Upstream validation timed out'
          : `Failed to save credentials: ${(err as Error).message}`;
      throw new AppError(502, 'Bad Gateway', message, {
        event: 'credentials_save_fail',
        fields: { reason: (err as Error).name === 'AbortError' ? 'timeout' : 'unexpected' },
      });
    }
  })
);

export default router;
