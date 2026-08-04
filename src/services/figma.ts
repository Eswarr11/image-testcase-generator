import { parseFigmaUrl } from '../utils/urlParsers';
import { truncateText } from '../utils/textExtract';
import { fetchWithTimeout } from '../utils/atlassianAuth';
import { figmaFetch, figmaRateLimitMessage, isFigmaRateLimit } from '../utils/figmaFetch';
import { SourceFetchResult, SourceServiceError } from './confluence';

const MAX_FIGMA_IMAGES = 3;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const FIGMA_EXPORT_SCALE = 2;

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  characters?: string;
  children?: FigmaNode[];
}

function collectTextLayers(node: FigmaNode, depth: number, maxDepth: number, out: string[]): void {
  if (depth > maxDepth) return;
  if (node.type === 'TEXT' && node.characters?.trim()) {
    out.push(`- [${node.name}] ${node.characters.trim()}`);
  }
  if (node.children) {
    for (const child of node.children) {
      collectTextLayers(child, depth + 1, maxDepth, out);
    }
  }
}

function collectTopFrames(node: FigmaNode, out: FigmaNode[]): void {
  if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
    out.push(node);
    return;
  }
  if (node.children) {
    for (const child of node.children) {
      collectTopFrames(child, out);
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

export async function fetchFigmaContent(
  figmaUrl: string,
  accessToken: string
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
  const textLayers: string[] = [];
  const imageNodeIds: string[] = [];

  try {
    if (parsed.nodeId) {
      const nodesUrl =
        `https://api.figma.com/v1/files/${parsed.fileKey}/nodes` +
        `?ids=${encodeURIComponent(parsed.nodeId)}&depth=2`;
      const nodesRes = await figmaFetch(nodesUrl, token, 90_000);
      if (!nodesRes.ok) {
        const detail = await nodesRes.text().catch(() => '');
        if (nodesRes.status === 401 || nodesRes.status === 403) {
          throw new SourceServiceError(
            401,
            'Unauthorized',
            'Figma denied access. Check your Personal Access Token and that it can open this file.'
          );
        }
        if (nodesRes.status === 404) {
          throw new SourceServiceError(404, 'Not Found', 'Figma file or node was not found.');
        }
        if (isFigmaRateLimit(nodesRes)) {
          throw new SourceServiceError(429, 'Rate Limited', figmaRateLimitMessage());
        }
        throw new SourceServiceError(
          502,
          'Bad Gateway',
          `Figma nodes API error (${nodesRes.status})${detail ? `: ${detail.slice(0, 300)}` : ''}`
        );
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
        imageNodeIds.push(parsed.nodeId);
      } else {
        nodeLabel = `node ${parsed.nodeId} (exporting screenshot only)`;
        imageNodeIds.push(parsed.nodeId);
      }
    } else {
      const fileUrl = `https://api.figma.com/v1/files/${parsed.fileKey}?depth=2`;
      const fileRes = await figmaFetch(fileUrl, token, 90_000);
      if (!fileRes.ok) {
        const detail = await fileRes.text().catch(() => '');
        if (fileRes.status === 401 || fileRes.status === 403) {
          throw new SourceServiceError(
            401,
            'Unauthorized',
            'Figma denied access. Check your Personal Access Token and file permissions.'
          );
        }
        if (fileRes.status === 404) {
          throw new SourceServiceError(404, 'Not Found', 'Figma file was not found.');
        }
        if (isFigmaRateLimit(fileRes)) {
          throw new SourceServiceError(429, 'Rate Limited', figmaRateLimitMessage());
        }
        throw new SourceServiceError(
          502,
          'Bad Gateway',
          `Figma file API error (${fileRes.status})${detail ? `: ${detail.slice(0, 300)}` : ''}`
        );
      }

      const file = await fileRes.json() as { name?: string; document?: FigmaNode };
      fileName = file.name || fileName;
      if (!file.document) {
        throw new SourceServiceError(502, 'Bad Gateway', 'Figma file had no document tree');
      }
      target = file.document;
      nodeLabel = 'top-level frames';
      const frames: FigmaNode[] = [];
      collectTopFrames(file.document, frames);
      for (const frame of frames.slice(0, MAX_FIGMA_IMAGES)) {
        imageNodeIds.push(frame.id);
      }
      if (imageNodeIds.length === 0 && file.document.children?.[0]) {
        imageNodeIds.push(file.document.children[0].id);
      }
    }

    if (target) collectTextLayers(target, 0, 12, textLayers);

    const images: string[] = [];
    let imageNote = '';

    if (imageNodeIds.length > 0) {
      const idsParam = imageNodeIds.slice(0, MAX_FIGMA_IMAGES).join(',');
      const tryExport = async (scale: number) => {
        const imagesUrl =
          `https://api.figma.com/v1/images/${parsed.fileKey}` +
          `?ids=${encodeURIComponent(idsParam)}&format=png&scale=${scale}`;
        const imgRes = await figmaFetch(imagesUrl, token, 90_000);
        if (!imgRes.ok) {
          if (isFigmaRateLimit(imgRes)) {
            throw new SourceServiceError(429, 'Rate Limited', figmaRateLimitMessage());
          }
          const detail = await imgRes.text().catch(() => '');
          return { urls: [] as string[], err: `Image export failed (${imgRes.status}): ${detail.slice(0, 150)}` };
        }
        const imgJson = await imgRes.json() as {
          err?: string;
          images?: Record<string, string | null>;
        };
        if (imgJson.err) return { urls: [] as string[], err: imgJson.err };
        return {
          urls: Object.values(imgJson.images || {}).filter((u): u is string => Boolean(u)),
        };
      };

      let exportResult = await tryExport(FIGMA_EXPORT_SCALE);
      let dataUrls: string[] = [];
      for (const u of exportResult.urls.slice(0, MAX_FIGMA_IMAGES)) {
        const dataUrl = await imageUrlToDataUrl(u);
        if (dataUrl) dataUrls.push(dataUrl);
      }

      if (exportResult.urls.length > 0 && dataUrls.length === 0 && FIGMA_EXPORT_SCALE > 1) {
        exportResult = await tryExport(1);
        for (const u of exportResult.urls.slice(0, MAX_FIGMA_IMAGES)) {
          const dataUrl = await imageUrlToDataUrl(u);
          if (dataUrl) dataUrls.push(dataUrl);
        }
        if (dataUrls.length > 0) {
          imageNote = 'Used scale=1 export because higher-res images exceeded size limits.';
        }
      }

      images.push(...dataUrls);
      if (exportResult.err && images.length === 0) imageNote = exportResult.err;
      else if (exportResult.urls.length > 0 && images.length === 0) {
        imageNote = 'Figma returned image URLs but downloading/encoding them failed.';
      }
    }

    const textParts = [
      `File: ${fileName}`,
      `Focus: ${nodeLabel}`,
      '',
      textLayers.length > 0
        ? `Text layers:\n${textLayers.slice(0, 200).join('\n')}`
        : 'No text layers extracted from the selected node (screenshot may still be attached).',
      images.length > 0 ? `\n(${images.length} design screenshot(s) attached as images)` : '',
      imageNote ? `\n${imageNote}` : '',
    ];

    return {
      source: 'figma',
      title: fileName,
      url: parsed.originalUrl,
      text: truncateText(textParts.join('\n')),
      ...(images.length > 0 ? { images } : {}),
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
