import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { jsonText } from 'service-registry';
import { z } from 'zod';
import type { AppPaths } from './paths.js';

// Persisted, namespaced config (REQ-CFG-01). Nothing is defaulted: a missing or invalid key stops the start (ADR-007).
// Secrets never live here: they sit in dataDir (decision 11) and never travel in CLI args.
// `engine` selects exactly one block (REQ-DB-02); a new engine adds one strictObject variant here.
const dbSchema = z.discriminatedUnion('engine', [
  z.strictObject({
    engine: z.literal('sqlite'),
    sqlite: z.strictObject({
      // Relative to dataDir; the database stays outside the SEA (REQ-DB-07).
      file: z
        .string()
        .regex(/^(?!\.+$)[\w.-]+$/, "a plain file name inside the data directory: no path separators, no '..'"),
      foreignKeys: z.boolean(),
      journalMode: z.enum(['WAL', 'DELETE']),
      synchronous: z.enum(['FULL', 'NORMAL']),
    }),
  }),
]);

export const configSchema = z.strictObject({ db: dbSchema });

export type AppConfig = DeepReadonly<z.infer<typeof configSchema>>;

type DeepReadonly<T> = { readonly [K in keyof T]: DeepReadonly<T[K]> };

export const CONFIG_FILE = 'config.json';

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

// Reads the file and validates it; a missing or invalid config fails fast before readiness (REQ-DB-06). Never created here: it must exist next to the executable (ADR-007).
export function loadConfig(paths: AppPaths): AppConfig {
  const file = join(paths.configDir, CONFIG_FILE);
  if (!existsSync(file)) {
    throw new Error(`config ${file} is missing: copy libs/shared-core/config.example.json to ${file} (the installer creates it in a packaged install)`);
  }
  // One error path: invalid JSON and schema failures are issues of the same list.
  const parsed = jsonText(configSchema).safeParse(readFileSync(file, 'utf8'));
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
