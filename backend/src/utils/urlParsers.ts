export interface ParsedConfluenceUrl {
  contentId: string;
  spaceKey?: string;
  originalUrl: string;
}

export interface ParsedFigmaUrl {
  fileKey: string;
  nodeId?: string;
  originalUrl: string;
}

/**
 * Parse Confluence Cloud page URLs:
 * - https://site.atlassian.net/wiki/spaces/SPACE/pages/123456/Title
 * - https://site.atlassian.net/wiki/spaces/SPACE/pages/123456
 * - ...?pageId=123456
 */
export function parseConfluenceUrl(pageUrl: string): ParsedConfluenceUrl {
  const trimmed = pageUrl.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('Invalid Confluence URL');
  }

  const pageIdParam = url.searchParams.get('pageId');
  if (pageIdParam && /^\d+$/.test(pageIdParam)) {
    return { contentId: pageIdParam, originalUrl: trimmed };
  }

  const pagesMatch = url.pathname.match(/\/pages\/(\d+)/);
  if (pagesMatch?.[1]) {
    const spaceMatch = url.pathname.match(/\/spaces\/([^/]+)/);
    return {
      contentId: pagesMatch[1],
      ...(spaceMatch?.[1] ? { spaceKey: decodeURIComponent(spaceMatch[1]) } : {}),
      originalUrl: trimmed,
    };
  }

  throw new Error(
    'Could not parse Confluence page URL. Expected .../wiki/spaces/.../pages/{id}/... or ?pageId='
  );
}

/**
 * Parse Figma design URLs:
 * - https://www.figma.com/design/:fileKey/Name?node-id=1-2
 * - https://www.figma.com/file/:fileKey/Name?node-id=1-2
 * - https://www.figma.com/proto/:fileKey/...
 */
export function parseFigmaUrl(figmaUrl: string): ParsedFigmaUrl {
  const trimmed = figmaUrl.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('Invalid Figma URL');
  }

  if (!url.hostname.includes('figma.com')) {
    throw new Error('URL must be a figma.com link');
  }

  const pathMatch = url.pathname.match(/\/(design|file|proto)\/([a-zA-Z0-9]+)/);
  if (!pathMatch?.[2]) {
    throw new Error(
      'Could not parse Figma URL. Expected .../design/:fileKey/... or .../file/:fileKey/...'
    );
  }

  const fileKey = pathMatch[2];
  const rawNodeId = url.searchParams.get('node-id');
  return {
    fileKey,
    ...(rawNodeId ? { nodeId: rawNodeId.replace(/-/g, ':') } : {}),
    originalUrl: trimmed,
  };
}
