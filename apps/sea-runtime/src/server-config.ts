import { z } from 'zod';

export const SERVER_CONFIG = Symbol('SERVER_CONFIG');

export const serverConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(3001),
  hostname: z.literal('127.0.0.1').default('127.0.0.1'),
});

export type ServerConfig = Readonly<z.infer<typeof serverConfigSchema>>;

// Zero input for now: the schema defaults apply. POC-3 supplies a persisted config.json source.
export function parseServerConfig(input: unknown): ServerConfig {
  return Object.freeze(serverConfigSchema.parse(input));
}
