// @app smoke test of the dev loop (REQ-DEV-02, REQ-DEV-04): `ng serve` proxies /api to the HTTPS gateway and trusts the generated CA only through NODE_EXTRA_CA_CERTS.
// Usage: `node tools/scripts/smoke-dev.ts`. Needs the built gateway (`pnpm --filter api-gateway build`) and the built service-registry library.
// It runs in a throwaway base and never touches the tracked proxy file. Windows shells are not verified: the process-group kill is POSIX only.
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { z } from 'zod';

const root = resolve(import.meta.dirname, '..', '..');
const { jsonText } = (await import(join(root, 'libs', 'service-registry', 'dist', 'json-text.js'))) as typeof import('../../libs/service-registry/dist/json-text.js');

const HOST = '127.0.0.1';
// High ports so the smoke never collides with a real dev run.
const HTTPS_PORT = 28443;
const HTTP_PORT = 28080;
const READY_WAIT_MS = 150_000;
const POLL_MS = 250;
const HTTP_TIMEOUT_MS = 5_000;
const STOP_WAIT_MS = 5_000;
const TAIL_LINES = 10;
const TAIL_WIDTH = 200;
const EXPECTED_OK = 200;
const PROXY_FAILURES: readonly number[] = [500, 502, 503, 504];

const exampleSchema = z.looseObject({ net: z.looseObject({ bind: z.string(), httpsPort: z.number(), httpPort: z.number() }) });
const proxySchema = z.record(z.string(), z.looseObject({ target: z.string() }));
const healthSchema = z.looseObject({ status: z.string() });

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
const base = mkdtempSync(join(tmpdir(), 'lan-smoke-dev-'));
const children: Child[] = [];
let passed = 0;

class Child {
  readonly lines: string[] = [];
  exited = false;
  readonly name: string;
  private readonly proc: ChildProcess;

  constructor(name: string, command: string, args: readonly string[], cwd: string, env: NodeJS.ProcessEnv) {
    this.name = name;
    // Detached: the dev server forks workers, so the whole group is stopped together.
    this.proc = spawn(command, args, { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    for (const stream of [this.proc.stdout, this.proc.stderr]) {
      stream?.setEncoding('utf8');
      stream?.on('data', (chunk: string) => this.lines.push(...chunk.split('\n').filter((line) => line.length > 0)));
    }
    this.proc.on('exit', () => (this.exited = true));
    children.push(this);
  }

  async stop(): Promise<void> {
    if (this.exited || this.proc.pid === undefined) return;
    process.kill(-this.proc.pid, 'SIGTERM');
    const deadline = Date.now() + STOP_WAIT_MS;
    while (!this.exited && Date.now() < deadline) await sleep(POLL_MS);
    if (!this.exited) process.kill(-this.proc.pid, 'SIGKILL');
  }

  tail(): string {
    return this.lines
      .slice(-TAIL_LINES)
      .map((line) => `    ${this.name}: ${line.slice(0, TAIL_WIDTH)}`)
      .join('\n');
  }
}

async function cleanup(): Promise<void> {
  await Promise.all(children.map((child) => child.stop()));
  rmSync(base, { recursive: true, force: true });
}

async function fail(message: string, ...logs: Child[]): Promise<never> {
  console.error(`FAIL ${message}`);
  for (const log of logs) console.error(log.tail());
  await cleanup();
  process.exit(1);
}

function pass(message: string): void {
  passed += 1;
  console.log(`ok   ${message}`);
}

function freePort(): Promise<number> {
  return new Promise((done, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, HOST, () => {
      const { port } = server.address() as { port: number };
      server.close(() => done(port));
    });
  });
}

async function get(url: string): Promise<{ status: number; body: string } | undefined> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
    return { status: response.status, body: await response.text() };
  } catch {
    return undefined;
  }
}

async function waitFor(url: string, owner: Child): Promise<void> {
  const deadline = Date.now() + READY_WAIT_MS;
  while (Date.now() < deadline) {
    if (owner.exited) await fail(`${owner.name} exited early`, owner);
    if ((await get(url))?.status === EXPECTED_OK) return;
    await sleep(POLL_MS);
  }
  await fail(`${owner.name} not ready at ${url}`, owner);
}

// The tracked proxy file stays untouched: only its target is rewritten, in a copy under the base.
function proxyCopy(name: string): string {
  const tracked = jsonText(proxySchema).parse(readFileSync(join(root, 'apps', 'web-angular', 'proxy.conf.json'), 'utf8'));
  const entries = Object.entries(tracked).map(([prefix, rule]) => [prefix, { ...rule, target: `https://${HOST}:${HTTPS_PORT}` }]);
  const file = join(base, name);
  writeFileSync(file, JSON.stringify(Object.fromEntries(entries)));
  return file;
}

function devServer(name: string, port: number, caFile: string | undefined): Child {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env['NODE_TLS_REJECT_UNAUTHORIZED'];
  if (caFile === undefined) delete env['NODE_EXTRA_CA_CERTS'];
  else env['NODE_EXTRA_CA_CERTS'] = caFile;
  const args = ['--filter', 'web-angular', 'exec', 'ng', 'serve', '--host', HOST, '--port', String(port), '--proxy-config', proxyCopy(`${name}.json`)];
  return new Child(name, 'pnpm', args, root, env);
}

const example = jsonText(exampleSchema).parse(readFileSync(join(root, 'libs', 'shared-core', 'config.example.json'), 'utf8'));
mkdirSync(join(base, 'config'));
writeFileSync(
  join(base, 'config', 'config.json'),
  JSON.stringify({ ...example, net: { ...example.net, bind: HOST, httpsPort: HTTPS_PORT, httpPort: HTTP_PORT } }),
);

const gateway = new Child('gateway', process.execPath, [join(root, 'apps', 'api-gateway', 'dist', 'main.js'), '--web', 'none'], base, process.env);
const caFile = join(base, 'certs', 'ca.crt');
const deadline = Date.now() + READY_WAIT_MS;
while (!children.some((c) => c.lines.some((line) => line.includes(`listening on ${HOST}:${HTTPS_PORT}`)))) {
  if (gateway.exited || Date.now() > deadline) await fail('gateway HTTPS listener did not start', gateway);
  await sleep(POLL_MS);
}
pass(`gateway listens on https://${HOST}:${HTTPS_PORT} with cwd = ${base}`);

const trustedPort = await freePort();
const trusted = devServer('dev-trusted', trustedPort, caFile);
await waitFor(`http://${HOST}:${trustedPort}/`, trusted);
const viaProxy = await get(`http://${HOST}:${trustedPort}/api/health`);
const health = viaProxy === undefined ? undefined : jsonText(healthSchema).safeParse(viaProxy.body);
if (viaProxy?.status !== EXPECTED_OK || health?.success !== true) await fail(`proxy with the CA answered ${viaProxy?.status} ${viaProxy?.body}`, trusted, gateway);
pass(`:${trustedPort}/api/health -> ${viaProxy.status} ${viaProxy.body.trim()} (CA trusted through NODE_EXTRA_CA_CERTS)`);

const untrustedPort = await freePort();
const untrusted = devServer('dev-untrusted', untrustedPort, undefined);
await waitFor(`http://${HOST}:${untrustedPort}/`, untrusted);
const refused = await get(`http://${HOST}:${untrustedPort}/api/health`);
if (refused === undefined || !PROXY_FAILURES.includes(refused.status)) await fail(`proxy without the CA answered ${refused?.status}, expected a proxy failure`, untrusted);
pass(`:${untrustedPort}/api/health -> ${refused.status} without NODE_EXTRA_CA_CERTS (the CA is what makes it work)`);

await cleanup();
console.log(`smoke-dev: ${passed} checks passed`);
