// Per-host verification of the packaged artifacts (REQ-SEA-06, REQ-TEST-09): the standalone SEA binary and the Tauri package that contains it. A passing build does not prove a runtime.
// Usage: `node tools/scripts/verify-platform.ts`. Run `pnpm exec nx run sea-runtime:package` and `pnpm exec nx run desktop:package` first; it never builds anything.
// One line per check, `ok` or `FAIL`; the first failed check exits 1. A host outside HOSTS prints "not verified on <host>" and exits 3: it never fakes a pass.
// Isolation: temporary install directories, free ports written into each config, certs from generate-certs.ts. The keychain and the OS trust store are never touched: requests trust ca.crt through their own `ca` option.
// Only macOS arm64 has been run (docs/architecture/platform-matrix.md). The Tauri step needs a desktop session: the host opens its window for a moment.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:https';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const { AGGREGATE_STATE, DISPATCHER_CONFIG } = (await import(join(root, 'libs', 'service-registry', 'dist', 'index.js'))) as typeof import('service-registry');

// Hosts this script knows how to check. A new row is code for that host, not proof: the matrix records what actually ran.
const HOSTS: Readonly<Record<string, { triple: string }>> = {
  'darwin-arm64': { triple: 'aarch64-apple-darwin' },
  'darwin-x64': { triple: 'x86_64-apple-darwin' },
};
const NOT_VERIFIED_EXIT = 3;
const HOST = `${process.platform}-${process.arch}`;
const SEA_NAME = 'sea-runtime';
const BIND = '127.0.0.1';
const READY_WAIT_MS = 45_000;
const EXIT_WAIT_MS = 30_000;
const REJECT_WAIT_MS = 15_000;
const POLL_MS = 200;
const HTTP_TIMEOUT_MS = 5_000;

const host = HOSTS[HOST];
if (host === undefined) {
  console.error(`verify-platform: not verified on ${HOST}: no check exists for this host`);
  process.exit(NOT_VERIFIED_EXIT);
}

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
const expect = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};
const freePort = (): Promise<number> =>
  new Promise((done, fail) => {
    const server = createServer();
    server.once('error', fail);
    server.listen(0, BIND, () => {
      const { port } = server.address() as { port: number };
      server.close(() => done(port));
    });
  });

// Real path: Tauri refuses a sidecar spawn when current_exe() crosses a symlink (macOS /var -> /private/var).
const work = realpathSync(mkdtempSync(join(tmpdir(), 'lan-verify-platform-')));
const children = new Set<ChildProcess>();

// Executables whose path lies under `dir` (ps comm is the full path on macOS), so only what this run started is counted.
const processesUnder = (dir: string): string[] =>
  execFileSync('ps', ['-axo', 'pid=,comm='], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes(dir));

// Like the installer: a valid config exists next to the executable before the first start, then the command makes the TLS files.
async function install(label: string, withConfig: boolean = true): Promise<{ dir: string; httpsPort: number }> {
  const dir = mkdtempSync(join(work, `${label}-`));
  const httpsPort = await freePort();
  if (withConfig) {
    const httpPort = await freePort();
    const config = { db: { engine: 'sqlite', sqlite: { file: 'lan.db', foreignKeys: true, journalMode: 'WAL', synchronous: 'FULL' } }, net: { bind: BIND, httpsPort, httpPort }, tls: { extraNames: [] } };
    mkdirSync(join(dir, 'config'));
    writeFileSync(join(dir, 'config', 'config.json'), `${JSON.stringify(config, null, 2)}\n`);
    execFileSync(process.execPath, [join(root, 'tools', 'scripts', 'generate-certs.ts'), '--base', dir], { stdio: 'pipe' });
  }
  return { dir, httpsPort };
}

function launch(binary: string, args: readonly string[] = []): { child: ChildProcess; lines: string[]; exited: Promise<number | null> } {
  const lines: string[] = [];
  // stdin stays open: EOF on it shuts the supervisor down.
  const child = spawn(binary, [...args], { stdio: ['pipe', 'pipe', 'pipe'] });
  children.add(child);
  child.stdin?.on('error', () => undefined);
  for (const stream of [child.stdout, child.stderr]) stream?.on('data', (chunk: Buffer) => lines.push(...chunk.toString('utf8').split('\n').filter((line) => line !== '')));
  child.on('error', (error) => lines.push(`spawn error: ${error.message}`));
  const exited = new Promise<number | null>((done) => child.on('exit', (code) => done(code)));
  return { child, lines, exited };
}

const exitWithin = async (exited: Promise<number | null>, ms: number, what: string): Promise<number | null> => {
  const code = await Promise.race([exited, sleep(ms).then(() => 'timeout' as const)]);
  if (code === 'timeout') throw new Error(`${what}: no exit within ${ms} ms`);
  return code;
};

function health(port: number, ca: string): Promise<string | undefined> {
  return new Promise((done) => {
    const req = request({ host: BIND, port, path: '/api/health', ca, timeout: HTTP_TIMEOUT_MS }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        try {
          const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          const state = typeof body === 'object' && body !== null && 'status' in body ? body.status : undefined;
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

// Waits for GET /api/health over HTTPS, verified against the CA the install made, to report the aggregate `ready`.
async function waitReady(dir: string, port: number): Promise<void> {
  const ca = readFileSync(join(dir, 'certs', 'ca.crt'), 'utf8');
  const deadline = Date.now() + READY_WAIT_MS;
  while ((await health(port, ca)) !== AGGREGATE_STATE.ready) {
    if (Date.now() >= deadline) throw new Error(`/api/health not ${AGGREGATE_STATE.ready} within ${READY_WAIT_MS} ms`);
    await sleep(POLL_MS);
  }
}

// Start, wait for ready, ask for a close with SIGTERM, then require a clean end and nothing left under the install directory.
async function startAndClose(binary: string, dir: string, port: number, expectedExit: number | null): Promise<string> {
  const run = launch(binary);
  try {
    await waitReady(dir, port);
    run.child.kill('SIGTERM');
    const code = await exitWithin(run.exited, EXIT_WAIT_MS, 'close');
    expect(code === expectedExit, `exited ${code}, expected ${expectedExit}`);
    await sleep(POLL_MS * 5);
    const left = processesUnder(dir);
    expect(left.length === 0, `processes left: ${left.join(' | ')}`);
    return 'ready over HTTPS, closed, no orphans';
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}${run.lines.length > 0 ? `\n     output | ${run.lines.slice(-10).join('\n     output | ')}` : ''}`);
  }
}

let passed = 0;
async function check(name: string, body: () => Promise<string | void>): Promise<void> {
  const begun = Date.now();
  try {
    const detail = await body();
    passed += 1;
    console.log(`ok   ${name}${detail ? ` (${detail})` : ''} [${Date.now() - begun} ms]`);
  } catch (error) {
    console.log(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
    cleanup();
    process.exit(1);
  }
}

function cleanup(): void {
  for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  for (const line of processesUnder(work)) {
    const pid = Number(line.split(/\s+/)[0]);
    if (Number.isInteger(pid) && pid !== process.pid) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // already gone
      }
    }
  }
  rmSync(work, { recursive: true, force: true });
}
process.on('exit', cleanup);

const started = Date.now();
console.log(`verify-platform: host ${HOST} (${host.triple})`);

// Standalone SEA binary.
const seaSource = join(root, 'artifacts', SEA_NAME, `${SEA_NAME}-${host.triple}`);
await check(`sea: artifact ${SEA_NAME}-${host.triple} exists`, async () => {
  expect(existsSync(seaSource), `${seaSource} is missing: run "pnpm exec nx run sea-runtime:package"`);
});
// The executable resolves its base from its own folder, so each run gets a fresh install holding a copy of it.
const seaInstall = async (label: string, withConfig: boolean = true): Promise<{ dir: string; httpsPort: number; binary: string }> => {
  const made = await install(label, withConfig);
  const binary = join(made.dir, SEA_NAME);
  copyFileSync(seaSource, binary);
  return { ...made, binary };
};
await check(`sea: unknown service selector exits ${DISPATCHER_CONFIG.rejectExitCode}`, async () => {
  const bad = await seaInstall('sea-selector');
  const run = launch(bad.binary, [`--${DISPATCHER_CONFIG.serviceFlag}`, 'nope']);
  const code = await exitWithin(run.exited, REJECT_WAIT_MS, 'selector');
  expect(code === DISPATCHER_CONFIG.rejectExitCode, `exited ${code}`);
});
await check('sea: missing config exits 1 and creates nothing', async () => {
  const bare = await seaInstall('sea-bare', false);
  const run = launch(bare.binary);
  const code = await exitWithin(run.exited, REJECT_WAIT_MS, 'start without config');
  expect(code === 1, `exited ${code}`);
  expect(!existsSync(join(bare.dir, 'config')) && !existsSync(join(bare.dir, 'certs')), 'the binary created config/ or certs/');
});
await check('sea: start, /api/health ready over HTTPS, SIGTERM exit 0, no orphans', async () => {
  const live = await seaInstall('sea-live');
  return startAndClose(live.binary, live.dir, live.httpsPort, 0);
});

// Tauri package that contains the sidecar (macOS: the .app bundle).
const bundles = join(root, 'apps', 'desktop', 'src-tauri', 'target', 'release', 'bundle', 'macos');
let bundleMacOs = '';
let hostExecutable = '';
await check('tauri: package .app exists with the sidecar next to the executable', async () => {
  const app = existsSync(bundles) ? readdirSync(bundles).find((name) => name.endsWith('.app')) : undefined;
  expect(app !== undefined, `no .app under ${bundles}: run "pnpm exec nx run desktop:package"`);
  const contents = join(bundles, app as string, 'Contents');
  const executable = execFileSync('plutil', ['-extract', 'CFBundleExecutable', 'raw', join(contents, 'Info.plist')], { encoding: 'utf8' }).trim();
  bundleMacOs = join(contents, 'MacOS');
  expect(existsSync(join(bundleMacOs, executable)), `${executable} is missing in ${bundleMacOs}`);
  hostExecutable = executable;
  expect(existsSync(join(bundleMacOs, SEA_NAME)), `${SEA_NAME} is not next to ${executable}`);
  expect(executable !== SEA_NAME, 'the host executable is the sidecar');
  return `${app} / ${executable}`;
});
await check('tauri: host starts the sidecar, /api/health ready over HTTPS, SIGTERM closes everything', async () => {
  const live = await install('tauri-live');
  // Only the two package files are copied: the bundle is never run in place, so it gets no config, certs or data.
  copyFileSync(join(bundleMacOs, hostExecutable), join(live.dir, hostExecutable));
  copyFileSync(join(bundleMacOs, SEA_NAME), join(live.dir, SEA_NAME));
  // The host stops the sidecar tree on a close request; its own exit code after a signal is not asserted beyond "gone".
  const run = launch(join(live.dir, hostExecutable));
  try {
    await waitReady(live.dir, live.httpsPort);
    run.child.kill('SIGTERM');
    await Promise.race([run.exited, sleep(EXIT_WAIT_MS)]);
    expect(run.child.exitCode !== null || run.child.signalCode !== null, `host still running ${EXIT_WAIT_MS} ms after SIGTERM`);
    await sleep(POLL_MS * 15);
    const left = processesUnder(live.dir);
    expect(left.length === 0, `processes left: ${left.join(' | ')}`);
    return 'ready over HTTPS, closed, no orphans';
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}${run.lines.length > 0 ? `\n     output | ${run.lines.slice(-10).join('\n     output | ')}` : ''}`);
  }
});

console.log(`verify-platform: ${passed} checks passed on ${HOST} in ${((Date.now() - started) / 1000).toFixed(1)} s`);
