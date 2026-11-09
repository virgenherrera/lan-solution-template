// @app smoke test of the packaged binary (REQ-RUNTIME-08, REQ-TEST-07). It is a post-step of `package` (decision D5), not a unit or integration suite (REQ-TEST-01).
// Usage: `node tools/scripts/smoke-sea.ts [--artifacts <dir>]`; the default dir is artifacts/sea-runtime. One line per check; the first failed check prints the tail of the run output and exits 1.
// Needs the built service-registry library (the same contract the assembler loads). Windows is not verified (decision D3): the executable lookup throws there.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, readlinkSync, realpathSync, statSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { createServer } from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { X509Certificate, createHash } from 'node:crypto';
import { checkServerIdentity, connect as tlsConnect } from 'node:tls';
import { networkInterfaces, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { z } from 'zod';

const root = resolve(import.meta.dirname, '..', '..');
const { jsonText } = (await import(join(root, 'libs', 'service-registry', 'dist', 'json-text.js'))) as typeof import('../../libs/service-registry/dist/json-text.js');
const { AGGREGATE_STATE, DISPATCHER_CONFIG, SIDECAR_KIND, SUPERVISOR_CONFIG, sidecarEventSchema } = (await import(
  join(root, 'libs', 'service-registry', 'dist', 'index.js')
)) as typeof import('service-registry');

const TAG = '@app';
const SERVICE_ID = 'api-gateway';
// High ports on loopback, written into the config like an installer would: a developer's real 8443 and 8080 are never touched.
const SMOKE_NET = { bind: '127.0.0.1', httpsPort: 38443, httpPort: 38080 };
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
const WEB_INDEX = join(root, 'apps', 'web-angular', 'dist', 'web-angular', 'browser', 'index.html');
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
type ServiceStatus = SidecarEvent['services'][number];
const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
const smokeRoot = mkdtempSync(join(tmpdir(), 'lan-smoke-'));
process.on('exit', () => rmSync(smokeRoot, { recursive: true, force: true }));
// Like the installer: a valid config exists next to the executable before the first start, because the app never creates one.
// Only the blocks the smoke touches are typed; the rest of the example is copied back out whole.
const EXAMPLE_CONFIG = join(root, 'libs', 'shared-core', 'config.example.json');
const CONFIG_FILE = 'config.json';
const netSchema = z.strictObject({ bind: z.string(), httpsPort: z.number().int(), httpPort: z.number().int() });
const exampleConfigSchema = z.looseObject({
  db: z.record(z.string(), z.unknown()),
  net: netSchema,
  tls: z.looseObject({ extraNames: z.array(z.string()) }),
});
type ExampleConfig = z.infer<typeof exampleConfigSchema>;
function smokeConfig(): ExampleConfig {
  const parsed = jsonText(exampleConfigSchema).safeParse(readFileSync(EXAMPLE_CONFIG, 'utf8'));
  if (!parsed.success) throw new Error(`${EXAMPLE_CONFIG}: ${z.prettifyError(parsed.error)}`);
  return { ...parsed.data, net: SMOKE_NET };
}
// The ports the smoke uses are the ones read back from the config text it writes.
const { bind: HOST, httpsPort: HTTPS_PORT, httpPort: HTTP_PORT } = jsonText(exampleConfigSchema).parse(JSON.stringify(smokeConfig())).net;
function writeConfig(installDir: string, text: string = JSON.stringify(smokeConfig())): void {
  mkdirSync(join(installDir, 'config'), { recursive: true });
  writeFileSync(join(installDir, 'config', CONFIG_FILE), text);
}
// Like the installer, the command creates and renews the TLS files: the gateway only validates them.
const TOOLS_CLI = join(root, 'apps', 'tools-cli', 'dist', 'main.js');
function generateCerts(installDir: string): string {
  return execFileSync(process.execPath, [TOOLS_CLI, 'generate-certs', '--base', installDir], { encoding: 'utf8' });
}
// The executable resolves its base from its own folder, so each run gets a fresh install dir holding a copy of it.
// A valid config (the default) is followed by the TLS files; pass withCerts false for an install the installer has not finished.
function install(source: string, withConfig: boolean = true, text?: string, withCerts: boolean = true): { dir: string; binary: string } {
  const dir = mkdtempSync(join(smokeRoot, 'install-'));
  const binary = join(dir, basename(source));
  copyFileSync(source, binary);
  if (withConfig) writeConfig(dir, text);
  if (withConfig && text === undefined && withCerts) generateCerts(dir);
  return { dir, binary };
}
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

  constructor(binary: string, args: readonly string[], cwd?: string) {
    this.child = spawn(binary, [...args], { stdio: ['pipe', 'pipe', 'pipe'], ...(cwd === undefined ? {} : { cwd }) });
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

  // The supervisor's own claim about the service, read from the status events on stdout and never from stderr text.
  // Every claim is cross-checked against the process table (childrenOf), which does not depend on the supervisor.
  service(): ServiceStatus | undefined {
    return this.events()
      .flatMap((event) => event.services)
      .filter((entry) => entry.id === SERVICE_ID)
      .at(-1);
  }

  // The first service entry the events reported with this restart count and a pid.
  serviceAt(restarts: number): (ServiceStatus & { pid: number }) | undefined {
    for (const event of this.events()) {
      for (const entry of event.services) {
        if (entry.id === SERVICE_ID && entry.restarts === restarts && entry.pid !== undefined) return { ...entry, pid: entry.pid };
      }
    }
    return undefined;
  }

  // Every distinct service pid the events ever reported.
  servicePids(): number[] {
    return [...new Set(this.events().flatMap((event) => event.services.flatMap((entry) => (entry.id === SERVICE_ID && entry.pid !== undefined ? [entry.pid] : []))))];
  }

  // Service entries that name a pid while no child runs (restarting or failed): the pid of an exited process.
  deadPids(): number[] {
    return this.events().flatMap((event) =>
      event.services.flatMap((entry) => (entry.id === SERVICE_ID && (entry.status === 'restarting' || entry.status === 'failed') && entry.pid !== undefined ? [entry.pid] : [])),
    );
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

// The install dir of the run being checked: the CA made by generate-certs lives in its certs/ folder.
let activeDir = '';
const readCa = (dir: string): string | undefined => {
  try {
    return readFileSync(join(dir, 'certs', 'ca.crt'), 'utf8');
  } catch {
    return undefined;
  }
};

// HTTPS with an explicit trust anchor: without `ca` the request uses the system roots only, which never include the CA the binary made.
function httpsGet(path: string, ca?: string): Promise<{ status: number; body: string }> {
  return new Promise((done, fail) => {
    const req = httpsRequest({ host: HOST, port: HTTPS_PORT, path, ...(ca === undefined ? {} : { ca }), timeout: HTTP_TIMEOUT_MS }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => done({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', fail);
    req.end();
  });
}

async function get(path: string, dir: string = activeDir): Promise<{ status: number; body: string } | undefined> {
  const ca = readCa(dir);
  if (ca === undefined) return undefined;
  try {
    return await httpsGet(path, ca);
  } catch {
    return undefined;
  }
}

// One plain-HTTP request with an explicit Host header; the redirect listener must answer without following anything.
function httpProbe(hostHeader: string, path: string): Promise<{ status: number; location: string | undefined }> {
  return new Promise((done, fail) => {
    const req = httpRequest({ host: HOST, port: HTTP_PORT, path, headers: { host: hostHeader }, timeout: HTTP_TIMEOUT_MS }, (res) => {
      res.resume();
      res.on('end', () => done({ status: res.statusCode ?? 0, location: res.headers.location }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', fail);
    req.end();
  });
}

// Only the aggregate state is read from the health body: the terminus report keeps it in details.state.state.
const healthBodySchema = z.looseObject({ details: z.looseObject({ state: z.looseObject({ state: z.string().optional() }) }) });

async function healthState(): Promise<string | undefined> {
  const response = await get(ROUTES.health);
  if (response?.status !== EXPECTED_STATUS.ok) return undefined;
  const parsed = jsonText(healthBodySchema).safeParse(response.body);
  return parsed.success ? parsed.data.details.state.state : undefined;
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

// The process table, read from the OS and not from the supervisor: pid to parent pid and argv0. Linux reads /proc, macOS asks ps.
interface ProcessInfo {
  ppid: number;
  argv0: string;
}
function processTable(): Map<number, ProcessInfo> {
  const table = new Map<number, ProcessInfo>();
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
    const text = execFileSync('ps', ['-A', '-o', 'pid=,ppid=,comm='], { encoding: 'utf8' });
    for (const line of text.split('\n')) {
      const match = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);
      if (match) table.set(Number(match[1]), { ppid: Number(match[2]), argv0: match[3].trim() });
    }
    return table;
  }
  throw new Error(`unsupported platform ${process.platform}: not verified (decision D3)`);
}

const childrenOf = (parent: number): number[] => [...processTable()].filter(([, info]) => info.ppid === parent).map(([pid]) => pid);

function descendantsOf(parent: number): number[] {
  const table = processTable();
  const found: number[] = [];
  const queue = [parent];
  while (queue.length > 0) {
    const next = queue.shift() as number;
    for (const [pid, info] of table) {
      if (info.ppid === next && !found.includes(pid)) {
        found.push(pid);
        queue.push(pid);
      }
    }
  }
  return found;
}

// Every live process running this exact executable file. After a failed start the answer must be none: nothing was left behind.
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

function portFree(port: number): Promise<boolean> {
  return new Promise((done) => {
    const probe = createServer();
    probe.once('error', () => done(false));
    probe.listen(port, HOST, () => probe.close(() => done(true)));
  });
}

const portsFree = async (): Promise<boolean> => (await portFree(HTTPS_PORT)) && (await portFree(HTTP_PORT));

async function startReady(binary: string): Promise<Run> {
  activeDir = dirname(binary);
  const run = new Run(binary, []);
  current = run;
  await waitReady(READY_WAIT_MS);
  trackTree(run);
  return run;
}

// Remembers every service pid the events reported plus every real descendant, so a failed check can kill what is left.
function trackTree(target: Run): void {
  for (const pid of [...target.servicePids(), ...descendantsOf(target.pid)]) knownPids.add(pid);
}

const SETTLE_MS = 2_500;
// What a start that must stop leaves behind: exit code 1, an empty stdout, no process running the executable and no listener.
// The wait lets a service spawned by mistake come up first, so a leaked one is seen.
async function expectFailedStart(failed: Run, executable: string, what: string): Promise<void> {
  const code = await failed.exit(SLACK_MS, what);
  expect(code === 1, `${what}: exited ${code}`);
  expect(failed.stdoutLines.length === 0, `${what}: stdout is not empty: ${failed.stdoutLines.length} lines`);
  await sleep(SETTLE_MS);
  const left = processesRunning(executable);
  expect(left.length === 0, `${what}: processes left running the executable: ${left.join(', ')}`);
  expect(await portsFree(), `${what}: a gateway port is listening`);
}

// One TLS handshake that trusts only the given CA and verifies the host name `name` against the served certificate. SNI is sent for DNS names only.
function tlsHandshake(name: string, ca: string): Promise<string> {
  return new Promise((done, fail) => {
    const isIp = /^[\d.]+$/.test(name) || name.includes(':');
    const wanted = name.includes(':') ? new URL(`http://[${name}]`).hostname.slice(1, -1) : name;
    const socket = tlsConnect(
      { host: HOST, port: HTTPS_PORT, ca, ...(isIp ? {} : { servername: name }), checkServerIdentity: (_host, cert) => checkServerIdentity(wanted, cert), timeout: HTTP_TIMEOUT_MS },
      () => {
        const fingerprint = socket.getPeerCertificate().fingerprint256;
        socket.destroy();
        done(fingerprint);
      },
    );
    socket.on('timeout', () => socket.destroy(new Error('timeout')));
    socket.on('error', fail);
  });
}

// The SAN names of a leaf, ready for a handshake.
const sanNames = (cert: X509Certificate): string[] =>
  (cert.subjectAltName ?? '')
    .split(', ')
    .filter((entry) => entry !== '')
    .map((entry) => entry.slice(entry.indexOf(':') + 1).replace(/^"|"$/g, ''));

let artifact = '';

await check('artifacts: one executable, no node copy', async () => {
  const entries = readdirSync(artifactsDir);
  expect(entries.length === 1, `expected exactly 1 entry in ${artifactsDir}, found ${entries.length}: ${entries.join(', ')}`);
  expect(!FORBIDDEN_NAMES.includes(entries[0]), `${entries[0]} is a node copy`);
  artifact = join(artifactsDir, entries[0]);
  expect(statSync(artifact).isFile(), `${artifact} is not a file`);
  return entries[0];
});

// Module markers of Drizzle code (S7). The literal "drizzle-kit@x.y.z" in build-info.json is data, not code, and matches none of these.
const DRIZZLE_MARKERS = ['drizzle-orm', 'drizzle-kit/', 'sqliteTable'];

await check('no Drizzle code in the bundle or the executable', async () => {
  const bundle = join(root, 'dist', 'sea-package', 'sea-app.mjs');
  const scanned = [bundle, artifact];
  for (const file of scanned) {
    const content = readFileSync(file);
    for (const marker of DRIZZLE_MARKERS) {
      expect(content.indexOf(marker) === -1, `marker "${marker}" found in ${file}`);
    }
  }
  return `${DRIZZLE_MARKERS.length} markers, ${scanned.length} files`;
});

// The main run, installed like a packaged app: the executable, with config/ and (once started) data/ beside it.
const { dir: installDir, binary } = install(artifact);

await check(`ports ${HTTPS_PORT} and ${HTTP_PORT} are free`, async () => {
  expect(await portsFree(), `port ${HTTPS_PORT} or ${HTTP_PORT} is in use`);
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
  expect(run.hasState(AGGREGATE_STATE.ready), `no ${SIDECAR_KIND.status} event with state ${AGGREGATE_STATE.ready} on stdout`);
  // The status event names the pid; the process table, which the supervisor does not write, must agree.
  const claimed = await until(() => (run.service()?.pid === undefined ? undefined : run.service()), SLACK_MS, 'a status event with the service pid');
  expect(claimed.status === 'ready' && claimed.restarts === 0, `service ${claimed.status}, restarts ${claimed.restarts}`);
  const real = childrenOf(run.pid);
  expect(real.length === 1 && real[0] === claimed.pid, `the event says pid ${claimed.pid}, the process table shows children of ${run.pid}: [${real.join(', ')}]`);
  childPid = claimed.pid as number;
  return `${SERVICE_ID} pid ${childPid}`;
});

await check('child runs the same executable as the supervisor', async () => {
  const supervisor = identityOf(run.pid);
  const child = identityOf(childPid);
  expect(supervisor.exe === child.exe, `supervisor ${supervisor.exe} != child ${child.exe}`);
  expect(supervisor.argv0 === child.argv0, `supervisor argv0 ${supervisor.argv0} != child argv0 ${child.argv0}`);
  expect(child.argv0 === realpathSync(binary), `${child.argv0} is not ${realpathSync(binary)}`);
  expect(processTable().get(childPid)?.ppid === run.pid, `pid ${childPid} is not a child of the supervisor ${run.pid}`);
});

await check('TLS files made by generate-certs have private modes', async () => {
  const certs = join(installDir, 'certs');
  const modeOf = (path: string): number => statSync(path).mode & 0o777;
  expect(modeOf(certs) === 0o700, `certs dir mode ${modeOf(certs).toString(8)}`);
  for (const name of ['ca.key', 'leaf.key']) expect(modeOf(join(certs, name)) === 0o600, `${name} mode ${modeOf(join(certs, name)).toString(8)}`);
  for (const name of ['ca.crt', 'leaf.crt']) expect(statSync(join(certs, name)).isFile(), `${name} is missing`);
});

// The health body exposes the aggregate state and nothing about the processes behind it: no pids, no child list (the sidecar event is the only place for them).
const HEALTH_KEYS = { top: ['details', 'error', 'info', 'status'], details: ['state', 'uptime'], state: ['state', 'status'] };
await check(`GET ${ROUTES.health} over HTTPS with the CA`, async () => {
  expect((await healthState()) === AGGREGATE_STATE.ready, `${ROUTES.health} is not ${AGGREGATE_STATE.ready}`);
  const body = jsonText(z.looseObject({ details: z.looseObject({ state: z.looseObject({}) }) })).parse((await get(ROUTES.health))?.body);
  const shape = { top: Object.keys(body).sort(), details: Object.keys(body.details).sort(), state: Object.keys(body.details.state).sort() };
  expect(JSON.stringify(shape) === JSON.stringify(HEALTH_KEYS), `health keys ${JSON.stringify(shape)}`);
});

await check(`GET ${ROUTES.health} without the CA fails verification`, async () => {
  const code = await httpsGet(ROUTES.health).then(
    () => 'no error',
    (error: NodeJS.ErrnoException) => error.code,
  );
  expect(code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', `got ${code}`);
  return code;
});

await check('HTTP redirect: known host gets 308, unknown host gets 400', async () => {
  const known = await httpProbe(`${HOST}:${HTTP_PORT}`, ROUTES.health);
  expect(known.status === 308, `status ${known.status}`);
  expect(known.location === `https://${HOST}:${HTTPS_PORT}${ROUTES.health}`, `Location ${known.location}`);
  const unknown = await httpProbe('evil.example', ROUTES.health);
  expect(unknown.status === 400, `status ${unknown.status}`);
  expect(unknown.location === undefined, `Location ${unknown.location}`);
});

await check(`GET ${ROUTES.index}`, async () => {
  const response = await get(ROUTES.index);
  expect(response?.status === EXPECTED_STATUS.ok, `status ${response?.status}`);
  // The embedded web bundle is the built app: its index.html is served byte for byte.
  const served = createHash('sha256').update(response?.body ?? '').digest('hex');
  const built = createHash('sha256').update(readFileSync(WEB_INDEX)).digest('hex');
  expect(served === built, `served index sha256 ${served.slice(0, 12)} != built ${built.slice(0, 12)} (${(response?.body ?? '').length} bytes)`);
});

await check(`GET ${ROUTES.missing}`, async () => {
  const response = await get(ROUTES.missing);
  expect(response?.status === EXPECTED_STATUS.notFound, `status ${response?.status}`);
  expect((response?.body ?? '') !== '', 'the 404 has an empty body');
  const index = await get(ROUTES.index);
  expect(response?.body !== index?.body, 'the unknown api path served the web index instead of a 404');
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
  const db = new DatabaseSync(join(installDir, 'data', 'lan.db'), { readOnly: true });
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
  // Every pid an event reports is a real child; no event names a pid outside the process table.
  expect(events.every((event) => event.services.every((entry) => entry.pid === undefined || entry.pid === childPid)), 'an event names a pid that is not the service');
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
  const respawned = await until(() => run.serviceAt(1), RESTART_WAIT_MS, 'status event of the first restart');
  const next = respawned.pid;
  knownPids.add(next);
  expect(next !== childPid, 'restart reused the pid');
  await waitReady(RESTART_WAIT_MS);
  expect(!alive(childPid), `old pid ${childPid} is still alive`);
  expect(run.deadPids().length === 0, `events named the pid of an exited child: [${run.deadPids().join(', ')}]`);
  expect(run.service()?.pid === next && run.service()?.restarts === 1, `last event: pid ${run.service()?.pid}, restarts ${run.service()?.restarts}`);
  expect(childrenOf(run.pid).join() === String(next), `children of the supervisor: [${childrenOf(run.pid).join(', ')}], expected [${next}]`);
  expect(identityOf(next).argv0 === realpathSync(binary), `pid ${next} does not run the executable`);
  childPid = next;
  return `new pid ${next}`;
});

await check('SIGTERM: exit 0, no process left', async () => {
  trackTree(run);
  run.signal('SIGTERM');
  const code = await run.exit(STOP_WAIT_MS, 'supervisor after SIGTERM');
  expect(code === 0, `supervisor exited ${code}`);
  await allGone([run.pid, ...knownPids], 'after SIGTERM');
  expect(await portsFree(), 'a gateway port is still in use');
});

await check('stdin shutdown command: exit 0, no process left', async () => {
  knownPids.clear();
  const stopping = await startReady(binary);
  expect(childrenOf(stopping.pid).length === 1, `children of the supervisor: [${childrenOf(stopping.pid).join(', ')}]`);
  stopping.send(JSON.stringify({ kind: SIDECAR_KIND.shutdown }));
  const code = await stopping.exit(STOP_WAIT_MS, 'supervisor after the shutdown command');
  expect(code === 0, `supervisor exited ${code}`);
  await allGone([stopping.pid, ...knownPids], 'after the shutdown command');
  expect(await portsFree(), 'a gateway port is still in use');
});

// Stops a run the way the host does and waits until nothing is left.
async function stopClean(target: Run): Promise<void> {
  trackTree(target);
  target.send(JSON.stringify({ kind: SIDECAR_KIND.shutdown }));
  const code = await target.exit(STOP_WAIT_MS, 'supervisor after the shutdown command');
  expect(code === 0, `supervisor exited ${code}`);
  await allGone([target.pid, ...knownPids], 'after the shutdown command');
  expect(await portsFree(), 'a gateway port is still in use');
}

const certFile = (dir: string, name: string): Buffer => readFileSync(join(dir, 'certs', name));
const TLS_FILES = ['ca.crt', 'ca.key', 'leaf.crt', 'leaf.key'] as const;

await check('second start uses the TLS files and changes none', async () => {
  knownPids.clear();
  const before = TLS_FILES.map((name) => certFile(installDir, name));
  const again = await startReady(binary);
  TLS_FILES.forEach((name, index) => expect(certFile(installDir, name).equals(before[index]), `${name} changed`));
  // The running gateway serves the file's leaf, and a client that trusts only the CA connects under every name the leaf carries.
  const leaf = new X509Certificate(before[TLS_FILES.indexOf('leaf.crt')]);
  const ca = before[TLS_FILES.indexOf('ca.crt')].toString('utf8');
  const names = sanNames(leaf);
  for (const name of names) {
    const served = await tlsHandshake(name, ca);
    expect(served === leaf.fingerprint256, `served leaf ${served} != leaf.crt ${leaf.fingerprint256} (handshake as ${name})`);
  }
  await stopClean(again);
  return `${names.length} names`;
});

await check('leaf SAN holds every LAN IPv4 of the host and no IPv6 other than ::1', async () => {
  const sans = (new X509Certificate(certFile(installDir, 'leaf.crt')).subjectAltName ?? '').split(', ');
  const ips = sans.filter((entry) => entry.startsWith('IP Address:')).map((entry) => entry.slice('IP Address:'.length).toLowerCase());
  const lanV4 = Object.values(networkInterfaces()).flatMap((list) => list ?? []).filter((info) => !info.internal && info.family === 'IPv4').map((info) => info.address);
  const missing = lanV4.filter((address) => !ips.includes(address));
  expect(missing.length === 0, `leaf.crt lacks LAN IPv4 ${missing.join(', ')}`);
  const v6 = ips.filter((address) => address.includes(':') && address !== '0:0:0:0:0:0:0:1' && address !== '::1');
  expect(v6.length === 0, `leaf.crt carries IPv6 ${v6.join(', ')}`);
  return `${lanV4.length} LAN IPv4, ${ips.length} IP names`;
});

await check('a configured name missing from the leaf is reported, the gateway keeps running', async () => {
  knownPids.clear();
  const config = smokeConfig();
  config.tls.extraNames = ['lan.test'];
  writeConfig(installDir, JSON.stringify(config));
  try {
    const mismatched = await startReady(binary);
    // Effects: the old leaf stays (the gateway does not reissue), the gateway still serves, and the new name does not verify while the IP does.
    const ca = certFile(installDir, 'ca.crt').toString('utf8');
    expect(await tlsHandshake(HOST, ca).then(() => true, () => false), `handshake as ${HOST} failed`);
    const code = await tlsHandshake('lan.test', ca).then(
      () => 'no error',
      (error: NodeJS.ErrnoException) => error.code,
    );
    expect(code === 'ERR_TLS_CERT_ALTNAME_INVALID', `handshake as lan.test: ${code}`);
    expect((await healthState()) === AGGREGATE_STATE.ready, `${ROUTES.health} is not ${AGGREGATE_STATE.ready}`);
    // REQ-TLS-04 asks to report the mismatch clearly: the message is the one place a log line is the requirement.
    const reported = await until(() => (mismatched.lines.some((line) => line.includes('does not match') && line.includes('missing name: lan.test')) ? true : undefined), SLACK_MS, 'the REQ-TLS-04 mismatch report').catch(() => false);
    expect(reported, 'REQ-TLS-04: no report names the missing name lan.test');
    await stopClean(mismatched);
  } finally {
    writeConfig(installDir);
  }
});

await check('generate-certs again: nothing changes; with tls.extraNames: new leaf, same CA, new name redirects', async () => {
  knownPids.clear();
  const before = TLS_FILES.map((name) => certFile(installDir, name));
  generateCerts(installDir);
  TLS_FILES.forEach((name, index) => expect(certFile(installDir, name).equals(before[index]), `${name} changed on a second generate-certs`));
  const caBefore = certFile(installDir, 'ca.crt');
  const leafBefore = certFile(installDir, 'leaf.crt');
  const config = smokeConfig();
  config.tls.extraNames = ['lan.test'];
  writeConfig(installDir, JSON.stringify(config));
  generateCerts(installDir);
  const renamed = await startReady(binary);
  expect(certFile(installDir, 'ca.crt').equals(caBefore), 'ca.crt changed');
  expect(!certFile(installDir, 'leaf.crt').equals(leafBefore), 'leaf.crt was not reissued');
  const probe = await httpProbe(`lan.test:${HTTP_PORT}`, ROUTES.index);
  expect(probe.status === 308, `status ${probe.status}`);
  expect(probe.location === `https://lan.test:${HTTPS_PORT}${ROUTES.index}`, `Location ${probe.location}`);
  expect(await tlsHandshake('lan.test', certFile(installDir, 'ca.crt').toString('utf8')).then(() => true, () => false), 'handshake as lan.test failed with the reissued leaf');
  await stopClean(renamed);
});

// SIDECAR SIMULATION. The Tauri shell starts the executable as a child with piped stdio, from whatever directory it happens to be in,
// reads stdout lines as events, may write to stdin and sees the exit code. This group does exactly that from node.
// It proves the sidecar contract: only valid events on stdout, logs on stderr, a shutdown line on stdin, exit code 0, and no dependence on cwd.
// It does NOT prove the real thing: Tauri's CommandEvent handling, the tray, the WebView trusting the CA,
// or what happens on stdin EOF when Tauri quits.
const sidecar = install(artifact);
let sim: Run;

await check('sidecar simulation: spawn from an unrelated cwd, ready event on stdout', async () => {
  knownPids.clear();
  activeDir = dirname(sidecar.binary);
  sim = new Run(sidecar.binary, [], tmpdir());
  current = sim;
  await until(() => (sim.hasState(AGGREGATE_STATE.ready) ? true : undefined), READY_WAIT_MS, `${SIDECAR_KIND.status} event ${AGGREGATE_STATE.ready}`);
  trackTree(sim);
  expect(readCa(sidecar.dir) !== undefined, 'certs are missing next to the executable');
  expect(((await get(ROUTES.health, sidecar.dir))?.status ?? 0) === EXPECTED_STATUS.ok, 'no HTTPS health 200 from the simulated sidecar');
  expect(sim.events().length > 0, 'stdout is empty');
  return `cwd ${tmpdir()}`;
});

await check('sidecar simulation: shutdown line on stdin, exit 0, no listener left', async () => {
  await stopClean(sim);
  sim.events();
});

// The shipped build expects app_meta.value (S1): a database without it must stop the start before any service spawns.
await check('schema mismatch (app_meta.value missing): exit 1, nothing left running', async () => {
  const mismatched = install(artifact);
  mkdirSync(join(mismatched.dir, 'data'));
  copyFileSync(join(installDir, 'data', 'lan.db'), join(mismatched.dir, 'data', 'lan.db'));
  const db = new DatabaseSync(join(mismatched.dir, 'data', 'lan.db'));
  try {
    db.exec('ALTER TABLE app_meta DROP COLUMN value');
  } finally {
    db.close();
  }
  const broken = new Run(mismatched.binary, []);
  current = broken;
  await expectFailedStart(broken, mismatched.binary, 'start on a mismatched schema');
  return 'exit 1';
});

// A missing or invalid config must stop the start before any service spawns and before anything reaches stdout.
await check('config missing: exit 1, nothing left running', async () => {
  const bareInstall = install(artifact, false);
  const bare = new Run(bareInstall.binary, []);
  current = bare;
  await expectFailedStart(bare, bareInstall.binary, 'start without a config');
  expect(!existsSync(join(bareInstall.dir, 'config')) && !existsSync(join(bareInstall.dir, 'certs')) && !existsSync(join(bareInstall.dir, 'data')), 'the failed start created config/, certs/ or data/');
  return 'exit 1';
});

// The gateway never creates certificates: missing or invalid files stop the start and name the command that fixes them.
// The gateway runs alone (service selector) here, so its own exit code is the one observed.
const gatewayArgs = [`--${DISPATCHER_CONFIG.serviceFlag}`, SERVICE_ID];
await check('TLS files missing: exit 1, no file created, nothing left running', async () => {
  const bare = install(artifact, true, undefined, false);
  const run = new Run(bare.binary, gatewayArgs);
  current = run;
  await expectFailedStart(run, bare.binary, 'start without TLS files');
  expect(!existsSync(join(bare.dir, 'certs')), 'the gateway created the certs/ folder');
  return 'exit 1';
});

await check('leaf.key that does not match leaf.crt: exit 1, files untouched, nothing left running', async () => {
  const broken = install(artifact);
  const other = install(artifact);
  copyFileSync(join(other.dir, 'certs', 'leaf.key'), join(broken.dir, 'certs', 'leaf.key'));
  const before = TLS_FILES.map((name) => certFile(broken.dir, name));
  const run = new Run(broken.binary, gatewayArgs);
  current = run;
  await expectFailedStart(run, broken.binary, 'start with a mismatched leaf.key');
  TLS_FILES.forEach((name, index) => expect(certFile(broken.dir, name).equals(before[index]), `${name} changed`));
  return 'exit 1';
});

await check('config with an unknown key: exit 1, nothing left running', async () => {
  const config = smokeConfig();
  config.db['bogusKey'] = true;
  const badInstall = install(artifact, true, JSON.stringify(config));
  const bad = new Run(badInstall.binary, []);
  current = bad;
  await expectFailedStart(bad, badInstall.binary, 'start with an invalid config');
  return 'exit 1';
});

await check(`restart budget (${SUPERVISOR_CONFIG.maxRestarts}) ends in ${AGGREGATE_STATE.error}, exit ${SUPERVISOR_CONFIG.errorExitCode}`, async () => {
  knownPids.clear();
  const budget = await startReady(binary);
  // Each kill hits the pid the process table shows under the supervisor, and the next spawn is seen in the table and in the events.
  for (let n = 0; n < SUPERVISOR_CONFIG.maxRestarts; n += 1) {
    const [pid] = childrenOf(budget.pid);
    expect(pid !== undefined, `no child to kill before restart ${n + 1}`);
    process.kill(pid, 'SIGKILL');
    const next = await until(() => budget.serviceAt(n + 1), RESTART_WAIT_MS, `status event of restart ${n + 1}`);
    expect(next.pid !== pid, `restart ${n + 1} reused pid ${pid}`);
    knownPids.add(next.pid);
    await until(() => (childrenOf(budget.pid).includes(next.pid) ? true : undefined), RESTART_WAIT_MS, `pid ${next.pid} under the supervisor`);
  }
  const last = childrenOf(budget.pid)[0];
  process.kill(last, 'SIGKILL');
  const code = await budget.exit(STOP_WAIT_MS, 'supervisor after the budget');
  expect(code === SUPERVISOR_CONFIG.errorExitCode, `supervisor exited ${code}`);
  expect(budget.hasState(AGGREGATE_STATE.error), `no ${SIDECAR_KIND.status} event with state ${AGGREGATE_STATE.error} on stdout`);
  expect(budget.service()?.status === 'failed', `last service status ${budget.service()?.status}`);
  const spawns = budget.servicePids();
  expect(spawns.length === SUPERVISOR_CONFIG.maxRestarts + 1, `events reported ${spawns.length} distinct pids`);
  expect(budget.deadPids().length === 0 && budget.service()?.pid === undefined, `a restarting or failed service named a dead pid: [${budget.deadPids().join(', ')}]`);
  expect(budget.service()?.restarts === SUPERVISOR_CONFIG.maxRestarts, `last event restarts ${budget.service()?.restarts}`);
  await allGone([...knownPids, ...spawns], 'after the budget');
  expect(processesRunning(binary).length === 0, 'processes left running the executable');
  expect(await portsFree(), 'a gateway port is still in use');
  return `${spawns.length} spawns`;
});

console.log(`${TAG} smoke: ${passed} checks passed in ${((Date.now() - startedAt) / 1000).toFixed(1)} s`);
