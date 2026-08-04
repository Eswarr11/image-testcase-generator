import { Router, Request, Response } from 'express';
import { getSession, SESSION_COOKIE } from '../session/vault';
import { fetchConfluenceContent, SourceServiceError } from '../services/confluence';
import { fetchFigmaContent } from '../services/figma';
import { resolveAtlassianAuth } from '../utils/atlassianAuth';
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

function requireSession(req: Request) {
  const session = getSession(readCookieSessionId(req));
  if (!session) {
    throw new SourceServiceError(
      401,
      'Unauthorized',
      'No credential session. Save credentials in the Credentials panel first.'
    );
  }
  return session;
}

function sendServiceError(res: Response, err: unknown) {
  if (err instanceof SourceServiceError) {
    if (err.status === 429) res.setHeader('Retry-After', '60');
    return res.status(err.status).json({ error: err.code, message: err.message });
  }
  return res.status(502).json({
    error: 'Bad Gateway',
    message: (err as Error).message || 'Upstream request failed',
  });
}

router.post('/validate-atlassian', async (req: Request, res: Response) => {
  try {
    const session = requireSession(req);
    if (!session.atlassian) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Atlassian credentials not saved in this session',
      });
    }
    const result = await resolveAtlassianAuth({
      siteUrl: session.atlassian.siteUrl,
      email: session.atlassian.email,
      token: session.atlassian.apiToken,
    });
    if ('error' in result) {
      return res.status(401).json({ error: 'Unauthorized', message: result.error });
    }
    return res.json({
      ok: true,
      mode: result.resolved.mode,
      ...(result.displayName ? { displayName: result.displayName } : {}),
    });
  } catch (err) {
    return sendServiceError(res, err);
  }
});

router.post('/validate-figma', async (req: Request, res: Response) => {
  try {
    const session = requireSession(req);
    if (!session.figma?.accessToken) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Figma token not saved in this session',
      });
    }
    const me = await figmaFetch('https://api.figma.com/v1/me', session.figma.accessToken, 30_000);
    if (!me.ok) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Figma token was rejected',
      });
    }
    const data = await me.json() as { email?: string; handle?: string };
    return res.json({
      ok: true,
      ...(data.email ? { email: data.email } : {}),
      ...(data.handle ? { handle: data.handle } : {}),
    });
  } catch (err) {
    return sendServiceError(res, err);
  }
});

router.post('/confluence', async (req: Request, res: Response) => {
  try {
    const session = requireSession(req);
    if (!session.atlassian) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Save Atlassian credentials in the Credentials panel first',
      });
    }
    const pageUrl = String(req.body?.pageUrl || '').trim();
    if (!pageUrl) {
      return res.status(400).json({ error: 'Bad Request', message: 'pageUrl is required' });
    }
    const result = await fetchConfluenceContent(pageUrl, {
      siteUrl: session.atlassian.siteUrl,
      email: session.atlassian.email,
      token: session.atlassian.apiToken,
    });
    return res.json(result);
  } catch (err) {
    return sendServiceError(res, err);
  }
});

router.post('/figma', async (req: Request, res: Response) => {
  try {
    const session = requireSession(req);
    if (!session.figma?.accessToken) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Save a Figma token in the Credentials panel first',
      });
    }
    const figmaUrl = String(req.body?.figmaUrl || '').trim();
    if (!figmaUrl) {
      return res.status(400).json({ error: 'Bad Request', message: 'figmaUrl is required' });
    }
    const result = await fetchFigmaContent(figmaUrl, session.figma.accessToken);
    return res.json(result);
  } catch (err) {
    return sendServiceError(res, err);
  }
});

export default router;
