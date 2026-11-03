import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { AppPaths } from './paths.js';

// Persisted, namespaced config (REQ-CFG-01). Every key has its default in the schema (decision D2), so a missing key never needs code.
// Secrets never live here: they sit in dataDir (decision 11) and never travel in CLI args.
export const configSchema = z.object({
  db: z
    .object({
      // Strategy key (REQ-DB-02). Only sqlite exists in POC-3; a pgvector adapter joins later by extending this enum.
      engine: z.enum(['sqlite']).default('sqlite'),
      sqlite: z
        .object({
          // Relative to dataDir; the database stays outside the SEA (REQ-DB-07).
          file: z.string().min(1).default('lan.db'),
          foreignKeys: z.boolean().default(true),
          journalMode: z.enum(['WAL', 'DELETE']).default('WAL'),
          synchronous: z.enum(['FULL', 'NORMAL']).default('FULL'),
        })
        .prefault({}),
    })
    .prefault({}),
  supervisor: z
    .object({
      // Loopback port of the supervisor status endpoint, separate from the gateway so it keeps answering while the gateway restarts.
      statusPort: z.number().int().min(1).max(65535).default(3001),
    })
    .prefault({}),
});

export type AppConfig = DeepReadonly<z.infer<typeof configSchema>>;

type DeepReadonly<T> = { readonly [K in keyof T]: DeepReadonly<T[K]> };

export const CONFIG_FILE = 'config.json';
export const CONFIG_DEFAULT_FILE = 'config.default.json';

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

// First start (REQ-CFG-05): create config.json under the root. The install dir stays read-only.
function ensureConfigFile(paths: AppPaths): string {
  const target = join(paths.configDir, CONFIG_FILE);
  if (existsSync(target)) return target;
  mkdirSync(paths.configDir, { recursive: true });
  const shipped = join(paths.installDir, CONFIG_DEFAULT_FILE);
  if (existsSync(shipped)) copyFileSync(shipped, target);
  else writeFileSync(target, `${JSON.stringify(configSchema.parse({}), null, 2)}\n`, { flag: 'wx' });
  return target;
}

// Reads the file and validates it; invalid config fails fast before readiness (REQ-DB-06).
export function loadConfig(paths: AppPaths): AppConfig {
  const file = ensureConfigFile(paths);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`config ${file} is not valid JSON: ${(error as Error).message}`);
  }
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`config ${file} is invalid: ${z.prettifyError(parsed.error)}`);
  return deepFreeze(parsed.data);
}

let current: AppConfig | undefined;

// One immutable config per process (REQ-CFG-06). The app reads it only through getConfig (REQ-CFG-02).
export function initConfig(paths: AppPaths): AppConfig {
  if (current !== undefined) throw new Error('config is already initialized');
  current = loadConfig(paths);
  return current;
}

export function getConfig(): AppConfig {
  if (current === undefined) throw new Error('config is not initialized');
  return current;
}
