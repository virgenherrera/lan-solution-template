import { parseArgs } from 'node:util';
import { z } from 'zod';

export const SERVER_CONFIG = Symbol('SERVER_CONFIG');

// Only what the supervisor passes. The address and ports come from the persisted config `net` block.
export const serverConfigSchema = z.strictObject({
  // "none" (default, dev case) serves no web. "ipc": the parent process sends the web bundle over the IPC channel.
  web: z.enum(['none', 'ipc']).default('none'),
});

export type ServerConfig = Readonly<z.infer<typeof serverConfigSchema>>;

// Parses only its own options from argv (other flags, such as --service, are ignored). No process.env is read.
export function parseServerConfig(argv: readonly string[]): ServerConfig {
  const { values } = parseArgs({
    args: [...argv],
    options: { web: { type: 'string' } },
    strict: false,
  });
  return Object.freeze(serverConfigSchema.parse({ web: values.web }));
}
