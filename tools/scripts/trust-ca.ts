// @app trusts the generated local CA of the gateway on this machine, like `dotnet dev-certs https --trust` (ADR-008, REQ-TLS-02).
// Usage: `node tools/scripts/trust-ca.ts [--base <dir>] [--dry-run]`. The base is the directory that holds `certs/ca.crt`: the repository root in dev (the default is the cwd), the executable's directory for a packaged binary.
// It reaches this machine only. Phones still install the file by hand (docs/architecture/device-trust-guide.md). Exit codes: 0 trusted, 1 error, 2 the platform needs a manual step.
import { X509Certificate } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';

const optionsSchema = z.strictObject({ base: z.string().min(1).optional(), 'dry-run': z.boolean().optional() });

const fail = (message: string, code = 1): never => {
  console.error(`trust-ca: ${message}`);
  process.exit(code);
};

const options = (() => {
  try {
    return optionsSchema.parse(parseArgs({ options: { base: { type: 'string' }, 'dry-run': { type: 'boolean' } }, strict: true }).values);
  } catch (error) {
    return fail(`${error instanceof Error ? error.message : String(error)}\nusage: node tools/scripts/trust-ca.ts [--base <dir>] [--dry-run]`);
  }
})();
const caFile = join(resolve(options.base ?? process.cwd()), 'certs', 'ca.crt');
if (!existsSync(caFile)) fail(`${caFile} does not exist: start the gateway once so it creates the CA (pnpm dev:gateway)`);

// Refuse anything that is not a current CA certificate, so a wrong file is never trusted.
const certificate = new X509Certificate(readFileSync(caFile));
if (!certificate.ca) fail(`${caFile} is not a CA certificate`);
if (new Date(certificate.validTo) < new Date()) fail(`${caFile} expired on ${certificate.validTo}`);
console.log(`CA ${certificate.subject.replace(/\n/gu, ', ')}\nSHA-256 ${certificate.fingerprint256}\nfile ${caFile}`);

// The same calls `dotnet dev-certs https --trust` makes: the login keychain on macOS, the current user's Root store on Windows.
const loginKeychain = join(homedir(), 'Library', 'Keychains', 'login.keychain-db');
const macAlreadyTrusted = (): boolean => spawnSync('security', ['verify-cert', '-c', caFile, '-p', 'ssl'], { stdio: 'ignore' }).status === 0;
const commands: Readonly<Record<string, readonly [string, readonly string[]]>> = {
  darwin: ['security', ['add-trusted-cert', '-p', 'basic', '-p', 'ssl', '-k', loginKeychain, caFile]],
  win32: ['certutil', ['-user', '-addstore', 'Root', caFile]],
};

const command = commands[process.platform];
if (command === undefined) {
  console.error(
    [
      `trust-ca: no automatic trust for ${process.platform}: the store depends on the distribution (not verified). Examples:`,
      `  Debian or Ubuntu: sudo cp ${caFile} /usr/local/share/ca-certificates/lan-solution-local-ca.crt && sudo update-ca-certificates`,
      `  Fedora: sudo cp ${caFile} /etc/pki/ca-trust/source/anchors/ && sudo update-ca-trust`,
      '  Firefox and Chromium keep their own store: import the file in their settings.',
    ].join('\n'),
  );
  process.exit(2);
}
const [program, args] = command;
if (options['dry-run'] === true) {
  console.log(`dry run, nothing changed: ${program} ${args.join(' ')}`);
} else if (process.platform === 'darwin' && macAlreadyTrusted()) {
  console.log('already trusted: nothing to do');
} else {
  // The system asks for the user's password or Touch ID: stdio stays attached.
  execFileSync(program, [...args], { stdio: 'inherit' });
  console.log('trusted. Restart the browser, then reload the page.');
}
