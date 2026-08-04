import { Router, Request, Response } from 'express';
import {
  clearSession,
  ensureSession,
  getSession,
  SESSION_COOKIE,
  sessionStatus,
  updateSession,
} from '../session/vault';
import { clearSessionCookie, setSessionCookie } from '../session/cookie';
import {
  normalizeApiToken,
  normalizeSiteUrl,
  resolveAtlassianAuth,
  fetchWithTimeout,
} from '../utils/atlassianAuth';
import { figmaFetch } from '../utils/figmaFetch';

interface ApiErrorBody {
  error: string;
  message: string;
}

const router = Router();

function readCookieSessionId(req: Request): string | undefined {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[SESSION_COOKIE];
}

router.get('/status', (req: Request, res: Response) => {
  const record = getSession(readCookieSessionId(req));
  return res.json(sessionStatus(record));
});

router.delete('/', (req: Request, res: Response) => {
  clearSession(readCookieSessionId(req));
  clearSessionCookie(res);
  return res.json({ ok: true });
});

/**
 * Save credentials into the server session vault (secrets appear only on this request).
 * Body may include any of: openai, atlassian { siteUrl, email, apiToken }, figma { accessToken }
 * Empty string / null for a provider clears it. Omit field to leave unchanged.
 */
router.post(
  '/credentials',
  async (req: Request, res: Response<ApiErrorBody | ReturnType<typeof sessionStatus>>) => {
    const body = (req.body || {}) as {
      openai?: string | null;
      atlassian?: { siteUrl?: string; email?: string; apiToken?: string } | null;
      figma?: { accessToken?: string } | null;
    };

    const { id, record } = ensureSession(readCookieSessionId(req));

    try {
      // OpenAI
      if (body.openai !== undefined) {
        if (body.openai === null || body.openai === '') {
          updateSession(id, { openai: null });
        } else {
          const key = body.openai.trim();
          if (!key.startsWith('sk-') || key.length <= 20) {
            return res.status(400).json({
              error: 'Bad Request',
              message: 'Invalid OpenAI API key format',
            });
          }
          const probe = await fetchWithTimeout('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${key}` },
          });
          if (!probe.ok) {
            return res.status(401).json({
              error: 'Unauthorized',
              message: 'OpenAI API key was rejected',
            });
          }
          updateSession(id, { openai: key });
        }
      }

      // Atlassian
      if (body.atlassian !== undefined) {
        if (body.atlassian === null) {
          updateSession(id, { atlassian: null });
        } else {
          const siteUrl = normalizeSiteUrl(String(body.atlassian.siteUrl || ''));
          const email = String(body.atlassian.email || '').trim();
          const apiToken = normalizeApiToken(String(body.atlassian.apiToken || ''));
          if (!siteUrl || !email || !apiToken) {
            return res.status(400).json({
              error: 'Bad Request',
              message: 'Atlassian requires siteUrl, email, and apiToken',
            });
          }
          const resolved = await resolveAtlassianAuth({ siteUrl, email, token: apiToken });
          if ('error' in resolved) {
            return res.status(401).json({ error: 'Unauthorized', message: resolved.error });
          }
          updateSession(id, {
            atlassian: { siteUrl, email, apiToken },
          });
        }
      }

      // Figma
      if (body.figma !== undefined) {
        if (body.figma === null) {
          updateSession(id, { figma: null });
        } else {
          const accessToken = String(body.figma.accessToken || '').trim();
          if (!accessToken) {
            return res.status(400).json({
              error: 'Bad Request',
              message: 'Figma accessToken is required',
            });
          }
          const me = await figmaFetch('https://api.figma.com/v1/me', accessToken, 30_000);
          if (!me.ok) {
            return res.status(401).json({
              error: 'Unauthorized',
              message: 'Figma token was rejected',
            });
          }
          updateSession(id, { figma: { accessToken } });
        }
      }

      setSessionCookie(res, id);
      const updated = getSession(id);
      return res.json(sessionStatus(updated));
    } catch (err) {
      const message =
        (err as Error).name === 'AbortError'
          ? 'Upstream validation timed out'
          : `Failed to save credentials: ${(err as Error).message}`;
      return res.status(502).json({ error: 'Bad Gateway', message });
    }
  }
);

export default router;
