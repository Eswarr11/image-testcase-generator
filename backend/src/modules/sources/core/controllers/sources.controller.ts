import { Router, Request, Response } from 'express';
import { getSession, SESSION_COOKIE } from '../../../session/core/repositories/session.repository';
import { fetchConfluenceContent } from '../services/confluence.service';
import { fetchFigmaContent } from '../services/figma.service';
import { resolveAtlassianAuth } from '../services/atlassian-auth.service';
import { figmaFetch } from '../../../../utils/figmaFetch';
import { AppError } from '../../../../exceptions/AppError';
import { SourceServiceError } from '../../../../exceptions/SourceServiceError';
import { asyncHandler } from '../../../../utils/asyncHandler';

const router = Router();

function readCookieSessionId(req: Request): string | undefined {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[SESSION_COOKIE];
}

function requireSession(req: Request) {
  const session = getSession(readCookieSessionId(req));
  if (!session) {
    throw new AppError(
      401,
      'Unauthorized',
      'No credential session. Save credentials in the Credentials panel first.',
      { event: 'sources_reject', fields: { reason: 'no_session' } }
    );
  }
  return session;
}

router.post(
  '/validate-atlassian',
  asyncHandler(async (req: Request, res: Response) => {
    const session = requireSession(req);
    if (!session.atlassian) {
      throw new AppError(
        401,
        'Unauthorized',
        'Atlassian credentials not saved in this session',
        { event: 'validate_atlassian_fail', fields: { reason: 'missing_credentials' } }
      );
    }
    const result = await resolveAtlassianAuth({
      siteUrl: session.atlassian.siteUrl,
      email: session.atlassian.email,
      token: session.atlassian.apiToken,
    });
    if ('error' in result) {
      throw new AppError(401, 'Unauthorized', result.error, {
        event: 'validate_atlassian_fail',
        fields: { reason: 'auth_failed' },
      });
    }
    return res.json({
      ok: true,
      mode: result.resolved.mode,
      ...(result.displayName ? { displayName: result.displayName } : {}),
    });
  })
);

router.post(
  '/validate-figma',
  asyncHandler(async (req: Request, res: Response) => {
    const session = requireSession(req);
    if (!session.figma?.accessToken) {
      throw new AppError(
        401,
        'Unauthorized',
        'Figma token not saved in this session',
        { event: 'validate_figma_fail', fields: { reason: 'missing_credentials' } }
      );
    }
    const me = await figmaFetch('https://api.figma.com/v1/me', session.figma.accessToken, 30_000);
    if (!me.ok) {
      throw new AppError(401, 'Unauthorized', 'Figma token was rejected', {
        event: 'validate_figma_fail',
        fields: { reason: 'rejected', status: me.status },
      });
    }
    const data = await me.json() as { email?: string; handle?: string };
    return res.json({
      ok: true,
      ...(data.email ? { email: data.email } : {}),
      ...(data.handle ? { handle: data.handle } : {}),
    });
  })
);

router.post(
  '/confluence',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const session = requireSession(req);
      if (!session.atlassian) {
        throw new AppError(
          401,
          'Unauthorized',
          'Save Atlassian credentials in the Credentials panel first',
          { event: 'sources_reject', fields: { source: 'confluence', reason: 'missing_credentials' } }
        );
      }
      const pageUrl = String(req.body?.pageUrl || '').trim();
      if (!pageUrl) {
        throw new AppError(400, 'Bad Request', 'pageUrl is required', {
          event: 'sources_reject',
          fields: { source: 'confluence', reason: 'missing_url' },
        });
      }
      const result = await fetchConfluenceContent(pageUrl, {
        siteUrl: session.atlassian.siteUrl,
        email: session.atlassian.email,
        token: session.atlassian.apiToken,
      });
      return res.json(result);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new SourceServiceError(
        502,
        'Bad Gateway',
        (err as Error).message || 'Upstream request failed',
        { event: 'confluence_fetch_fail', fields: { reason: 'unexpected' } }
      );
    }
  })
);

router.post(
  '/figma',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const session = requireSession(req);
      if (!session.figma?.accessToken) {
        throw new AppError(
          401,
          'Unauthorized',
          'Save a Figma token in the Credentials panel first',
          { event: 'sources_reject', fields: { source: 'figma', reason: 'missing_credentials' } }
        );
      }
      const figmaUrl = String(req.body?.figmaUrl || '').trim();
      if (!figmaUrl) {
        throw new AppError(400, 'Bad Request', 'figmaUrl is required', {
          event: 'sources_reject',
          fields: { source: 'figma', reason: 'missing_url' },
        });
      }
      const selectedFrameIds = Array.isArray(req.body?.selectedFrameIds)
        ? (req.body.selectedFrameIds as unknown[]).map((id) => String(id)).filter(Boolean)
        : undefined;
      const result = await fetchFigmaContent(figmaUrl, session.figma.accessToken, {
        ...(selectedFrameIds && selectedFrameIds.length > 0 ? { selectedFrameIds } : {}),
      });
      return res.json(result);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new SourceServiceError(
        502,
        'Bad Gateway',
        (err as Error).message || 'Upstream request failed',
        { event: 'figma_fetch_fail', fields: { reason: 'unexpected' } }
      );
    }
  })
);

export default router;
