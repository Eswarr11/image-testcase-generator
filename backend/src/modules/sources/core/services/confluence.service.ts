import {
  atlassianGet,
  resolveAtlassianAuth,
  type AtlassianAuth,
} from './atlassian-auth.service';
import { parseConfluenceUrl } from '../../../../utils/urlParsers';
import { htmlToPlainText, truncateText } from '../../../../utils/textExtract';
import { SourceServiceError } from '../../../../exceptions/SourceServiceError';
import { logger } from '../../../../logger/logger';
import {
  authFingerprint,
  buildSourceCacheKey,
  getCachedSource,
  setCachedSource,
} from '../../../../db/source-cache';

export interface SourceFetchResult {
  source: 'confluence' | 'figma';
  title: string;
  url: string;
  text: string;
  images?: string[];
  frames?: Array<{
    id: string;
    name: string;
    type: string;
    selected?: boolean;
    image?: string;
  }>;
}

async function fetchConfluenceContentUncached(
  pageUrl: string,
  auth: AtlassianAuth
): Promise<SourceFetchResult> {
  let parsed;
  try {
    parsed = parseConfluenceUrl(pageUrl);
  } catch (err) {
    throw new SourceServiceError(400, 'Bad Request', (err as Error).message, {
      event: 'confluence_fetch_fail',
      fields: { reason: 'invalid_url' },
    });
  }

  logger.info('confluence_fetch_start', { contentId: parsed.contentId });

  const resolvedResult = await resolveAtlassianAuth(auth);
  if ('error' in resolvedResult) {
    throw new SourceServiceError(401, 'Unauthorized', resolvedResult.error, {
      event: 'confluence_fetch_fail',
      fields: { contentId: parsed.contentId, reason: 'auth' },
    });
  }

  const { resolved } = resolvedResult;
  const upstream = await atlassianGet(
    resolved,
    'confluence',
    `/rest/api/content/${parsed.contentId}?expand=body.storage,body.view,ancestors,space`
  );

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    if (upstream.status === 404) {
      throw new SourceServiceError(
        404,
        'Not Found',
        `Confluence page ${parsed.contentId} was not found or you lack access`,
        {
          event: 'confluence_fetch_fail',
          fields: { contentId: parsed.contentId, status: upstream.status },
        }
      );
    }
    throw new SourceServiceError(
      502,
      'Bad Gateway',
      `Confluence API error (${upstream.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      {
        event: 'confluence_fetch_fail',
        fields: { contentId: parsed.contentId, status: upstream.status },
      }
    );
  }

  const page = await upstream.json() as {
    title?: string;
    _links?: { webui?: string };
    space?: { name?: string; key?: string };
    ancestors?: Array<{ title?: string }>;
    body?: { storage?: { value?: string }; view?: { value?: string } };
  };

  const html = page.body?.view?.value || page.body?.storage?.value || '';
  const plain = htmlToPlainText(html);
  const breadcrumb = (page.ancestors || [])
    .map((a) => a.title)
    .filter(Boolean)
    .join(' > ');

  const parts = [
    breadcrumb ? `Path: ${breadcrumb} > ${page.title || ''}` : '',
    page.space?.name ? `Space: ${page.space.name} (${page.space.key || ''})` : '',
    '',
    plain || '(No page body content)',
  ].filter((line, i, arr) => !(line === '' && arr[i - 1] === ''));

  const webPath = page._links?.webui || '';
  const canonical = webPath.startsWith('http')
    ? webPath
    : `${resolved.siteUrl}/wiki${webPath.startsWith('/') ? webPath : `/${webPath}`}`;

  logger.info('confluence_fetch_success', {
    contentId: parsed.contentId,
    title: page.title || `Page ${parsed.contentId}`,
  });

  return {
    source: 'confluence',
    title: page.title || `Page ${parsed.contentId}`,
    url: canonical || parsed.originalUrl,
    text: truncateText(parts.join('\n')),
  };
}

export async function fetchConfluenceContent(
  pageUrl: string,
  auth: AtlassianAuth
): Promise<SourceFetchResult> {
  const fingerprint = authFingerprint([auth.siteUrl, auth.email, auth.token]);
  const cacheKey = buildSourceCacheKey('confluence', pageUrl, fingerprint);

  const cached = await getCachedSource<SourceFetchResult>(cacheKey);
  if (cached) {
    logger.info('source_cache_hit', { kind: 'confluence' });
    return cached;
  }

  logger.info('source_cache_miss', { kind: 'confluence' });
  const result = await fetchConfluenceContentUncached(pageUrl, auth);
  await setCachedSource(cacheKey, 'confluence', result);
  return result;
}
