import { hostname, networkInterfaces } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { Injectable } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';
import { EXIT_CODE } from 'service-registry';
import { derivePaths, loadConfig } from 'shared-core';
import { generateTlsIdentity } from 'shared-core/tls/generate';
import { z } from 'zod';
import { ExitError } from '../constants/exit-error.js';

// Creates and renews the TLS files of the gateway under <base>/certs/ (ADR-008, REQ-TLS-01, REQ-TLS-04). The gateway only validates them and never writes there.
// Usage: `tools-cli generate-certs [--base <dir>]`. The base is the directory that holds `config/config.json` and `certs/`: the repository root in dev (the default is the cwd), the executable's directory for a packaged binary.
// It creates the CA only when ca.crt and ca.key are both absent, never replaces an existing CA, and reissues only the leaf (missing, expired, close to expiry or with other host names). Exit codes: 0 done, 1 error.
const USAGE = 'usage: tools-cli generate-certs [--base <dir>]';
const optionsSchema = z.strictObject({ base: z.string().min(1).optional() });

@Command({
  name: 'generate-certs',
  description: 'Create or renew the CA and the leaf certificate of the gateway under <base>/certs (ADR-008, REQ-TLS-01).',
  arguments: '[args...]',
  // The command parses its own options (strict), so a wrong one keeps the retired script's message and exit 1.
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
@Injectable()
export class GenerateCertsCommand extends CommandRunner {
  override run(passedParams: string[]): Promise<void> {
    try {
      const parsed = parseArgs({ args: passedParams, options: { base: { type: 'string' } }, strict: true });
      const options = optionsSchema.parse(parsed.values);
      const paths = derivePaths(resolve(options.base ?? process.cwd()));
      const config = loadConfig(paths);
      const result = generateTlsIdentity({
        certDir: paths.certDir,
        extraNames: config.tls.extraNames,
        now: new Date(),
        hostname: hostname(),
        interfaces: networkInterfaces(),
      });
      process.stdout.write(`CA ${result.caCreated ? 'created' : 'kept'}: ${join(paths.certDir, 'ca.crt')}\n`);
      process.stdout.write(`CA SHA-256 ${result.caFingerprint256}\n`);
      process.stdout.write(`${result.leaf === 'issued' ? `leaf issued: ${result.reasons.join('; ')}` : 'leaf kept: names and validity are current'}\n`);
      if (result.caCreated) {
        process.stderr.write(
          'WARNING: a new CA was created. Every device that trusts an older CA must trust this one (pnpm dev:trust on this machine, the CA file on each phone); the older CA stays in their stores until removed.\n',
        );
      }
    } catch (error) {
      process.stderr.write(`generate-certs: ${error instanceof Error ? error.message : String(error)}\n${USAGE}\n`);
      throw new ExitError(EXIT_CODE.startupFailed);
    }
    return Promise.resolve();
  }
}
