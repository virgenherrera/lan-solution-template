import { parseArgs } from 'node:util';
import { z } from 'zod';

export const SERVER_CONFIG = Symbol('SERVER_CONFIG');

export const serverConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(3000),
  hostname: z.literal('127.0.0.1').default('127.0.0.1'),
  // Absent means no static serving (dev case).
  webRoot: z.string().min(1).optional(),
});

export type ServerConfig = Readonly<z.infer<typeof serverConfigSchema>>;

// Parses only its own options from argv (other flags, such as --service, are ignored). No process.env is read.
export function parseServerConfig(argv: readonly string[]): ServerConfig {
  const { values } = parseArgs({
    args: [...argv],
    options: { 'web-root': { type: 'string' } },
    strict: false,
  });
  return Object.freeze(serverConfigSchema.parse({ webRoot: values['web-root'] }));
}
