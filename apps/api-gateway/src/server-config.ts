import { createZodDto } from 'nestjs-zod';
import { parseArgs } from 'node:util';
import { z } from 'zod';

// Only what the supervisor passes. The address and ports come from the persisted config `net` block.
export const serverConfigSchema = z.strictObject({
  // "none" (default, dev case) serves no web. "ipc": the parent process sends the web bundle over the IPC channel.
  web: z.enum(['none', 'ipc']).default('none'),
});

// Same mechanics as the persisted namespaces (DbConfig, NetConfig, TlsConfig): a nestjs-zod DTO whose part sits under `namespace`.
export class ServerConfig extends createZodDto(serverConfigSchema) {
  static readonly namespace = 'server';
}

// Parses only its own options from argv (other flags, such as --service, are ignored). No process.env is read.
export function parseServerConfig(argv: readonly string[]): z.output<typeof serverConfigSchema> {
  const { values } = parseArgs({
    args: [...argv],
    options: { web: { type: 'string' } },
    strict: false,
  });
  return serverConfigSchema.parse({ web: values.web });
}
