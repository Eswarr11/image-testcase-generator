import crypto from 'crypto';
import { getDb } from './client';
import { logger } from '../logger/logger';

const CONFLUENCE_TTL_MS = 60 * 60 * 1000;
const FIGMA_TTL_MS = 30 * 60 * 1000;
const MAX_CACHE_BYTES = 2 * 1024 * 1024;

export type SourceCacheKind = 'confluence' | 'figma';

export function buildSourceCacheKey(
  kind: SourceCacheKind,
  url: string,
  authFingerprint: string,
  selectedFrameIds?: string[]
): string {
  const frames = (selectedFrameIds || []).slice().sort().join(',');
  return crypto
    .createHash('sha256')
    .update(`${kind}|${url.trim()}|${authFingerprint}|${frames}`)
    .digest('hex');
}

/** Short non-reversible fingerprint of credentials for cache scoping */
export function authFingerprint(parts: string[]): string {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
}

export async function getCachedSource<T>(cacheKey: string): Promise<T | null> {
  const db = getDb();
  const now = Date.now();
  const result = await db.execute({
    sql: 'SELECT payload_json, expires_at FROM source_cache WHERE cache_key = ?',
    args: [cacheKey],
  });
  const row = result.rows[0];
  if (!row) return null;

  const expiresAt = Number(row.expires_at);
  if (expiresAt <= now) {
    await db.execute({
      sql: 'DELETE FROM source_cache WHERE cache_key = ?',
      args: [cacheKey],
    });
    return null;
  }

  try {
    return JSON.parse(String(row.payload_json)) as T;
  } catch {
    await db.execute({
      sql: 'DELETE FROM source_cache WHERE cache_key = ?',
      args: [cacheKey],
    });
    return null;
  }
}

export async function setCachedSource(
  cacheKey: string,
  kind: SourceCacheKind,
  payload: unknown
): Promise<void> {
  const json = JSON.stringify(payload);
  if (Buffer.byteLength(json, 'utf8') > MAX_CACHE_BYTES) {
    logger.info('source_cache_skip', { kind, reason: 'payload_too_large' });
    return;
  }

  const ttl = kind === 'figma' ? FIGMA_TTL_MS : CONFLUENCE_TTL_MS;
  const now = Date.now();
  const db = getDb();
  await db.execute({
    sql: `
      INSERT INTO source_cache (cache_key, kind, payload_json, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET
        payload_json = excluded.payload_json,
        expires_at = excluded.expires_at,
        created_at = excluded.created_at
    `,
    args: [cacheKey, kind, json, now + ttl, now],
  });
}

export async function pruneExpiredSourceCache(): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: 'DELETE FROM source_cache WHERE expires_at <= ?',
    args: [Date.now()],
  });
}
