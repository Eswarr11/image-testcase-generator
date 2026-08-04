import crypto from 'crypto';
import { getDb } from '../../../../db/client';
import { decryptJson, decryptSecret, encryptJson, encryptSecret } from '../../../../db/crypto';
import { logger } from '../../../../logger/logger';

export interface AtlassianSessionCreds {
  siteUrl: string;
  email: string;
  apiToken: string;
}

export interface FigmaSessionCreds {
  accessToken: string;
}

export interface SessionRecord {
  openai: string | null;
  atlassian: AtlassianSessionCreds | null;
  figma: FigmaSessionCreds | null;
  expiresAt: number;
}

export interface SessionStatus {
  openai: boolean;
  atlassian: boolean;
  figma: boolean;
  siteUrl?: string;
  email?: string;
}

export const SESSION_COOKIE = 'tcg_session';
const TTL_MS = 24 * 60 * 60 * 1000;

export function createSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

function rowToRecord(row: Record<string, unknown>): SessionRecord | null {
  try {
    const openaiEnc = row.openai_enc != null ? String(row.openai_enc) : null;
    const atlassianEnc = row.atlassian_enc != null ? String(row.atlassian_enc) : null;
    const figmaEnc = row.figma_enc != null ? String(row.figma_enc) : null;

    return {
      openai: openaiEnc ? decryptSecret(openaiEnc) : null,
      atlassian: atlassianEnc ? decryptJson<AtlassianSessionCreds>(atlassianEnc) : null,
      figma: figmaEnc ? decryptJson<FigmaSessionCreds>(figmaEnc) : null,
      expiresAt: Number(row.expires_at),
    };
  } catch (err) {
    logger.error('session_decrypt_fail', { message: (err as Error).message });
    return null;
  }
}

async function touchExpiry(sessionId: string, expiresAt: number): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: 'UPDATE credential_sessions SET expires_at = ?, updated_at = ? WHERE id = ?',
    args: [expiresAt, Date.now(), sessionId],
  });
}

export async function getSession(
  sessionId: string | undefined | null
): Promise<SessionRecord | null> {
  if (!sessionId) return null;
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM credential_sessions WHERE id = ?',
    args: [sessionId],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  const expiresAt = Number(row.expires_at);
  if (expiresAt <= Date.now()) {
    await db.execute({
      sql: 'DELETE FROM credential_sessions WHERE id = ?',
      args: [sessionId],
    });
    return null;
  }

  const record = rowToRecord(row);
  if (!record) {
    await db.execute({
      sql: 'DELETE FROM credential_sessions WHERE id = ?',
      args: [sessionId],
    });
    return null;
  }

  // Sliding TTL
  record.expiresAt = Date.now() + TTL_MS;
  await touchExpiry(sessionId, record.expiresAt);
  return record;
}

export async function ensureSession(
  sessionId: string | undefined | null
): Promise<{ id: string; record: SessionRecord }> {
  const existing = await getSession(sessionId);
  if (existing && sessionId) {
    return { id: sessionId, record: existing };
  }

  const id = createSessionId();
  const now = Date.now();
  const expiresAt = now + TTL_MS;
  const record: SessionRecord = {
    openai: null,
    atlassian: null,
    figma: null,
    expiresAt,
  };

  const db = getDb();
  await db.execute({
    sql: `
      INSERT INTO credential_sessions (id, openai_enc, atlassian_enc, figma_enc, site_url, email, expires_at, updated_at)
      VALUES (?, NULL, NULL, NULL, NULL, NULL, ?, ?)
    `,
    args: [id, expiresAt, now],
  });

  return { id, record };
}

export async function updateSession(
  sessionId: string,
  patch: Partial<Pick<SessionRecord, 'openai' | 'atlassian' | 'figma'>>
): Promise<SessionRecord | null> {
  const record = await getSession(sessionId);
  if (!record) return null;

  if (patch.openai !== undefined) record.openai = patch.openai;
  if (patch.atlassian !== undefined) record.atlassian = patch.atlassian;
  if (patch.figma !== undefined) record.figma = patch.figma;
  record.expiresAt = Date.now() + TTL_MS;

  const db = getDb();
  await db.execute({
    sql: `
      UPDATE credential_sessions SET
        openai_enc = ?,
        atlassian_enc = ?,
        figma_enc = ?,
        site_url = ?,
        email = ?,
        expires_at = ?,
        updated_at = ?
      WHERE id = ?
    `,
    args: [
      record.openai ? encryptSecret(record.openai) : null,
      record.atlassian ? encryptJson(record.atlassian) : null,
      record.figma ? encryptJson(record.figma) : null,
      record.atlassian?.siteUrl ?? null,
      record.atlassian?.email ?? null,
      record.expiresAt,
      Date.now(),
      sessionId,
    ],
  });

  return record;
}

export async function clearSession(sessionId: string | undefined | null): Promise<void> {
  if (!sessionId) return;
  const db = getDb();
  await db.execute({
    sql: 'DELETE FROM credential_sessions WHERE id = ?',
    args: [sessionId],
  });
}

export function sessionStatus(record: SessionRecord | null): SessionStatus {
  if (!record) {
    return { openai: false, atlassian: false, figma: false };
  }
  return {
    openai: Boolean(record.openai?.trim()),
    atlassian: Boolean(
      record.atlassian?.siteUrl && record.atlassian?.email && record.atlassian?.apiToken
    ),
    figma: Boolean(record.figma?.accessToken?.trim()),
    ...(record.atlassian?.siteUrl ? { siteUrl: record.atlassian.siteUrl } : {}),
    ...(record.atlassian?.email ? { email: record.atlassian.email } : {}),
  };
}

export async function pruneExpiredSessions(): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: 'DELETE FROM credential_sessions WHERE expires_at <= ?',
    args: [Date.now()],
  });
}
