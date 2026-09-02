/**
 * A hand-rolled `.env` loader — no dependency. Reads the repo's own `.env`
 * (gitignored) into `process.env`, never overwriting a value already set,
 * and NEVER printing one. The boot banner reports presence only.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENV_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');

/** Load `.env` if it exists. Returns the names it set (never the values). */
export function loadEnv(file: string = ENV_FILE): string[] {
  if (!existsSync(file)) return [];
  const set: string[] = [];
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (process.env[key] === undefined) {
      process.env[key] = value;
      set.push(key);
    }
  }
  return set;
}
