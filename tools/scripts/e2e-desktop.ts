// Native E2E of the Tauri host (REQ-TEST-08, AC-20): builds the instrumented host, installs it with the sidecar in a temporary base directory, runs WebdriverIO, then checks that no process is left.
// Not a public target: the `package` step of apps/desktop runs it before the Tauri bundle (REQ-ECO-06). Run it with `pnpm exec nx run desktop:package`; the nx graph orders `sea-runtime:package` first.
// Isolation: temporary base directory, free ports written into its config, certs from `tools-cli generate-certs`. The OS trust store and keychain are never touched: the test process trusts ca.crt through its own `ca` option.
// The instrumented binary is built into src-tauri/target/e2e, apart from the product build. Only macOS is verified; Windows and Linux (tauri-driver) are not.
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const desktop = join(root, 'apps', 'desktop');
const targetDir = join(desktop, 'src-tauri', 'target', 'e2e');
const exe = process.platform === 'win32' ? '.exe' : '';
// Matched on the executable (ps comm), not the whole command line, so a shell that merely mentions the names is not counted.
const ORPHAN_EXECUTABLE = /(^|[\\/])(sea-runtime|api-gateway)(\.exe)?$/;
const SETTLE_MS = 3_000;

const run = (command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}): void => {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited with ${result.status}`);
};

const freePort = (): Promise<number> =>
  new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolvePort(port));
    });
  });

const leftovers = (): string[] =>
  execFileSync('ps', ['-axo', 'pid=,comm='], { encoding: 'utf8' })
    .split('\n')
    .filter((line) => ORPHAN_EXECUTABLE.test(line.trim().replace(/^\d+\s+/, '')));

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Real path: Tauri refuses a sidecar spawn when current_exe() crosses a symlink (macOS /var -> /private/var).
const base = realpathSync(mkdtempSync(join(tmpdir(), 'lan-desktop-e2e-')));
let failure: unknown;
try {
  run('node', [join(root, 'apps', 'tools-cli', 'dist', 'main.js'), 'stage-sidecar'], root);
  run('pnpm', ['exec', 'tauri', 'build', '--no-bundle', '--debug', '--features', 'wdio', '--config', 'src-tauri/tauri.wdio.conf.json'], desktop, { CARGO_TARGET_DIR: targetDir });
  const built = join(targetDir, 'debug');
  const wdioStrings = execFileSync('sh', ['-c', `strings -a "${join(built, `app${exe}`)}" | grep -ci wdio || true`], { encoding: 'utf8' }).trim();
  console.log(`instrumented binary: strings -a | grep -ci wdio = ${wdioStrings}`);

  copyFileSync(join(built, `app${exe}`), join(base, `app${exe}`));
  copyFileSync(join(built, `sea-runtime${exe}`), join(base, `sea-runtime${exe}`));
  mkdirSync(join(base, 'config'));
  const httpsPort = await freePort();
  const httpPort = await freePort();
  const config = { db: { engine: 'sqlite', sqlite: { file: 'lan.db', foreignKeys: true, journalMode: 'WAL', synchronous: 'FULL' } }, net: { bind: '127.0.0.1', httpsPort, httpPort }, tls: { extraNames: [] } };
  writeFileSync(join(base, 'config', 'config.json'), `${JSON.stringify(config, null, 2)}\n`);
  run('pnpm', ['--filter', 'shared-core', 'run', 'build'], root);
  run('node', [join(root, 'apps', 'tools-cli', 'dist', 'main.js'), 'generate-certs', '--base', base], root);

  run('pnpm', ['exec', 'wdio', 'run', 'wdio.conf.ts'], desktop, {
    DESKTOP_E2E_APP: join(base, `app${exe}`),
    DESKTOP_E2E_BASE: base,
    DESKTOP_E2E_HTTPS_PORT: String(httpsPort),
  });

  // The host is closed by the service when the session ends: nothing of the sidecar tree may be left.
  await sleep(SETTLE_MS);
  const left = leftovers();
  console.log(`ps after closing the host (sea-runtime|api-gateway): ${left.length === 0 ? '(none)' : left.join(' | ')}`);
  if (left.length > 0) throw new Error('orphan processes after closing the host');
} catch (error) {
  failure = error;
} finally {
  // Whatever runs from the temporary base (host, supervisor, gateway) is stopped before the directory goes.
  for (const line of execFileSync('ps', ['-axo', 'pid=,comm='], { encoding: 'utf8' }).split('\n')) {
    const pid = Number(line.trim().split(/\s+/)[0]);
    if (Number.isInteger(pid) && line.includes(base)) process.kill(pid, 'SIGKILL');
  }
  rmSync(base, { recursive: true, force: true });
}
if (failure) {
  console.error(`e2e-desktop: ${failure instanceof Error ? failure.message : String(failure)}`);
  process.exit(1);
}
