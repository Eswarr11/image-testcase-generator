import { parseFigmaUrl } from '../utils/urlParsers';
import { truncateText } from '../utils/textExtract';
import { fetchWithTimeout } from '../utils/atlassianAuth';
import { figmaFetch, figmaRateLimitMessage, isFigmaRateLimit } from '../utils/figmaFetch';
import { SourceFetchResult, SourceServiceError } from './confluence';

const MAX_FIGMA_IMAGES = 8;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const FIGMA_EXPORT_SCALE = 2;
const MAX_TEXT_LAYERS = 300;

export interface FigmaFrameInfo {
  id: string;
  name: string;
  type: string;
}

export interface FigmaFetchOptions {
  /** If provided, only export these frame/node ids. Otherwise auto-select. */
  selectedFrameIds?: string[];
}

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  characters?: string;
  children?: FigmaNode[];
}

function isFrameLike(type: string): boolean {
  return type === 'FRAME' || type === 'COMPONENT' || type === 'COMPONENT_SET' || type === 'SECTION' || type === 'INSTANCE';
}

function collectChildFrames(node: FigmaNode, out: FigmaFrameInfo[], max: number): void {
  if (out.length >= max) return;
  if (!node.children) return;
  for (const child of node.children) {
    if (out.length >= max) break;
    if (isFrameLike(child.type)) {
      out.push({ id: child.id, name: child.name || child.id, type: child.type });
    }
    // Also look one level deeper for nested screens
    if (child.children) {
      for (const grand of child.children) {
        if (out.length >= max) break;
        if (isFrameLike(grand.type)) {
          out.push({ id: grand.id, name: grand.name || grand.id, type: grand.type });
        }
      }
    }
  }
}

function collectTopFrames(node: FigmaNode, out: FigmaFrameInfo[], max: number): void {
  if (out.length >= max) return;
  if (isFrameLike(node.type) && node.type !== 'SECTION') {
    out.push({ id: node.id, name: node.name || node.id, type: node.type });
    return;
  }
  if (node.children) {
    for (const child of node.children) {
      collectTopFrames(child, out, max);
      if (out.length >= max) break;
    }
  }
}

function collectUiSummary(node: FigmaNode, depth: number, maxDepth: number, out: string[]): void {
  if (depth > maxDepth || out.length >= MAX_TEXT_LAYERS) return;

  if (isFrameLike(node.type)) {
    out.push(`${'  '.repeat(depth)}▸ Frame: ${node.name} (${node.type})`);
  }

  if (node.type === 'TEXT' && node.characters?.trim()) {
    const label = node.name && !/^text\s*\d*$/i.test(node.name) ? node.name : 'label';
    out.push(`${'  '.repeat(depth)}- [${label}] ${node.characters.trim()}`);
  }

  // Heuristic: name patterns that look interactive
  if (
    /button|btn|tab|link|menu|nav|input|field|toggle|checkbox|radio|dropdown|select/i.test(node.name) &&
    node.type !== 'TEXT'
  ) {
    out.push(`${'  '.repeat(depth)}• Control: ${node.name} (${node.type})`);
  }

  if (node.children) {
    for (const child of node.children) {
      collectUiSummary(child, depth + 1, maxDepth, out);
      if (out.length >= MAX_TEXT_LAYERS) break;
    }
  }
}

async function imageUrlToDataUrl(imageUrl: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(imageUrl, {}, 90_000);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > MAX_IMAGE_BYTES) return null;
    const contentType = res.headers.get('content-type') || 'image/png';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

function throwFigmaHttp(status: number, detail: string, context: string): never {
  if (status === 401 || status === 403) {
    throw new SourceServiceError(
      401,
      'Unauthorized',
      'Figma denied access. Check your Personal Access Token and file permissions.'
    );
  }
  if (status === 404) {
    throw new SourceServiceError(404, 'Not Found', 'Figma file or node was not found.');
  }
  if (status === 429) {
    throw new SourceServiceError(429, 'Rate Limited', figmaRateLimitMessage());
  }
  throw new SourceServiceError(
    502,
    'Bad Gateway',
    `Figma ${context} API error (${status})${detail ? `: ${detail.slice(0, 300)}` : ''}`
  );
}

export async function fetchFigmaContent(
  figmaUrl: string,
  accessToken: string,
  options: FigmaFetchOptions = {}
): Promise<SourceFetchResult> {
  let parsed;
  try {
    parsed = parseFigmaUrl(figmaUrl);
  } catch (err) {
    throw new SourceServiceError(400, 'Bad Request', (err as Error).message);
  }

  const token = accessToken.trim();
  let fileName = parsed.fileKey;
  let target: FigmaNode | null = null;
  let nodeLabel = 'document';
  const availableFrames: FigmaFrameInfo[] = [];

  try {
    if (parsed.nodeId) {
      const nodesUrl =
        `https://api.figma.com/v1/files/${parsed.fileKey}/nodes` +
        `?ids=${encodeURIComponent(parsed.nodeId)}&depth=4`;
      const nodesRes = await figmaFetch(nodesUrl, token, 90_000);
      if (!nodesRes.ok) {
        const detail = await nodesRes.text().catch(() => '');
        throwFigmaHttp(nodesRes.status, detail, 'nodes');
      }

      const nodesJson = await nodesRes.json() as {
        name?: string;
        nodes?: Record<string, { document?: FigmaNode } | null>;
      };
      fileName = nodesJson.name || fileName;
      const nodeEntry = nodesJson.nodes?.[parsed.nodeId];
      if (nodeEntry?.document) {
        target = nodeEntry.document;
        nodeLabel = `${target.type}: ${target.name}`;
        availableFrames.push({
          id: target.id,
          name: target.name || target.id,
          type: target.type,
        });
        collectChildFrames(target, availableFrames, MAX_FIGMA_IMAGES);
      } else {
        nodeLabel = `node ${parsed.nodeId}`;
        availableFrames.push({ id: parsed.nodeId, name: parsed.nodeId, type: 'NODE' });
      }
    } else {
      const fileUrl = `https://api.figma.com/v1/files/${parsed.fileKey}?depth=3`;
      const fileRes = await figmaFetch(fileUrl, token, 90_000);
      if (!fileRes.ok) {
        const detail = await fileRes.text().catch(() => '');
        throwFigmaHttp(fileRes.status, detail, 'file');
      }

      const file = await fileRes.json() as { name?: string; document?: FigmaNode };
      fileName = file.name || fileName;
      if (!file.document) {
        throw new SourceServiceError(502, 'Bad Gateway', 'Figma file had no document tree');
      }
      target = file.document;
      nodeLabel = 'top-level frames';
      collectTopFrames(file.document, availableFrames, MAX_FIGMA_IMAGES);
      if (availableFrames.length === 0 && file.document.children?.[0]) {
        availableFrames.push({
          id: file.document.children[0].id,
          name: file.document.children[0].name || file.document.children[0].id,
          type: file.document.children[0].type,
        });
      }
    }

    // Resolve which frames to export
    let exportIds: string[];
    if (options.selectedFrameIds && options.selectedFrameIds.length > 0) {
      const allowed = new Set(availableFrames.map((f) => f.id));
      exportIds = options.selectedFrameIds.filter((id) => allowed.has(id) || !availableFrames.length);
      if (exportIds.length === 0) {
        exportIds = availableFrames.slice(0, MAX_FIGMA_IMAGES).map((f) => f.id);
      }
    } else {
      exportIds = availableFrames.slice(0, MAX_FIGMA_IMAGES).map((f) => f.id);
    }
    exportIds = [...new Set(exportIds)].slice(0, MAX_FIGMA_IMAGES);

    const uiSummary: string[] = [];
    if (target) collectUiSummary(target, 0, 8, uiSummary);

    const images: string[] = [];
    const frameImageMap: Record<string, string> = {};
    let imageNote = '';

    if (exportIds.length > 0) {
      const tryExport = async (scale: number) => {
        const imagesUrl =
          `https://api.figma.com/v1/images/${parsed.fileKey}` +
          `?ids=${encodeURIComponent(exportIds.join(','))}&format=png&scale=${scale}`;
        const imgRes = await figmaFetch(imagesUrl, token, 90_000);
        if (!imgRes.ok) {
          if (isFigmaRateLimit(imgRes)) {
            throw new SourceServiceError(429, 'Rate Limited', figmaRateLimitMessage());
          }
          const detail = await imgRes.text().catch(() => '');
          return { map: {} as Record<string, string>, err: `Image export failed (${imgRes.status}): ${detail.slice(0, 150)}` };
        }
        const imgJson = await imgRes.json() as {
          err?: string;
          images?: Record<string, string | null>;
        };
        if (imgJson.err) return { map: {} as Record<string, string>, err: imgJson.err };
        const map: Record<string, string> = {};
        for (const [id, url] of Object.entries(imgJson.images || {})) {
          if (url) map[id] = url;
        }
        return { map };
      };

      let exportResult = await tryExport(FIGMA_EXPORT_SCALE);
      const dataById: Record<string, string> = {};

      for (const [id, url] of Object.entries(exportResult.map)) {
        const dataUrl = await imageUrlToDataUrl(url);
        if (dataUrl) dataById[id] = dataUrl;
      }

      if (Object.keys(exportResult.map).length > 0 && Object.keys(dataById).length === 0 && FIGMA_EXPORT_SCALE > 1) {
        exportResult = await tryExport(1);
        for (const [id, url] of Object.entries(exportResult.map)) {
          const dataUrl = await imageUrlToDataUrl(url);
          if (dataUrl) dataById[id] = dataUrl;
        }
        if (Object.keys(dataById).length > 0) {
          imageNote = 'Used scale=1 export because higher-res images exceeded size limits.';
        }
      }

      for (const id of exportIds) {
        const dataUrl = dataById[id];
        if (dataUrl) {
          images.push(dataUrl);
          frameImageMap[id] = dataUrl;
        }
      }

      if (exportResult.err && images.length === 0) imageNote = exportResult.err;
      else if (Object.keys(exportResult.map).length > 0 && images.length === 0) {
        imageNote = 'Figma returned image URLs but downloading/encoding them failed.';
      }
    }

    const selectedSet = new Set(exportIds);
    const frames = availableFrames.map((f) => ({
      ...f,
      selected: selectedSet.has(f.id),
      ...(frameImageMap[f.id] ? { image: frameImageMap[f.id] } : {}),
    }));

    const textParts = [
      `File: ${fileName}`,
      `Focus: ${nodeLabel}`,
      `Frames available: ${availableFrames.length}`,
      `Frames exported: ${exportIds.length}`,
      '',
      availableFrames.length > 0
        ? `Frame list:\n${availableFrames.map((f) => `- ${f.name} [${f.type}] (${f.id})${selectedSet.has(f.id) ? ' ✓' : ''}`).join('\n')}`
        : '',
      '',
      uiSummary.length > 0
        ? `UI structure & text:\n${uiSummary.join('\n')}`
        : 'No UI text extracted from the selected node.',
      images.length > 0 ? `\n(${images.length} design screenshot(s) attached as images)` : '',
      imageNote ? `\n${imageNote}` : '',
    ];

    return {
      source: 'figma',
      title: fileName,
      url: parsed.originalUrl,
      text: truncateText(textParts.join('\n')),
      ...(images.length > 0 ? { images } : {}),
      frames,
    };
  } catch (err) {
    if (err instanceof SourceServiceError) throw err;
    if ((err as Error).name === 'AbortError') {
      throw new SourceServiceError(
        502,
        'Bad Gateway',
        'Figma fetch timed out. Try a link with a specific node-id=… frame.'
      );
    }
    throw new SourceServiceError(
      502,
      'Bad Gateway',
      `Failed to fetch Figma design: ${(err as Error).message}`
    );
  }
}
