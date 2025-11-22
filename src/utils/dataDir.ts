import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Ensure data directory exists for SQLite database
 */
export function ensureDataDirectory(): void {
  const dataDir = join(process.cwd(), 'data');
  
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
    console.log('📁 Created data directory:', dataDir);
  }
}
