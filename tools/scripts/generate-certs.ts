// @app creates and renews the TLS files of the gateway under <base>/certs/ (ADR-008, REQ-TLS-01, REQ-TLS-04). The gateway only validates them and never writes there.
// Usage: `node tools/scripts/generate-certs.ts [--base <dir>]`. The base is the directory that holds `config/config.json` and `certs/`: the repository root in dev (the default is the cwd), the executable's directory for a packaged binary.
// It creates the CA only when ca.crt and ca.key are both absent, never replaces an existing CA, and reissues only the leaf (missing, expired, close to expiry or with other host names). Exit codes: 0 done, 1 error.
// Needs the built library: `pnpm --filter shared-core run build` (the dev:certs script does it).
import { hostname, networkInterfaces } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';

const root = resolve(import.meta.dirname, '..', '..');
const { derivePaths, loadConfig } = (await import(join(root, 'libs', 'shared-core', 'dist', 'index.js'))) as typeof import('../../libs/shared-core/dist/index.js');
const { generateTlsIdentity } = (await import(join(root, 'libs', 'shared-core', 'dist', 'tls', 'generate.js'))) as typeof import('../../libs/shared-core/dist/tls/generate.js');

const optionsSchema = z.strictObject({ base: z.string().min(1).optional() });

const fail = (message: string): never => {
  console.error(`generate-certs: ${message}`);
  process.exit(1);
};

try {
  const options = optionsSchema.parse(parseArgs({ options: { base: { type: 'string' } }, strict: true }).values);
  const paths = derivePaths(resolve(options.base ?? process.cwd()));
  const config = loadConfig(paths);
  const result = generateTlsIdentity({ certDir: paths.certDir, extraNames: config.tls.extraNames, now: new Date(), hostname: hostname(), interfaces: networkInterfaces() });
  console.log(`CA ${result.caCreated ? 'created' : 'kept'}: ${join(paths.certDir, 'ca.crt')}`);
  console.log(`CA SHA-256 ${result.caFingerprint256}`);
  console.log(result.leaf === 'issued' ? `leaf issued: ${result.reasons.join('; ')}` : 'leaf kept: names and validity are current');
  if (result.caCreated) {
    console.warn('WARNING: a new CA was created. Every device that trusts an older CA must trust this one (pnpm dev:trust on this machine, the CA file on each phone); the older CA stays in their stores until removed.');
  }
} catch (error) {
  fail(`${error instanceof Error ? error.message : String(error)}\nusage: node tools/scripts/generate-certs.ts [--base <dir>]`);
}
