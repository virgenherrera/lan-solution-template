// @app smoke test of the packaged binary (REQ-RUNTIME-08, REQ-TEST-07). It is a post-step of `package` (decision D5), not a unit or integration suite (REQ-TEST-01).
// Usage: `node tools/scripts/smoke-sea.ts [--artifacts <dir>]`; the default dir is artifacts/sea-runtime. One line per check; the first failed check prints the tail of the run output and exits 1.
// Needs the built service-registry library (the same contract the assembler loads). Windows is not verified (decision D3): the executable lookup throws there.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, readlinkSync, realpathSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { serverConfigSchema } from '../../apps/api-gateway/src/server-config.ts';

const root = resolve(import.meta.dirname, '..', '..');
const { jsonText } = (await import(join(root, 'libs', 'service-registry', 'dist', 'json-text.js'))) as typeof import('../../libs/service-registry/dist/json-text.js');
const { AGGREGATE_STATE, DISPATCHER_CONFIG, SIDECAR_KIND, SPAWNED_PATTERN, SUPERVISOR_CONFIG, sidecarEventSchema, stateMessage } = (await import(
  join(root, 'libs', 'service-registry', 'dist', 'index.js')
)) as typeof import('service-registry');

const TAG = '@app';
const SERVICE_ID = 'api-gateway';
// The gateway reads no environment and the supervisor passes it no port flag, so the port is the schema default.
const { port: PORT, hostname: HOST } = serverConfigSchema.parse({});
const BASE = `http://${HOST}:${PORT}`;
const HTTP_TIMEOUT_MS = 5_000;
const POLL_MS = 100;
// Margin over the configured waits, for slow or emulated hosts.
const SLACK_MS = 15_000;
const TAIL_LINES = 10;
const TAIL_WIDTH = 200;
const READY_WAIT_MS = SUPERVISOR_CONFIG.readinessTimeoutMs + SLACK_MS;
const RESTART_WAIT_MS = SUPERVISOR_CONFIG.backoffMaxMs + READY_WAIT_MS;
const STOP_WAIT_MS = SUPERVISOR_CONFIG.gracefulStopMs + SLACK_MS;
const ROUTES = { health: '/api/health', index: '/', missing: '/api/nope' } as const;
const EXPECTED_STATUS = { ok: 200, notFound: 404 } as const;
const FORBIDDEN_NAMES = ['node', 'node.exe'];
const BAD_SELECTORS: readonly (readonly string[])[] = [
  [`--${DISPATCHER_CONFIG.serviceFlag}`, 'nope'],
  [`--${DISPATCHER_CONFIG.serviceFlag}`],
  [`--${DISPATCHER_CONFIG.serviceFlag}=`],
  [`--${DISPATCHER_CONFIG.serviceFlag}`, 'sea-runtime'],
  [`--${DISPATCHER_CONFIG.serviceFlag}`, 'a', `--${DISPATCHER_CONFIG.serviceFlag}`, 'b'],
];

const { values } = parseArgs({ options: { artifacts: { type: 'string' } } });
const artifactsDir = resolve(values.artifacts ?? join(root, 'artifacts', 'sea-runtime'));
type SidecarEvent = import('service-registry').SidecarEvent;
const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
const smokeRoot = mkdtempSync(join(tmpdir(), 'lan-smoke-'));
process.on('exit', () => rmSync(smokeRoot, { recursive: true, force: true }));
// Like the installer: a valid config exists before the first start, because the app never creates one.
const EXAMPLE_CONFIG = join(root, 'libs', 'shared-core', 'config.example.json');
const CONFIG_FILE = 'config.json';
function writeConfig(home: string, text: string = readFileSync(EXAMPLE_CONFIG, 'utf8')): void {
  mkdirSync(join(home, 'config'), { recursive: true });
  writeFileSync(join(home, 'config', CONFIG_FILE), text);
}
writeConfig(smokeRoot);
const startedAt = Date.now();
const knownPids = new Set<number>();
let current: Run | undefined;
let passed = 0;

// The host sees stdout (machine events) and stderr (log lines) apart, so a Run keeps them apart too.
class Run {
  readonly lines: string[] = [];
  readonly stdoutLines: string[] = [];
  readonly exited: Promise<number | null>;
  exitCode: number | null | undefined;
  private readonly child: ChildProcess;

  constructor(binary: string, args: readonly string[], home: string = smokeRoot) {
    // APP_HOME points the paths library at a scratch root; the default OS root is not writable for a test run.
    this.child = spawn(binary, [...args], { stdio: ['pipe', 'pipe', 'pipe'], env: { APP_HOME: home } });
    // stdin stays open: EOF on it shuts the supervisor down.
    this.child.stdin?.on('error', () => undefined);
    if (this.child.stdout) createInterface({ input: this.child.stdout }).on('line', (line) => this.stdoutLines.push(line));
    if (this.child.stderr) createInterface({ input: this.child.stderr }).on('line', (line) => this.lines.push(line));
    this.exited = new Promise((done) =>
      this.child.on('exit', (code) => {
        this.exitCode = code;
        done(code);
      }),
    );
    this.child.on('error', (error) => this.lines.push(`spawn error: ${error.message}`));
  }

  get pid(): number {
    return this.child.pid ?? -1;
  }

  send(line: string): void {
    this.child.stdin?.write(`${line}\n`);
  }

  // Every stdout line must be a valid sidecar event; the first one that is not fails the check.
  events(): SidecarEvent[] {
    return this.stdoutLines.map((line, index) => {
      const parsed = jsonText(sidecarEventSchema).safeParse(line);
      if (!parsed.success) throw new Error(`stdout line ${index + 1} is not a sidecar event (${line.slice(0, TAIL_WIDTH)}): ${parsed.error.message}`);
      return parsed.data;
    });
  }

  hasState(state: string): boolean {
    return this.events().some((event) => event.state === state);
  }

  signal(name: NodeJS.Signals): void {
    this.child.kill(name);
  }

  spawnedPids(): number[] {
    return this.lines.flatMap((line) => {
      const match = SPAWNED_PATTERN.exec(line);
      return match?.[1] === SERVICE_ID ? [Number(match[2])] : [];
    });
  }

  async exit(timeoutMs: number, what: string): Promise<number | null> {
    const code = await Promise.race([this.exited, sleep(timeoutMs).then(() => 'timeout' as const)]);
    if (code === 'timeout') throw new Error(`${what}: no exit within ${timeoutMs} ms`);
    return code;
  }
}

async function until<T>(probe: () => T | undefined | Promise<T | undefined>, timeoutMs: number, what: string): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value !== undefined) return value;
    if (Date.now() >= deadline) throw new Error(`${what}: not reached within ${timeoutMs} ms`);
    await sleep(POLL_MS);
  }
}

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
};

async function get(path: string): Promise<{ status: number; body: string } | undefined> {
  try {
    const response = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
    return { status: response.status, body: await response.text() };
  } catch {
    return undefined;
  }
}

// Only the status field is read from the health body.
const healthBodySchema = z.looseObject({ status: z.string().optional() });

async function healthState(): Promise<string | undefined> {
  const response = await get(ROUTES.health);
  if (response?.status !== EXPECTED_STATUS.ok) return undefined;
  const parsed = jsonText(healthBodySchema).safeParse(response.body);
  return parsed.success ? parsed.data.status : undefined;
}

const waitReady = (timeoutMs: number): Promise<true> =>
  until(async () => ((await healthState()) === AGGREGATE_STATE.ready ? true : undefined), timeoutMs, `${ROUTES.health} ${AGGREGATE_STATE.ready}`);

// What a pid runs: the real path of its executable and of argv[0]. Linux reads /proc (no ps in slim images); macOS asks ps. Windows is not verified.
// The kernel gives /proc/<pid>/exe already resolved. Under Rosetta emulation it is the emulator (/run/rosetta) for every process, so argv[0] is what pins the binary there.
function identityOf(pid: number): { exe: string; argv0: string } {
  if (process.platform === 'linux') {
    const argv0 = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0')[0];
    return { exe: readlinkSync(`/proc/${pid}/exe`), argv0: realpathSync(argv0) };
  }
  if (process.platform === 'darwin') {
    const exe = realpathSync(execFileSync('ps', ['-o', 'comm=', '-p', String(pid)], { encoding: 'utf8' }).trim());
    return { exe, argv0: exe };
  }
  throw new Error(`unsupported platform ${process.platform}: not verified (decision D3)`);
}

async function allGone(pids: Iterable<number>, what: string): Promise<void> {
  for (const pid of pids) await until(() => (alive(pid) ? undefined : true), STOP_WAIT_MS, `${what}: pid ${pid} gone`);
}

async function check(name: string, body: () => Promise<string | void>): Promise<void> {
  const begun = Date.now();
  try {
    const detail = await body();
    passed += 1;
    console.log(`ok   ${TAG} ${name}${detail ? ` (${detail})` : ''} [${Date.now() - begun} ms]`);
  } catch (error) {
    console.log(`FAIL ${TAG} ${name}: ${error instanceof Error ? error.message : String(error)}`);
    for (const [stream, lines] of [['stderr', current?.lines ?? []], ['stdout', current?.stdoutLines ?? []]] as const) {
      for (const line of lines.slice(-TAIL_LINES)) console.log(`     ${stream} | ${line.slice(0, TAIL_WIDTH)}`);
    }
    current?.signal('SIGKILL');
    for (const pid of knownPids) if (alive(pid)) process.kill(pid, 'SIGKILL');
    process.exit(1);
  }
}

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function portFree(): Promise<boolean> {
  return new Promise((done) => {
    const probe = createServer();
    probe.once('error', () => done(false));
    probe.listen(PORT, HOST, () => probe.close(() => done(true)));
  });
}

async function startReady(binary: string): Promise<Run> {
  const run = new Run(binary, []);
  current = run;
  await waitReady(READY_WAIT_MS);
  for (const pid of run.spawnedPids()) knownPids.add(pid);
  return run;
}

let binary = '';

await check('artifacts: one executable, no node copy', async () => {
  const entries = readdirSync(artifactsDir);
  expect(entries.length === 1, `expected exactly 1 entry in ${artifactsDir}, found ${entries.length}: ${entries.join(', ')}`);
  expect(!FORBIDDEN_NAMES.includes(entries[0]), `${entries[0]} is a node copy`);
  binary = join(artifactsDir, entries[0]);
  expect(statSync(binary).isFile(), `${binary} is not a file`);
  return entries[0];
});

// Module markers of Drizzle code (S7). The literal "drizzle-kit@x.y.z" in build-info.json is data, not code, and matches none of these.
const DRIZZLE_MARKERS = ['drizzle-orm', 'drizzle-kit/', 'sqliteTable'];

await check('no Drizzle code in the bundle or the executable', async () => {
  const bundle = join(root, 'dist', 'sea-package', 'sea-app.mjs');
  const scanned = [bundle, binary];
  for (const file of scanned) {
    const content = readFileSync(file);
    for (const marker of DRIZZLE_MARKERS) {
      expect(content.indexOf(marker) === -1, `marker "${marker}" found in ${file}`);
    }
  }
  return `${DRIZZLE_MARKERS.length} markers, ${scanned.length} files`;
});

await check(`port ${PORT} is free`, async () => {
  expect(await portFree(), `port ${PORT} is in use; the gateway port is not configurable`);
});

await check(`bad selectors exit ${DISPATCHER_CONFIG.rejectExitCode}`, async () => {
  for (const args of BAD_SELECTORS) {
    const run = new Run(binary, args);
    current = run;
    const code = await run.exit(SLACK_MS, args.join(' '));
    expect(code === DISPATCHER_CONFIG.rejectExitCode, `"${args.join(' ')}" exited ${code}`);
  }
  return `${BAD_SELECTORS.length} cases`;
});

let run: Run;
let childPid = -1;

await check(`no arguments: supervisor ${AGGREGATE_STATE.ready}`, async () => {
  run = await startReady(binary);
  expect(run.lines.some((line) => line.includes(stateMessage(AGGREGATE_STATE.ready))), `no stderr line "${stateMessage(AGGREGATE_STATE.ready)}"`);
  expect(run.hasState(AGGREGATE_STATE.ready), `no ${SIDECAR_KIND.status} event with state ${AGGREGATE_STATE.ready} on stdout`);
  const pids = run.spawnedPids();
  expect(pids.length === 1, `expected 1 spawned service, saw ${pids.length}`);
  childPid = pids[0];
  return `${SERVICE_ID} pid ${childPid}`;
});

await check('child runs the same executable as the supervisor', async () => {
  const supervisor = identityOf(run.pid);
  const child = identityOf(childPid);
  expect(supervisor.exe === child.exe, `supervisor ${supervisor.exe} != child ${child.exe}`);
  expect(supervisor.argv0 === child.argv0, `supervisor argv0 ${supervisor.argv0} != child argv0 ${child.argv0}`);
  expect(child.argv0 === realpathSync(binary), `${child.argv0} is not ${realpathSync(binary)}`);
});

await check(`GET ${ROUTES.health}`, async () => {
  expect((await healthState()) === AGGREGATE_STATE.ready, `${ROUTES.health} is not ${AGGREGATE_STATE.ready}`);
});

await check(`GET ${ROUTES.index}`, async () => {
  const response = await get(ROUTES.index);
  expect(response?.status === EXPECTED_STATUS.ok, `status ${response?.status}`);
});

await check(`GET ${ROUTES.missing}`, async () => {
  const response = await get(ROUTES.missing);
  expect(response?.status === EXPECTED_STATUS.notFound, `status ${response?.status}`);
});

// Keys the boot code writes to app_meta (S4). db_engine is deliberately absent.
const APP_META_KEYS = [
  'first_installed_runtime_version',
  'gateway_version',
  'last_started_at',
  'drizzle_version',
  'runtime_version',
  'vector_lib_version',
  'web_version',
] as const;
const VERSIONED_NAME = /^@?[^@\s]+@\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]+)?$/;

await check('database: app_meta keys and schema_migrations row', async () => {
  const db = new DatabaseSync(join(smokeRoot, 'data', 'lan.db'), { readOnly: true });
  try {
    const meta = Object.fromEntries(db.prepare('SELECT key, value FROM app_meta').all().map((row) => [String(row.key), String(row.value)]));
    expect(JSON.stringify(Object.keys(meta).sort()) === JSON.stringify([...APP_META_KEYS].sort()), `app_meta keys: ${Object.keys(meta).sort().join(', ')}`);
    for (const key of APP_META_KEYS) {
      if (key !== 'last_started_at') expect(VERSIONED_NAME.test(meta[key]), `app_meta.${key} "${meta[key]}" is not name@exactVersion`);
    }
    expect(!Number.isNaN(Date.parse(meta.last_started_at)), `app_meta.last_started_at "${meta.last_started_at}" is not a date`);
    const history = db.prepare('SELECT version, runtime_version, duration_ms FROM schema_migrations').all();
    expect(history.length === 1, `schema_migrations has ${history.length} rows`);
    expect(history[0].runtime_version === meta.runtime_version, `history runtime_version "${history[0].runtime_version}" != app_meta "${meta.runtime_version}"`);
    expect(typeof history[0].duration_ms === 'number', 'schema_migrations.duration_ms is not a number');
    return `${APP_META_KEYS.length} keys, ${history.length} migration`;
  } finally {
    db.close();
  }
});

await check('stdout carries only valid sidecar events', async () => {
  const events = run.events();
  expect(events.length > 0, 'stdout is empty');
  expect(events.every((event) => event.kind === SIDECAR_KIND.status), 'unexpected event kind');
  return `${events.length} events`;
});

await check('invalid stdin line is ignored', async () => {
  run.send('not json');
  run.send(JSON.stringify({ kind: 'nope' }));
  await sleep(SLACK_MS / 5);
  expect(run.exitCode === undefined, `supervisor exited ${run.exitCode}`);
  expect((await healthState()) === AGGREGATE_STATE.ready, `${ROUTES.health} is not ${AGGREGATE_STATE.ready}`);
  run.events();
});

await check(`child killed (SIGKILL) returns to ${AGGREGATE_STATE.ready}`, async () => {
  process.kill(childPid, 'SIGKILL');
  const next = await until(() => run.spawnedPids()[1], RESTART_WAIT_MS, 'second spawn');
  knownPids.add(next);
  expect(next !== childPid, 'restart reused the pid');
  await waitReady(RESTART_WAIT_MS);
  expect(!alive(childPid), `old pid ${childPid} is still alive`);
  childPid = next;
  return `new pid ${next}`;
});

await check('SIGTERM: exit 0, no process left', async () => {
  run.signal('SIGTERM');
  const code = await run.exit(STOP_WAIT_MS, 'supervisor after SIGTERM');
  expect(code === 0, `supervisor exited ${code}`);
  await allGone([run.pid, ...knownPids], 'after SIGTERM');
  expect(await portFree(), `port ${PORT} still in use`);
});

await check('stdin shutdown command: exit 0, no process left', async () => {
  knownPids.clear();
  const stopping = await startReady(binary);
  stopping.send(JSON.stringify({ kind: SIDECAR_KIND.shutdown }));
  const code = await stopping.exit(STOP_WAIT_MS, 'supervisor after the shutdown command');
  expect(code === 0, `supervisor exited ${code}`);
  await allGone([stopping.pid, ...knownPids], 'after the shutdown command');
  expect(await portFree(), `port ${PORT} still in use`);
});

// The shipped build expects app_meta.value (S1): a database without it must stop the start before any service spawns.
await check('schema mismatch (app_meta.value missing): exit 1, no service spawned', async () => {
  const home = mkdtempSync(join(smokeRoot, 'mismatch-'));
  mkdirSync(join(home, 'data'));
  writeConfig(home);
  copyFileSync(join(smokeRoot, 'data', 'lan.db'), join(home, 'data', 'lan.db'));
  const db = new DatabaseSync(join(home, 'data', 'lan.db'));
  try {
    db.exec('ALTER TABLE app_meta DROP COLUMN value');
  } finally {
    db.close();
  }
  const broken = new Run(binary, [], home);
  current = broken;
  const code = await broken.exit(SLACK_MS, 'start on a mismatched schema');
  expect(code === 1, `exited ${code}`);
  expect(broken.lines.some((line) => line.includes('schema check FAILED')), 'no "schema check FAILED" line');
  expect(broken.spawnedPids().length === 0, 'a service was spawned');
  return 'exit 1';
});

// A missing or invalid config must stop the start before any service spawns and before anything reaches stdout.
await check('config missing: exit 1, no service spawned', async () => {
  const home = mkdtempSync(join(smokeRoot, 'no-config-'));
  const bare = new Run(binary, [], home);
  current = bare;
  const code = await bare.exit(SLACK_MS, 'start without a config');
  expect(code === 1, `exited ${code}`);
  expect(bare.lines.some((line) => line.includes('is missing')), 'no "is missing" line');
  expect(bare.spawnedPids().length === 0, 'a service was spawned');
  expect(bare.stdoutLines.length === 0, `stdout is not empty: ${bare.stdoutLines.length} lines`);
  return 'exit 1';
});

// The example config is copied back out whole, so only the db block shape is checked here.
const exampleConfigSchema = z.looseObject({ db: z.record(z.string(), z.unknown()) });

await check('config with an unknown key: exit 1, the key is named', async () => {
  const home = mkdtempSync(join(smokeRoot, 'bad-config-'));
  const parsedConfig = jsonText(exampleConfigSchema).safeParse(readFileSync(EXAMPLE_CONFIG, 'utf8'));
  if (!parsedConfig.success) throw new Error(`${EXAMPLE_CONFIG}: ${z.prettifyError(parsedConfig.error)}`);
  const config = parsedConfig.data;
  config.db['bogusKey'] = true;
  writeConfig(home, JSON.stringify(config));
  const bad = new Run(binary, [], home);
  current = bad;
  const code = await bad.exit(SLACK_MS, 'start with an invalid config');
  expect(code === 1, `exited ${code}`);
  expect(bad.lines.some((line) => line.includes('bogusKey')), 'stderr does not name "bogusKey"');
  expect(bad.spawnedPids().length === 0, 'a service was spawned');
  return 'exit 1';
});

await check(`restart budget (${SUPERVISOR_CONFIG.maxRestarts}) ends in ${AGGREGATE_STATE.error}, exit ${SUPERVISOR_CONFIG.errorExitCode}`, async () => {
  knownPids.clear();
  const budget = await startReady(binary);
  for (let n = 1; n <= SUPERVISOR_CONFIG.maxRestarts; n += 1) {
    const pid = budget.spawnedPids()[n - 1];
    process.kill(pid, 'SIGKILL');
    knownPids.add(pid);
    const next = await until(() => budget.spawnedPids()[n], RESTART_WAIT_MS, `restart ${n}`);
    knownPids.add(next);
  }
  process.kill(budget.spawnedPids()[SUPERVISOR_CONFIG.maxRestarts], 'SIGKILL');
  const code = await budget.exit(STOP_WAIT_MS, 'supervisor after the budget');
  expect(code === SUPERVISOR_CONFIG.errorExitCode, `supervisor exited ${code}`);
  expect(budget.lines.some((line) => line.includes(stateMessage(AGGREGATE_STATE.error))), `no stderr line "${stateMessage(AGGREGATE_STATE.error)}"`);
  expect(budget.hasState(AGGREGATE_STATE.error), `no ${SIDECAR_KIND.status} event with state ${AGGREGATE_STATE.error} on stdout`);
  expect(budget.spawnedPids().length === SUPERVISOR_CONFIG.maxRestarts + 1, `spawned ${budget.spawnedPids().length} times`);
  await allGone(knownPids, 'after the budget');
  return `${budget.spawnedPids().length} spawns`;
});

console.log(`${TAG} smoke: ${passed} checks passed in ${((Date.now() - startedAt) / 1000).toFixed(1)} s`);
