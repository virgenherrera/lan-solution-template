// @app smoke test of the packaged binary against a real PostgreSQL with pgvector (REQ-TEST-06, AC-09). It is a target of its own (`nx run sea-runtime:smoke-pg`), not a unit or integration suite (REQ-TEST-01).
// Usage: `node tools/scripts/smoke-pg.ts [--artifacts <dir>]`; the default dir is artifacts/sea-runtime. Needs a running Docker daemon: without one it fails with an explicit message, it never skips.
// Every run starts its own throwaway containers on random loopback ports, labelled `lan-smoke-pg=<run id>`, and always removes them (normal end, failed check, SIGINT, SIGTERM).
// Windows is not verified (decision D3). One line per check; the first failed check prints the tail of the run output and exits 1.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { z } from 'zod';

const root = resolve(import.meta.dirname, '..', '..');
const { jsonText } = (await import(join(root, 'libs', 'service-registry', 'dist', 'json-text.js'))) as typeof import('../../libs/service-registry/dist/json-text.js');
const { AGGREGATE_STATE, SUPERVISOR_CONFIG, sidecarEventSchema } = (await import(join(root, 'libs', 'service-registry', 'dist', 'index.js'))) as typeof import('service-registry');

const TAG = '@app';
const IMAGE_PGVECTOR = 'pgvector/pgvector:pg17';
const IMAGE_PLAIN = 'postgres:17-alpine';
const LABEL = 'lan-smoke-pg';
const PG_DATABASE = 'lan';
const PG_USER = 'postgres';
const PG_PASSWORD_FILE = 'pg.pass';
const LOOPBACK = '127.0.0.1';
// High ports on loopback, never the developer's real 8443 and 8080; distinct from smoke-sea so both can be inspected together.
const SMOKE_NET = { bind: LOOPBACK, httpsPort: 39443, httpPort: 39080 };
const POLL_MS = 250;
const SLACK_MS = 15_000;
const PULL_WAIT_MS = 300_000;
const PG_READY_WAIT_MS = 60_000;
const BOOT_WAIT_MS = SUPERVISOR_CONFIG.readinessTimeoutMs + SLACK_MS;
const STOP_WAIT_MS = SUPERVISOR_CONFIG.gracefulStopMs + SLACK_MS;
const TAIL_LINES = 10;
const TAIL_WIDTH = 200;
const SETTLE_MS = 2_500;

const { values } = parseArgs({ options: { artifacts: { type: 'string' } } });
const artifactsDir = resolve(values.artifacts ?? join(root, 'artifacts', 'sea-runtime'));
const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
const runId = randomBytes(6).toString('hex');
const smokeRoot = mkdtempSync(join(tmpdir(), 'lan-smoke-pg-'));
let passed = 0;
let current: Run | undefined;

// Docker output is read quietly (-q, no progress bars); a failed command carries its stderr in the error.
function docker(args: readonly string[], timeoutMs: number = SLACK_MS): string {
  try {
    return execFileSync('docker', [...args], { encoding: 'utf8', timeout: timeoutMs, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { stderr?: string };
    const text = (failure.stderr ?? failure.message).trim().split('\n').slice(-3).join(' | ');
    throw new Error(`docker ${args.slice(0, 2).join(' ')} failed: ${text}`);
  }
}

// The smoke owns only containers carrying its run label. Runs on every exit path, so a failed check or a signal leaves nothing behind.
function removeContainers(): void {
  try {
    const ids = execFileSync('docker', ['ps', '-aq', '--filter', `label=${LABEL}=${runId}`], { encoding: 'utf8', timeout: SLACK_MS, stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n')
      .filter((id) => id !== '');
    if (ids.length > 0) execFileSync('docker', ['rm', '-f', '-v', ...ids], { timeout: SLACK_MS, stdio: 'ignore' });
  } catch {
    // The daemon is gone: there is nothing left to remove.
  }
}
process.on('exit', () => {
  current?.signal('SIGKILL');
  removeContainers();
  rmSync(smokeRoot, { recursive: true, force: true });
});
for (const name of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.on(name, () => process.exit(130));

// The host sees stdout (machine events) and stderr (log lines) apart. The smoke reads the events and the effects, not the log text.
class Run {
  readonly lines: string[] = [];
  readonly stdoutLines: string[] = [];
  readonly exited: Promise<number | null>;
  private readonly child: ChildProcess;

  constructor(binary: string) {
    this.child = spawn(binary, [], { stdio: ['pipe', 'pipe', 'pipe'] });
    // stdin stays open: EOF on it shuts the supervisor down.
    this.child.stdin?.on('error', () => undefined);
    if (this.child.stdout) createInterface({ input: this.child.stdout }).on('line', (line) => this.stdoutLines.push(line));
    if (this.child.stderr) createInterface({ input: this.child.stderr }).on('line', (line) => this.lines.push(line));
    this.exited = new Promise((done) => this.child.on('exit', (code) => done(code)));
    this.child.on('error', (error) => this.lines.push(`spawn error: ${error.message}`));
  }

  get pid(): number {
    return this.child.pid ?? -1;
  }

  // The status events on stdout; a line that is not a valid sidecar event fails the check.
  events(): import('service-registry').SidecarEvent[] {
    return this.stdoutLines.map((line, index) => {
      const parsed = jsonText(sidecarEventSchema).safeParse(line);
      if (!parsed.success) throw new Error(`stdout line ${index + 1} is not a sidecar event (${line.slice(0, TAIL_WIDTH)})`);
      return parsed.data;
    });
  }

  isReady(): boolean {
    return this.events().some((event) => event.state === AGGREGATE_STATE.ready);
  }

  // The pid the last status event reports for the single service, if any.
  servicePid(): number | undefined {
    return this.events().flatMap((event) => event.services).at(-1)?.pid;
  }

  signal(name: NodeJS.Signals): void {
    this.child.kill(name);
  }

  shutdown(): void {
    this.child.stdin?.write(`${JSON.stringify({ kind: 'shutdown' })}\n`);
  }

  async exit(timeoutMs: number, what: string): Promise<number | null> {
    const code = await Promise.race([this.exited, sleep(timeoutMs).then(() => 'timeout' as const)]);
    if (code === 'timeout') throw new Error(`${what}: no exit within ${timeoutMs} ms`);
    return code;
  }
}

async function until<T>(probe: () => T | undefined, timeoutMs: number, what: string): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = probe();
    if (value !== undefined) return value;
    if (Date.now() >= deadline) throw new Error(`${what}: not reached within ${timeoutMs} ms`);
    await sleep(POLL_MS);
  }
}

// The process table from the OS, independent of the supervisor: pid to parent pid and argv0. Linux reads /proc, macOS asks ps.
function processTable(): Map<number, { ppid: number; argv0: string }> {
  const table = new Map<number, { ppid: number; argv0: string }>();
  if (process.platform === 'linux') {
    for (const entry of readdirSync('/proc')) {
      if (!/^\d+$/.test(entry)) continue;
      try {
        const stat = readFileSync(`/proc/${entry}/stat`, 'utf8');
        const ppid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
        table.set(Number(entry), { ppid, argv0: readFileSync(`/proc/${entry}/cmdline`, 'utf8').split('\0')[0] });
      } catch {
        // The process ended while the table was read.
      }
    }
    return table;
  }
  if (process.platform === 'darwin') {
    for (const line of execFileSync('ps', ['-A', '-o', 'pid=,ppid=,comm='], { encoding: 'utf8' }).split('\n')) {
      const match = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);
      if (match) table.set(Number(match[1]), { ppid: Number(match[2]), argv0: match[3].trim() });
    }
    return table;
  }
  throw new Error(`unsupported platform ${process.platform}: not verified (decision D3)`);
}

const childrenOf = (parent: number): number[] => [...processTable()].filter(([, info]) => info.ppid === parent).map(([pid]) => pid);

// Every live process running this exact executable file.
function processesRunning(binaryPath: string): number[] {
  const real = realpathSync(binaryPath);
  return [...processTable()]
    .filter(([, info]) => {
      try {
        return info.argv0 !== '' && realpathSync(info.argv0) === real;
      } catch {
        return false;
      }
    })
    .map(([pid]) => pid);
}

const portFree = (port: number): Promise<boolean> =>
  new Promise((done) => {
    const probe = createServer();
    probe.once('error', () => done(false));
    probe.listen(port, LOOPBACK, () => probe.close(() => done(true)));
  });

async function check(name: string, body: () => Promise<string | void>): Promise<void> {
  const begun = Date.now();
  try {
    const detail = await body();
    passed += 1;
    console.log(`ok   ${TAG} ${name}${detail ? ` (${detail})` : ''} [${Date.now() - begun} ms]`);
  } catch (error) {
    console.log(`FAIL ${TAG} ${name}: ${error instanceof Error ? error.message : String(error)}`);
    for (const line of (current?.lines ?? []).slice(-TAIL_LINES)) console.log(`     stderr | ${line.slice(0, TAIL_WIDTH)}`);
    process.exit(1);
  }
}

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// One throwaway PostgreSQL. The password is random per run and reaches the app only through data/pg.pass (decision 11), never the config.
interface Server {
  readonly id: string;
  readonly port: number;
  readonly password: string;
}

async function startServer(image: string): Promise<Server> {
  const password = randomBytes(12).toString('hex');
  const id = docker(
    ['run', '-d', '-q', '--label', `${LABEL}=${runId}`, '-e', `POSTGRES_PASSWORD=${password}`, '-e', `POSTGRES_DB=${PG_DATABASE}`, '-p', `${LOOPBACK}::5432`, image],
    PULL_WAIT_MS,
  );
  const port = Number(docker(['port', id, '5432/tcp']).split(':').pop());
  expect(Number.isInteger(port) && port > 0, `no host port for container ${id.slice(0, 12)}`);
  // The image restarts the server after its init scripts; asking over TCP inside the container only answers once the final server is up.
  await until(
    () => {
      try {
        docker(['exec', id, 'psql', '-h', LOOPBACK, '-U', PG_USER, '-d', PG_DATABASE, '-Atc', 'SELECT 1']);
        return true;
      } catch {
        return undefined;
      }
    },
    PG_READY_WAIT_MS,
    `${image} accepts connections`,
  );
  return { id, port, password };
}

function psql(server: Server, sql: string): string {
  return docker(['exec', server.id, 'psql', '-h', LOOPBACK, '-U', PG_USER, '-d', PG_DATABASE, '-Atc', sql]);
}

// Only the blocks the smoke touches are typed; the rest of the example is copied back out whole.
const exampleConfigSchema = z.looseObject({ db: z.record(z.string(), z.unknown()), net: z.looseObject({}), tls: z.looseObject({}) });
function pgConfig(server: Server): string {
  const parsed = jsonText(exampleConfigSchema).safeParse(readFileSync(join(root, 'libs', 'shared-core', 'config.example.json'), 'utf8'));
  if (!parsed.success) throw new Error(z.prettifyError(parsed.error));
  const db = { engine: 'pg', pg: { host: LOOPBACK, port: server.port, database: PG_DATABASE, user: PG_USER, passwordFile: PG_PASSWORD_FILE } };
  return JSON.stringify({ ...parsed.data, db, net: SMOKE_NET });
}

// Like the installer: the executable, config/config.json with db.engine pg, data/pg.pass and the TLS files.
function install(artifact: string, server: Server): string {
  const dir = mkdtempSync(join(smokeRoot, 'install-'));
  const binary = join(dir, basename(artifact));
  copyFileSync(artifact, binary);
  mkdirSync(join(dir, 'config'), { recursive: true });
  mkdirSync(join(dir, 'data'), { recursive: true });
  writeFileSync(join(dir, 'config', 'config.json'), pgConfig(server));
  writeFileSync(join(dir, 'data', PG_PASSWORD_FILE), server.password, { mode: 0o600 });
  execFileSync(process.execPath, [join(root, 'tools', 'scripts', 'generate-certs.ts'), '--base', dir], { stdio: 'ignore' });
  return binary;
}

// Starts the binary and returns once it is up (the ready line) and stopped the way the host does, or once it has exited.
async function bootAndStop(binary: string): Promise<Run> {
  const run = new Run(binary);
  current = run;
  await until(() => (run.isReady() ? true : undefined), BOOT_WAIT_MS, `a ${AGGREGATE_STATE.ready} status event`);
  // The event's pid is a real child of the supervisor in the process table.
  const pid = run.servicePid();
  expect(pid !== undefined && childrenOf(run.pid).includes(pid), `the event says pid ${pid}, the process table shows children [${childrenOf(run.pid).join(', ')}]`);
  run.shutdown();
  const code = await run.exit(STOP_WAIT_MS, 'supervisor after the shutdown command');
  expect(code === 0, `supervisor exited ${code}`);
  expect(processesRunning(binary).length === 0, 'processes left running the executable');
  expect(await portFree(SMOKE_NET.httpsPort), 'the HTTPS port is still in use');
  return run;
}

async function bootFailing(binary: string, what: string): Promise<Run> {
  const run = new Run(binary);
  current = run;
  const code = await run.exit(BOOT_WAIT_MS, what);
  expect(code === 1, `${what}: exited ${code}`);
  expect(run.stdoutLines.length === 0, `${what}: stdout is not empty: ${run.stdoutLines.length} lines`);
  // The wait lets a service spawned by mistake come up first, so a leaked one is seen.
  await sleep(SETTLE_MS);
  const left = processesRunning(binary);
  expect(left.length === 0, `${what}: processes left running the executable: ${left.join(', ')}`);
  expect(await portFree(SMOKE_NET.httpsPort), `${what}: the HTTPS port is listening`);
  return run;
}

await check('docker: daemon reachable', async () => {
  try {
    return `server ${docker(['info', '--format', '{{.ServerVersion}}'])}`;
  } catch (error) {
    throw new Error(`the Docker daemon is not reachable (${(error as Error).message}). Start Docker Desktop (or the docker service) and run this target again; this test never skips`);
  }
});

let artifact = '';
await check('artifacts: one executable', async () => {
  const entries = readdirSync(artifactsDir);
  expect(entries.length === 1, `expected exactly 1 entry in ${artifactsDir}, found ${entries.length}: ${entries.join(', ')}`);
  artifact = join(artifactsDir, entries[0]);
  return entries[0];
});

let server: Server;
let binary = '';
await check(`${IMAGE_PGVECTOR}: ephemeral container on a random port`, async () => {
  server = await startServer(IMAGE_PGVECTOR);
  binary = install(artifact, server);
  return `127.0.0.1:${server.port}, label ${LABEL}=${runId}`;
});

const columns = (): string => psql(server, "SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns WHERE table_name = 'app_meta'");
const history = (): string => psql(server, 'SELECT version, name FROM schema_migrations ORDER BY version');

await check('first start: migration applied, schema ok, pgvector ready', async () => {
  await bootAndStop(binary);
  expect(history() === '1|0000_create_app_meta', `schema_migrations: ${history()}`);
  expect(columns() === 'key,value', `app_meta columns: ${columns()}`);
  expect(psql(server, "SELECT count(*) FROM pg_extension WHERE extname = 'vector'") === '1', 'the vector extension is not installed');
  return history();
});

// REQ-TEST-06: a genuine vector query, on the server the app just migrated.
await check('vector: a genuine similarity query runs on the server', async () => {
  const distance = psql(server, "SELECT '[1,0,0]'::vector <=> '[0,1,0]'::vector");
  expect(distance === '1', `cosine distance ${distance}`);
  return `cosine distance ${distance}`;
});

await check('restart: nothing is applied again', async () => {
  const before = psql(server, 'SELECT applied_at FROM schema_migrations WHERE version = 1');
  await bootAndStop(binary);
  expect(psql(server, 'SELECT applied_at FROM schema_migrations WHERE version = 1') === before, 'applied_at changed');
  expect(history() === '1|0000_create_app_meta', `schema_migrations: ${history()}`);
});

await check('altered checksum: exit 1, nothing left running, history untouched', async () => {
  const original = psql(server, 'SELECT checksum FROM schema_migrations WHERE version = 1');
  psql(server, "UPDATE schema_migrations SET checksum = 'altered' WHERE version = 1");
  await bootFailing(binary, 'start with an altered checksum');
  expect(psql(server, 'SELECT checksum FROM schema_migrations WHERE version = 1') === 'altered', 'the failed start rewrote the history row');
  psql(server, `UPDATE schema_migrations SET checksum = '${original}' WHERE version = 1`);
});

await check('pending migration: applied on top of the existing history', async () => {
  // The only embedded migration is made pending again: its history row and its table are gone, the history table stays.
  psql(server, 'DELETE FROM schema_migrations WHERE version = 1');
  psql(server, 'DROP TABLE app_meta');
  await bootAndStop(binary);
  expect(history() === '1|0000_create_app_meta', `schema_migrations: ${history()}`);
  expect(columns() === 'key,value', `app_meta columns: ${columns()}`);
});

await check('live column dropped: exit 1, nothing left running, schema untouched', async () => {
  psql(server, 'ALTER TABLE app_meta DROP COLUMN value');
  await bootFailing(binary, 'start on a mismatched schema');
  expect(columns() === 'key', `the failed start changed app_meta columns: ${columns()}`);
});

await check(`${IMAGE_PLAIN} (no pgvector): exit 1, no migration ran, no fallback`, async () => {
  const plain = await startServer(IMAGE_PLAIN);
  await bootFailing(install(artifact, plain), 'start without the pgvector extension');
  expect(psql(plain, "SELECT count(*) FROM information_schema.tables WHERE table_name = 'app_meta'") === '0', 'a migration ran without pgvector');
});

removeContainers();
await check('containers: none left with the run label', async () => {
  const left = execFileSync('docker', ['ps', '-aq', '--filter', `label=${LABEL}=${runId}`], { encoding: 'utf8' }).trim();
  expect(left === '', `containers left: ${left}`);
});

console.log(`${TAG} smoke-pg: ${passed} checks passed`);
