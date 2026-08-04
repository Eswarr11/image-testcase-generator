import {
  atlassianGet,
  resolveAtlassianAuth,
  type AtlassianAuth,
} from '../utils/atlassianAuth';
import { parseConfluenceUrl } from '../utils/urlParsers';
import { htmlToPlainText, truncateText } from '../utils/textExtract';

export interface SourceFetchResult {
  source: 'confluence' | 'figma';
  title: string;
  url: string;
  text: string;
  images?: string[];
}

export class SourceServiceError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function fetchConfluenceContent(
  pageUrl: string,
  auth: AtlassianAuth
): Promise<SourceFetchResult> {
  let parsed;
  try {
    parsed = parseConfluenceUrl(pageUrl);
  } catch (err) {
    throw new SourceServiceError(400, 'Bad Request', (err as Error).message);
  }

  const resolvedResult = await resolveAtlassianAuth(auth);
  if ('error' in resolvedResult) {
    throw new SourceServiceError(401, 'Unauthorized', resolvedResult.error);
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
        `Confluence page ${parsed.contentId} was not found or you lack access`
      );
    }
    throw new SourceServiceError(
      502,
      'Bad Gateway',
      `Confluence API error (${upstream.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`
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

  return {
    source: 'confluence',
    title: page.title || `Page ${parsed.contentId}`,
    url: canonical || parsed.originalUrl,
    text: truncateText(parts.join('\n')),
  };
}
