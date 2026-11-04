import { hostname, networkInterfaces } from 'node:os';
import { isSea } from 'node:sea';
import { join } from 'node:path';
import { derivePaths, resolveBase } from '../paths.js';
import { loadConfig } from '../config.js';
import { generateTlsIdentity } from './generate.js';
import type { WantedNamesInput } from './san.js';

// Exit codes of the operation: 0 done, 1 error.
export const CERTS_EXIT_OK = 0;
export const CERTS_EXIT_ERROR = 1;

export interface CertsCommandInput {
  // The folder that holds `config/config.json` and `certs/`: the executable's folder in a packaged run.
  readonly base: string;
  readonly now: Date;
  readonly hostname: WantedNamesInput['hostname'];
  readonly interfaces: WantedNamesInput['interfaces'];
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}

// The operation behind `--generate-certs` of the packaged executable. It runs the same generator as `pnpm dev:certs`: it creates the CA only when ca.crt and ca.key are both absent, never replaces an existing CA and reissues only the leaf.
// It prints paths and the CA fingerprint, never key material. Not exported from `shared-core/tls`: the gateway never creates certificates (ADR-008).
export function generateCertsCommand(input: CertsCommandInput): number {
  try {
    const paths = derivePaths(input.base);
    const config = loadConfig(paths);
    const result = generateTlsIdentity({ certDir: paths.certDir, extraNames: config.tls.extraNames, now: input.now, hostname: input.hostname, interfaces: input.interfaces });
    input.out(`CA ${result.caCreated ? 'created' : 'kept'}: ${join(paths.certDir, 'ca.crt')}`);
    input.out(`CA SHA-256 ${result.caFingerprint256}`);
    input.out(result.leaf === 'issued' ? `leaf issued: ${result.reasons.join('; ')}` : 'leaf kept: names and validity are current');
    return CERTS_EXIT_OK;
  } catch (error) {
    input.err(`generate-certs: ${error instanceof Error ? error.message : String(error)}`);
    return CERTS_EXIT_ERROR;
  }
}

// Wires the real process: base from `resolveBase`, the real host name and network interfaces.
export function runGenerateCerts(): number {
  return generateCertsCommand({
    base: resolveBase({ sea: isSea(), execPath: process.execPath, cwd: process.cwd() }),
    now: new Date(),
    hostname: hostname(),
    interfaces: networkInterfaces(),
    out: (line) => console.log(line),
    err: (line) => console.error(line),
  });
}
