import { execFileSync, spawnSync } from 'node:child_process';
import { X509Certificate } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { Injectable } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';
import { EXIT_CODE } from 'service-registry';
import { z } from 'zod';
import { ExitError } from '../constants/exit-error.js';

// Trusts the generated local CA of the gateway on this machine, like `dotnet dev-certs https --trust` (ADR-008, REQ-TLS-02).
// Usage: `tools-cli trust-ca [--base <dir>] [--dry-run]`. The base is the directory that holds `certs/ca.crt`: the repository root in dev (the default is the cwd), the executable's directory for a packaged binary.
// It reaches this machine only. Phones still install the file by hand (docs/architecture/device-trust-guide.md). Exit codes: 0 trusted, 1 error, 2 the platform needs a manual step.
const USAGE = 'usage: tools-cli trust-ca [--base <dir>] [--dry-run]';
const optionsSchema = z.strictObject({ base: z.string().min(1).optional(), 'dry-run': z.boolean().optional() });

// The same calls `dotnet dev-certs https --trust` makes: the login keychain on macOS, the current user's Root store on Windows.
const commandFor = (platform: string, caFile: string): readonly [string, readonly string[]] | undefined => {
  const loginKeychain = join(homedir(), 'Library', 'Keychains', 'login.keychain-db');
  const commands: Readonly<Record<string, readonly [string, readonly string[]]>> = {
    darwin: ['security', ['add-trusted-cert', '-p', 'basic', '-p', 'ssl', '-k', loginKeychain, caFile]],
    win32: ['certutil', ['-user', '-addstore', 'Root', caFile]],
  };
  return commands[platform];
};

@Command({
  name: 'trust-ca',
  description: 'Trust the generated local CA of the gateway in the OS store of this machine (ADR-008, REQ-TLS-02).',
  arguments: '[args...]',
  // The command parses its own options (strict), so a wrong one keeps the retired script's message and exit 1.
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
@Injectable()
export class TrustCaCommand extends CommandRunner {
  override run(passedParams: string[]): Promise<void> {
    const options = this.parseOptions(passedParams);
    const caFile = join(resolve(options.base ?? process.cwd()), 'certs', 'ca.crt');
    if (!existsSync(caFile)) this.fail(`${caFile} does not exist: run pnpm dev:certs to create it`);

    // Refuse anything that is not a current CA certificate, so a wrong file is never trusted.
    const certificate = new X509Certificate(readFileSync(caFile));
    if (!certificate.ca) this.fail(`${caFile} is not a CA certificate`);
    if (new Date(certificate.validTo) < new Date()) this.fail(`${caFile} expired on ${certificate.validTo}`);
    process.stdout.write(`CA ${certificate.subject.replace(/\n/gu, ', ')}\nSHA-256 ${certificate.fingerprint256}\nfile ${caFile}\n`);

    const command = commandFor(process.platform, caFile);
    if (command === undefined) {
      process.stderr.write(
        `${[
          `trust-ca: no automatic trust for ${process.platform}: the store depends on the distribution (not verified). Examples:`,
          `  Debian or Ubuntu: sudo cp ${caFile} /usr/local/share/ca-certificates/lan-solution-local-ca.crt && sudo update-ca-certificates`,
          `  Fedora: sudo cp ${caFile} /etc/pki/ca-trust/source/anchors/ && sudo update-ca-trust`,
          '  Firefox and Chromium keep their own store: import the file in their settings.',
        ].join('\n')}\n`,
      );
      throw new ExitError(EXIT_CODE.argumentRejected);
    }
    const [program, args] = command;
    if (options['dry-run'] === true) {
      process.stdout.write(`dry run, nothing changed: ${program} ${args.join(' ')}\n`);
    } else if (process.platform === 'darwin' && this.macAlreadyTrusted(caFile)) {
      process.stdout.write('already trusted: nothing to do\n');
    } else {
      // The system asks for the user's password or Touch ID: stdio stays attached.
      execFileSync(program, [...args], { stdio: 'inherit' });
      process.stdout.write('trusted. Restart the browser, then reload the page.\n');
    }
    return Promise.resolve();
  }

  private fail(message: string): never {
    process.stderr.write(`trust-ca: ${message}\n`);
    throw new ExitError(EXIT_CODE.startupFailed);
  }

  private parseOptions(argv: readonly string[]): z.infer<typeof optionsSchema> {
    try {
      const parsed = parseArgs({ args: [...argv], options: { base: { type: 'string' }, 'dry-run': { type: 'boolean' } }, strict: true });
      return optionsSchema.parse(parsed.values);
    } catch (error) {
      return this.fail(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
    }
  }

  private macAlreadyTrusted(caFile: string): boolean {
    return spawnSync('security', ['verify-cert', '-c', caFile, '-p', 'ssl'], { stdio: 'ignore' }).status === 0;
  }
}
