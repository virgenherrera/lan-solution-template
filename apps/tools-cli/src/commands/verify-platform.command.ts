import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:https';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';
import { AGGREGATE_STATE, DISPATCHER_CONFIG, EXIT_CODE } from 'service-registry';
import { z } from 'zod';
import { ExitError } from '../constants/exit-error.js';

// Per-host verification of the packaged artifacts (REQ-SEA-06, REQ-TEST-09): the standalone SEA binary and the Tauri package that contains it. A passing build does not prove a runtime.
// Usage: `tools-cli verify-platform`. Run `pnpm exec nx run sea-runtime:package` and `pnpm exec nx run desktop:package` first; it never builds anything.
// One line per check, `ok` or `FAIL`; the first failed check exits 1. A host outside HOSTS prints "not verified on <host>" and exits 3: it never fakes a pass.
// Isolation: temporary install directories, free ports written into each config, certs from `tools-cli generate-certs`. The keychain and the OS trust store are never touched: requests trust ca.crt through their own `ca` option.
// Only macOS arm64 has been run (docs/architecture/platform-matrix.md). The Tauri step needs a desktop session: the host opens its window for a moment.
interface Launched {
  child: ChildProcess;
  lines: string[];
  exited: Promise<number | null>;
}
interface Installed {
  dir: string;
  httpsPort: number;
}

// Hosts this command knows how to check. A new row is code for that host, not proof: the matrix records what actually ran.
const HOSTS: Readonly<Record<string, { triple: string }>> = {
  'darwin-arm64': { triple: 'aarch64-apple-darwin' },
  'darwin-x64': { triple: 'x86_64-apple-darwin' },
};
const NOT_VERIFIED_EXIT = 3;
const SEA_NAME = 'sea-runtime';
const BIND = '127.0.0.1';
const READY_WAIT_MS = 45_000;
const EXIT_WAIT_MS = 30_000;
const REJECT_WAIT_MS = 15_000;
const POLL_MS = 200;
const HTTP_TIMEOUT_MS = 5_000;
const healthBodySchema = z.looseObject({ details: z.looseObject({ state: z.looseObject({ state: z.string() }) }) });

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const server = createServer();
    server.once('error', fail);
    server.listen(0, BIND, () => {
      const { port } = server.address() as { port: number };
      server.close(() => done(port));
    });
  });
}

// Executables whose path lies under `dir` (ps comm is the full path on macOS), so only what this run started is counted.
function processesUnder(dir: string): string[] {
  return execFileSync('ps', ['-axo', 'pid=,comm='], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes(dir));
}

// The terminus report keeps the aggregate state in details.state.state.
function aggregateStateOf(body: unknown): unknown {
  const parsed = healthBodySchema.safeParse(body);
  return parsed.success ? parsed.data.details.state.state : undefined;
}

function health(port: number, ca: string): Promise<string | undefined> {
  return new Promise((done) => {
    const req = request({ host: BIND, port, path: '/api/health', ca, timeout: HTTP_TIMEOUT_MS }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        try {
          const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          const state = aggregateStateOf(body);
          done(res.statusCode === 200 && typeof state === 'string' ? state : undefined);
        } catch {
          done(undefined);
        }
      });
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => done(undefined));
    req.end();
  });
}

@Command({
  name: 'verify-platform',
  description: 'Verify the packaged SEA binary and the Tauri package on this host (REQ-SEA-06, REQ-TEST-09). Exits 3 on a host with no check.',
  arguments: '[ignored...]',
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
@Injectable()
export class VerifyPlatformCommand extends CommandRunner {
  // State of the one run: the command class is a singleton and the process serves a single invocation.
  private root = '';
  private work = '';
  private triple = '';
  private seaSource = '';
  private passed = 0;
  private readonly children = new Set<ChildProcess>();
  private bundleMacOs = '';
  private hostExecutable = '';

  override async run(): Promise<void> {
    const host = `${process.platform}-${process.arch}`;
    const known = HOSTS[host];
    if (known === undefined) {
      process.stderr.write(`verify-platform: not verified on ${host}: no check exists for this host\n`);
      throw new ExitError(NOT_VERIFIED_EXIT);
    }
    this.triple = known.triple;
    // The root comes from the entry script: <root>/apps/tools-cli/dist/main.js (the bundle rewrites import.meta.url).
    this.root = resolve(dirname(process.argv[1] ?? ''), '..', '..', '..');
    // Real path: Tauri refuses a sidecar spawn when current_exe() crosses a symlink (macOS /var -> /private/var).
    this.work = realpathSync(mkdtempSync(join(tmpdir(), 'lan-verify-platform-')));
    const started = Date.now();
    try {
      this.log(`verify-platform: host ${host} (${this.triple})`);
      await this.checkSea();
      await this.checkTauri();
      this.log(`verify-platform: ${this.passed} checks passed on ${host} in ${((Date.now() - started) / 1000).toFixed(1)} s`);
    } finally {
      this.cleanup();
    }
  }

  private log(line: string): void {
    process.stdout.write(`${line}\n`);
  }

  private async check(name: string, body: () => Promise<string | void>): Promise<void> {
    const begun = Date.now();
    try {
      const detail = await body();
      this.passed += 1;
      this.log(`ok   ${name}${detail ? ` (${detail})` : ''} [${Date.now() - begun} ms]`);
    } catch (error) {
      this.log(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
      throw new ExitError(EXIT_CODE.startupFailed);
    }
  }

  private cleanup(): void {
    for (const child of this.children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    for (const line of processesUnder(this.work)) {
      const pid = Number(line.split(/\s+/)[0]);
      if (Number.isInteger(pid) && pid !== process.pid) {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {
          // already gone
        }
      }
    }
    rmSync(this.work, { recursive: true, force: true });
  }

  // Like the installer: a valid config exists next to the executable before the first start, then the command makes the TLS files.
  private async install(label: string, withConfig: boolean = true): Promise<Installed> {
    const dir = mkdtempSync(join(this.work, `${label}-`));
    const httpsPort = await freePort();
    if (withConfig) {
      const httpPort = await freePort();
      const config = { db: { engine: 'sqlite', sqlite: { file: 'lan.db', foreignKeys: true, journalMode: 'WAL', synchronous: 'FULL' } }, net: { bind: BIND, httpsPort, httpPort }, tls: { extraNames: [] } };
      mkdirSync(join(dir, 'config'));
      writeFileSync(join(dir, 'config', 'config.json'), `${JSON.stringify(config, null, 2)}\n`);
      execFileSync(process.execPath, [join(this.root, 'apps', 'tools-cli', 'dist', 'main.js'), 'generate-certs', '--base', dir], { stdio: 'pipe' });
    }
    return { dir, httpsPort };
  }

  // The executable resolves its base from its own folder, so each run gets a fresh install holding a copy of it.
  private async seaInstall(label: string, withConfig: boolean = true): Promise<Installed & { binary: string }> {
    const made = await this.install(label, withConfig);
    const binary = join(made.dir, SEA_NAME);
    copyFileSync(this.seaSource, binary);
    return { ...made, binary };
  }

  private launch(binary: string, args: readonly string[] = []): Launched {
    const lines: string[] = [];
    // stdin stays open: EOF on it shuts the supervisor down.
    const child = spawn(binary, [...args], { stdio: ['pipe', 'pipe', 'pipe'] });
    this.children.add(child);
    child.stdin?.on('error', () => undefined);
    for (const stream of [child.stdout, child.stderr]) stream?.on('data', (chunk: Buffer) => lines.push(...chunk.toString('utf8').split('\n').filter((line) => line !== '')));
    child.on('error', (error) => lines.push(`spawn error: ${error.message}`));
    const exited = new Promise<number | null>((done) => child.on('exit', (code) => done(code)));
    return { child, lines, exited };
  }

  private async exitWithin(exited: Promise<number | null>, ms: number, what: string): Promise<number | null> {
    const code = await Promise.race([exited, sleep(ms).then(() => 'timeout' as const)]);
    if (code === 'timeout') throw new Error(`${what}: no exit within ${ms} ms`);
    return code;
  }

  // Waits for GET /api/health over HTTPS, verified against the CA the install made, to report the aggregate `ready`.
  private async waitReady(dir: string, port: number): Promise<void> {
    const ca = readFileSync(join(dir, 'certs', 'ca.crt'), 'utf8');
    const deadline = Date.now() + READY_WAIT_MS;
    while ((await health(port, ca)) !== AGGREGATE_STATE.ready) {
      if (Date.now() >= deadline) throw new Error(`/api/health not ${AGGREGATE_STATE.ready} within ${READY_WAIT_MS} ms`);
      await sleep(POLL_MS);
    }
  }

  private withOutput(error: unknown, lines: readonly string[]): Error {
    return new Error(`${error instanceof Error ? error.message : String(error)}${lines.length > 0 ? `\n     output | ${lines.slice(-10).join('\n     output | ')}` : ''}`);
  }

  // Start, wait for ready, ask for a close with SIGTERM, then require a clean end and nothing left under the install directory.
  private async startAndClose(binary: string, dir: string, port: number, expectedExit: number | null): Promise<string> {
    const run = this.launch(binary);
    try {
      await this.waitReady(dir, port);
      run.child.kill('SIGTERM');
      const code = await this.exitWithin(run.exited, EXIT_WAIT_MS, 'close');
      expect(code === expectedExit, `exited ${code}, expected ${expectedExit}`);
      await sleep(POLL_MS * 5);
      const left = processesUnder(dir);
      expect(left.length === 0, `processes left: ${left.join(' | ')}`);
      return 'ready over HTTPS, closed, no orphans';
    } catch (error) {
      throw this.withOutput(error, run.lines);
    }
  }

  // Standalone SEA binary.
  private async checkSea(): Promise<void> {
    this.seaSource = join(this.root, 'artifacts', SEA_NAME, `${SEA_NAME}-${this.triple}`);
    await this.check(`sea: artifact ${SEA_NAME}-${this.triple} exists`, async () => {
      expect(existsSync(this.seaSource), `${this.seaSource} is missing: run "pnpm exec nx run sea-runtime:package"`);
    });
    await this.check(`sea: unknown service selector exits ${DISPATCHER_CONFIG.rejectExitCode}`, async () => {
      const bad = await this.seaInstall('sea-selector');
      const run = this.launch(bad.binary, [`--${DISPATCHER_CONFIG.serviceFlag}`, 'nope']);
      const code = await this.exitWithin(run.exited, REJECT_WAIT_MS, 'selector');
      expect(code === DISPATCHER_CONFIG.rejectExitCode, `exited ${code}`);
    });
    await this.check('sea: missing config exits 1 and creates nothing', async () => {
      const bare = await this.seaInstall('sea-bare', false);
      const run = this.launch(bare.binary);
      const code = await this.exitWithin(run.exited, REJECT_WAIT_MS, 'start without config');
      expect(code === 1, `exited ${code}`);
      expect(!existsSync(join(bare.dir, 'config')) && !existsSync(join(bare.dir, 'certs')), 'the binary created config/ or certs/');
    });
    await this.check('sea: start, /api/health ready over HTTPS, SIGTERM exit 0, no orphans', async () => {
      const live = await this.seaInstall('sea-live');
      return this.startAndClose(live.binary, live.dir, live.httpsPort, 0);
    });
  }

  // Tauri package that contains the sidecar (macOS: the .app bundle).
  private async checkTauri(): Promise<void> {
    await this.check('tauri: package .app exists with the sidecar next to the executable', async () => this.checkPackage());
    await this.check('tauri: host starts the sidecar, /api/health ready over HTTPS, SIGTERM closes everything', () => this.checkHostStartsSidecar());
  }

  private checkPackage(): string {
    const bundles = join(this.root, 'apps', 'desktop', 'src-tauri', 'target', 'release', 'bundle', 'macos');
    const app = existsSync(bundles) ? readdirSync(bundles).find((name) => name.endsWith('.app')) : undefined;
    expect(app !== undefined, `no .app under ${bundles}: run "pnpm exec nx run desktop:package"`);
    const contents = join(bundles, app as string, 'Contents');
    const executable = execFileSync('plutil', ['-extract', 'CFBundleExecutable', 'raw', join(contents, 'Info.plist')], { encoding: 'utf8' }).trim();
    this.bundleMacOs = join(contents, 'MacOS');
    expect(existsSync(join(this.bundleMacOs, executable)), `${executable} is missing in ${this.bundleMacOs}`);
    this.hostExecutable = executable;
    expect(existsSync(join(this.bundleMacOs, SEA_NAME)), `${SEA_NAME} is not next to ${executable}`);
    expect(executable !== SEA_NAME, 'the host executable is the sidecar');
    return `${app} / ${executable}`;
  }

  private async checkHostStartsSidecar(): Promise<string> {
    const live = await this.install('tauri-live');
    // Only the two package files are copied: the bundle is never run in place, so it gets no config, certs or data.
    copyFileSync(join(this.bundleMacOs, this.hostExecutable), join(live.dir, this.hostExecutable));
    copyFileSync(join(this.bundleMacOs, SEA_NAME), join(live.dir, SEA_NAME));
    // The host stops the sidecar tree on a close request; its own exit code after a signal is not asserted beyond "gone".
    const run = this.launch(join(live.dir, this.hostExecutable));
    try {
      await this.waitReady(live.dir, live.httpsPort);
      run.child.kill('SIGTERM');
      await Promise.race([run.exited, sleep(EXIT_WAIT_MS)]);
      expect(run.child.exitCode !== null || run.child.signalCode !== null, `host still running ${EXIT_WAIT_MS} ms after SIGTERM`);
      await sleep(POLL_MS * 15);
      const left = processesUnder(live.dir);
      expect(left.length === 0, `processes left: ${left.join(' | ')}`);
      return 'ready over HTTPS, closed, no orphans';
    } catch (error) {
      throw this.withOutput(error, run.lines);
    }
  }
}
