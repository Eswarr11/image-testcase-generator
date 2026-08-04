import fs from 'fs';
import path from 'path';
import { createClient, type Client } from '@libsql/client';
import { env, isVercel } from '../config/env';
import { logger } from '../logger/logger';

let client: Client | null = null;
let migratePromise: Promise<void> | null = null;

function ensureLocalDbDir(url: string): void {
  if (!url.startsWith('file:')) return;
  const filePath = url.slice('file:'.length);
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

export function getDb(): Client {
  if (client) return client;

  ensureLocalDbDir(env.databaseUrl);

  const isRemote =
    env.databaseUrl.startsWith('libsql://') ||
    env.databaseUrl.startsWith('https://') ||
    Boolean(env.tursoAuthToken);

  client = createClient({
    url: env.databaseUrl,
    ...(isRemote && env.tursoAuthToken ? { authToken: env.tursoAuthToken } : {}),
  });

  if (isVercel && env.sessionEncryptionKey === 'local-dev-session-encryption-key') {
    logger.warn('session_encryption_key_default', {
      message: 'Set SESSION_ENCRYPTION_KEY in Vercel for production-safe encryption',
    });
  }

  logger.info('db_connected', {
    remote: isRemote,
    urlKind: env.databaseUrl.startsWith('file:') ? 'file' : 'remote',
  });

  return client;
}

export async function migrateDb(): Promise<void> {
  if (migratePromise) return migratePromise;

  migratePromise = (async () => {
    const db = getDb();

    // Drop legacy auth tables from older builds
    await db.execute('DROP TABLE IF EXISTS sessions');
    await db.execute('DROP TABLE IF EXISTS users');

    await db.execute(`
      CREATE TABLE IF NOT EXISTS credential_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        openai_enc TEXT,
        atlassian_enc TEXT,
        figma_enc TEXT,
        site_url TEXT,
        email TEXT,
        expires_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS source_cache (
        cache_key TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_credential_sessions_expires ON credential_sessions(expires_at)'
    );
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_source_cache_expires ON source_cache(expires_at)'
    );

    logger.info('db_migrated');
  })();

  try {
    await migratePromise;
  } catch (err) {
    migratePromise = null;
    throw err;
  }
}
