import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { jsonText } from 'service-registry';
import { z } from 'zod';
import type { AppPaths } from './paths.js';
import { HOST_NAME_PATTERN } from './tls/san.js';

// Persisted, namespaced config (REQ-CFG-01). Nothing is defaulted: a missing or invalid key stops the start (ADR-007).
// Secrets never live here: they sit in dataDir (decision 11) and never travel in CLI args.
// `engine` selects exactly one block (REQ-DB-02); a new engine adds one strictObject variant here.
const plainFileName = z
  .string()
  .regex(/^(?!\.+$)[\w.-]+$/, "a plain file name inside the data directory: no path separators, no '..'");

const port = z.int().min(1).max(65535);

const dbSchema = z.discriminatedUnion('engine', [
  z.strictObject({
    engine: z.literal('sqlite'),
    sqlite: z.strictObject({
      // Relative to dataDir; the database stays outside the SEA (REQ-DB-07).
      file: plainFileName,
      foreignKeys: z.boolean(),
      journalMode: z.enum(['WAL', 'DELETE']),
      synchronous: z.enum(['FULL', 'NORMAL']),
    }),
  }),
  z.strictObject({
    engine: z.literal('pg'),
    pg: z.strictObject({
      host: z.union([z.ipv4(), z.ipv6(), z.string().max(253).regex(HOST_NAME_PATTERN, 'a DNS host name or an IP address')]),
      port,
      database: z.string().min(1).max(63),
      user: z.string().min(1).max(63),
      // The password is a secret, so it lives in a file inside dataDir (decision 11), never in this file.
      passwordFile: plainFileName,
    }),
  }),
]);

// Network binding for the HTTPS listener and the plain-HTTP redirect listener.
const netSchema = z.strictObject({
  bind: z.union([z.ipv4(), z.ipv6()]),
  httpsPort: port,
  httpPort: port,
});

// Names added to the certificate on top of the detected ones: DNS names or IP addresses.
const tlsSchema = z.strictObject({
  extraNames: z.array(
    z.union([z.ipv4(), z.ipv6(), z.string().max(253).regex(HOST_NAME_PATTERN, 'a DNS host name or an IP address')]),
  ),
});

export const configSchema = z.strictObject({ db: dbSchema, net: netSchema, tls: tlsSchema });

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
