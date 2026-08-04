import crypto from 'crypto';

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

const vault = new Map<string, SessionRecord>();

function pruneExpired(): void {
  const now = Date.now();
  for (const [id, record] of vault.entries()) {
    if (record.expiresAt <= now) vault.delete(id);
  }
}

setInterval(pruneExpired, 60 * 60 * 1000).unref?.();

export function createSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function getSession(sessionId: string | undefined | null): SessionRecord | null {
  if (!sessionId) return null;
  pruneExpired();
  const record = vault.get(sessionId);
  if (!record) return null;
  if (record.expiresAt <= Date.now()) {
    vault.delete(sessionId);
    return null;
  }
  // sliding TTL
  record.expiresAt = Date.now() + TTL_MS;
  return record;
}

export function ensureSession(sessionId: string | undefined | null): { id: string; record: SessionRecord } {
  const existing = getSession(sessionId);
  if (existing && sessionId) {
    return { id: sessionId, record: existing };
  }
  const id = createSessionId();
  const record: SessionRecord = {
    openai: null,
    atlassian: null,
    figma: null,
    expiresAt: Date.now() + TTL_MS,
  };
  vault.set(id, record);
  return { id, record };
}

export function updateSession(
  sessionId: string,
  patch: Partial<Pick<SessionRecord, 'openai' | 'atlassian' | 'figma'>>
): SessionRecord | null {
  const record = getSession(sessionId);
  if (!record) return null;
  if (patch.openai !== undefined) record.openai = patch.openai;
  if (patch.atlassian !== undefined) record.atlassian = patch.atlassian;
  if (patch.figma !== undefined) record.figma = patch.figma;
  record.expiresAt = Date.now() + TTL_MS;
  return record;
}

export function clearSession(sessionId: string | undefined | null): void {
  if (sessionId) vault.delete(sessionId);
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
