import { fetchWithTimeout } from '../modules/sources/core/services/atlassian-auth.service';
import { logger } from '../logger/logger';

const DEFAULT_TIMEOUT_MS = 90_000;
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 5_000;

/** Serialize Figma API calls so concurrent previews/generates don't stampede the rate limit. */
let figmaQueue: Promise<unknown> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(res: globalThis.Response): number | null {
  const header = res.headers.get('retry-after');
  if (!header) return null;
  const asSeconds = Number(header);
  if (!Number.isNaN(asSeconds) && asSeconds >= 0) {
    return Math.min(asSeconds * 1000, 60_000);
  }
  const asDate = Date.parse(header);
  if (!Number.isNaN(asDate)) {
    return Math.min(Math.max(asDate - Date.now(), 0), 60_000);
  }
  return null;
}

/**
 * Figma GET with queue + 429 retry (honors Retry-After when present).
 */
export async function figmaFetch(
  url: string,
  token: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<globalThis.Response> {
  const run = async (): Promise<globalThis.Response> => {
    let lastRes: globalThis.Response | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const res = await fetchWithTimeout(
        url,
        { headers: { 'X-Figma-Token': token } },
        timeoutMs
      );
      lastRes = res;

      if (res.status !== 429) {
        return res;
      }

      if (attempt === MAX_RETRIES) {
        break;
      }

      const retryAfter = parseRetryAfterMs(res);
      const delay =
        retryAfter ??
        BASE_DELAY_MS * Math.pow(2, attempt) + Math.floor(Math.random() * 500);
      logger.warn('figma_rate_limit_retry', {
        url,
        attempt: attempt + 1,
        maxRetries: MAX_RETRIES,
        delayMs: delay,
      });
      // Consume body so the connection can close cleanly
      await res.text().catch(() => '');
      await sleep(delay);
    }

    return lastRes as globalThis.Response;
  };

  const queued = figmaQueue.then(run, run);
  // Keep queue going even if this request fails
  figmaQueue = queued.then(
    () => undefined,
    () => undefined
  );
  return queued;
}

export function isFigmaRateLimit(res: globalThis.Response): boolean {
  return res.status === 429;
}

export function figmaRateLimitMessage(): string {
  return (
    'Figma rate limit exceeded. Wait about a minute, then try again. ' +
    'Previewing/generating many links quickly uses up the limit.'
  );
}
