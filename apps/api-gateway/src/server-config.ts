import { createZodDto } from 'nestjs-zod';
import { parseArgs } from 'node:util';
import { z } from 'zod';

// Same mechanics as the persisted namespaces (DbConfig, NetConfig, TlsConfig): a nestjs-zod DTO whose part sits under `namespace`.
// Only what the supervisor passes. The address and ports come from the persisted config `net` block.
export class ServerConfig extends createZodDto(
  z.strictObject({
    // "none" (default, dev case) serves no web. "ipc": the parent process sends the web bundle over the IPC channel.
    web: z.enum(['none', 'ipc']).default('none'),
  }),
) {
  static readonly namespace = 'server';

  // Picks only its own options from argv (other flags, such as --service, are ignored). It validates nothing: the namespace schema above is the one validation. No process.env is read.
  static fromArgv(argv: readonly string[]): { web: string | boolean | undefined } {
    const { values } = parseArgs({
      args: [...argv],
      options: { web: { type: 'string' } },
      strict: false,
    });
    return { web: values.web };
  }
}
