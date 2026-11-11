import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';
import { EXIT_CODE } from 'service-registry';
import { ExitError } from '../constants/exit-error.js';
import { RepoRoot } from '../services/repo-root.service.js';

// Native E2E of the Tauri host (REQ-TEST-08, AC-20): builds the instrumented host, installs it with the sidecar in a temporary base directory, runs WebdriverIO, then checks that no process is left.
// Not a public target: the `package` step of apps/desktop runs it before the Tauri bundle (REQ-ECO-06). Run it with `pnpm exec nx run desktop:package`; the nx graph orders `sea-runtime:package` first.
// Isolation: temporary base directory, free ports written into its config, certs from `tools-cli generate-certs`. The OS trust store and keychain are never touched: the test process trusts ca.crt through its own `ca` option.
// The instrumented binary is built into src-tauri/target/e2e, apart from the product build. Only macOS is verified; Windows and Linux (tauri-driver) are not.
// Usage: `tools-cli e2e-desktop`. Exit codes: 0 done, 1 any failed step. The retired script ignored every argument and so does this command.
const EXE = process.platform === 'win32' ? '.exe' : '';
// Matched on the executable (ps comm), not the whole command line, so a shell that merely mentions the names is not counted.
const ORPHAN_EXECUTABLE = /(^|[\\/])(sea-runtime|api-gateway)(\.exe)?$/;
const SETTLE_MS = 3_000;
const STRINGS_MAX_BYTES = 1024 * 1024 * 1024;

const sleep = (ms: number): Promise<void> =>
  new Promise((done) => setTimeout(done, ms));

@Command({
  name: 'e2e-desktop',
  description:
    'Build the instrumented Tauri host, run the WebdriverIO desktop E2E in a temporary base and check that no process is left (REQ-TEST-08, AC-20).',
  arguments: '[ignored...]',
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
@Injectable()
export class E2eDesktopCommand extends CommandRunner {
  private base = '';

  constructor(private readonly repo: RepoRoot) {
    super();
  }

  override async run(): Promise<void> {
    const root = this.repo.path;
    // Real path: Tauri refuses a sidecar spawn when current_exe() crosses a symlink (macOS /var -> /private/var).
    this.base = realpathSync(mkdtempSync(join(tmpdir(), 'lan-desktop-e2e-')));
    let failure: unknown;
    try {
      await this.steps(root);
    } catch (error) {
      failure = error;
    } finally {
      this.cleanup();
    }
    if (failure) {
      process.stderr.write(
        `e2e-desktop: ${failure instanceof Error ? failure.message : String(failure)}\n`,
      );
      throw new ExitError(EXIT_CODE.startupFailed);
    }
  }

  private async steps(root: string): Promise<void> {
    const desktop = join(root, 'apps', 'desktop');
    const targetDir = join(desktop, 'src-tauri', 'target', 'e2e');
    const cli = join(root, 'apps', 'tools-cli', 'dist', 'main.js');
    this.exec('node', [cli, 'stage-sidecar'], root);
    this.exec(
      'pnpm',
      [
        'exec',
        'tauri',
        'build',
        '--no-bundle',
        '--debug',
        '--features',
        'wdio',
        '--config',
        'src-tauri/tauri.wdio.conf.json',
      ],
      desktop,
      { CARGO_TARGET_DIR: targetDir },
    );
    const built = join(targetDir, 'debug');
    this.install(built);
    const { httpsPort } = await this.writeConfig();
    this.exec('pnpm', ['--filter', 'shared-core', 'run', 'build'], root);
    this.exec('node', [cli, 'generate-certs', '--base', this.base], root);

    this.exec('pnpm', ['exec', 'wdio', 'run', 'wdio.conf.ts'], desktop, {
      DESKTOP_E2E_APP: join(this.base, `app${EXE}`),
      DESKTOP_E2E_BASE: this.base,
      DESKTOP_E2E_HTTPS_PORT: String(httpsPort),
    });

    // The host is closed by the service when the session ends: nothing of the sidecar tree may be left.
    await sleep(SETTLE_MS);
    const left = this.leftovers();
    process.stdout.write(
      `ps after closing the host (sea-runtime|api-gateway): ${left.length === 0 ? '(none)' : left.join(' | ')}\n`,
    );
    if (left.length > 0)
      throw new Error('orphan processes after closing the host');
  }

  private exec(
    command: string,
    args: string[],
    cwd: string,
    env: NodeJS.ProcessEnv = {},
  ): void {
    const result = spawnSync(command, args, {
      cwd,
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    if (result.status !== 0)
      throw new Error(
        `${command} ${args.join(' ')} exited with ${result.status}`,
      );
  }

  // The instrumented binary must carry the wdio plugin; the copies are what the test installs.
  private install(built: string): void {
    // Same count as `strings -a <binary> | grep -ci wdio`; a failing `strings` counts zero lines, as the retired pipeline did.
    const listed = spawnSync('strings', ['-a', join(built, `app${EXE}`)], {
      encoding: 'utf8',
      maxBuffer: STRINGS_MAX_BYTES,
    });
    const wdioStrings = (listed.stdout ?? '')
      .split('\n')
      .filter((line) => /wdio/i.test(line)).length;
    process.stdout.write(
      `instrumented binary: strings -a | grep -ci wdio = ${wdioStrings}\n`,
    );
    copyFileSync(join(built, `app${EXE}`), join(this.base, `app${EXE}`));
    copyFileSync(
      join(built, `sea-runtime${EXE}`),
      join(this.base, `sea-runtime${EXE}`),
    );
  }

  private async writeConfig(): Promise<{ httpsPort: number }> {
    mkdirSync(join(this.base, 'config'));
    const httpsPort = await this.freePort();
    const httpPort = await this.freePort();
    const config = {
      db: {
        engine: 'sqlite',
        sqlite: {
          file: 'lan.db',
          foreignKeys: true,
          journalMode: 'WAL',
          synchronous: 'FULL',
        },
      },
      net: { bind: '127.0.0.1', httpsPort, httpPort },
      tls: { extraNames: [] },
    };
    writeFileSync(
      join(this.base, 'config', 'config.json'),
      `${JSON.stringify(config, null, 2)}\n`,
    );
    return { httpsPort };
  }

  private freePort(): Promise<number> {
    return new Promise((resolvePort, reject) => {
      const server = createServer();
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const { port } = server.address() as { port: number };
        server.close(() => resolvePort(port));
      });
    });
  }

  private processTable(): string[] {
    return execFileSync('ps', ['-axo', 'pid=,comm='], {
      encoding: 'utf8',
    }).split('\n');
  }

  private leftovers(): string[] {
    return this.processTable().filter((line) =>
      ORPHAN_EXECUTABLE.test(line.trim().replace(/^\d+\s+/, '')),
    );
  }

  // Whatever runs from the temporary base (host, supervisor, gateway) is stopped before the directory goes.
  private cleanup(): void {
    for (const line of this.processTable()) {
      const pid = Number(line.trim().split(/\s+/)[0]);
      if (Number.isInteger(pid) && line.includes(this.base)) {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {
          // The process ended between ps and kill (ESRCH): nothing left to stop, and the directory must still go.
        }
      }
    }
    rmSync(this.base, { recursive: true, force: true });
  }
}
