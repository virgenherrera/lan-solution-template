import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';
import { EXIT_CODE, jsonText } from 'service-registry';
import { z } from 'zod';
import { ExitError } from '../constants/exit-error.js';
import { RepoRoot } from '../services/repo-root.service.js';

// @app smoke test of the dev loop (REQ-DEV-02, REQ-DEV-04): `ng serve` proxies /api to the HTTPS gateway and trusts the generated CA only through NODE_EXTRA_CA_CERTS.
// Usage: `tools-cli smoke-dev`. Needs the built gateway (`pnpm --filter api-gateway build`) and the built service-registry library.
// It runs in a throwaway base and never touches the tracked proxy file. Windows shells are not verified: the process-group kill is POSIX only.
// One line per check; the first failed check prints the tail of the child output and exits 1. The retired script ignored every argument and so does this command.
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

const exampleSchema = z.looseObject({
  net: z.looseObject({
    bind: z.string(),
    httpsPort: z.number(),
    httpPort: z.number(),
  }),
});
const proxySchema = z.record(z.string(), z.looseObject({ target: z.string() }));
const healthSchema = z.looseObject({ status: z.string() });

const sleep = (ms: number): Promise<void> =>
  new Promise((done) => setTimeout(done, ms));

class Child {
  readonly lines: string[] = [];
  exited = false;
  private readonly proc: ChildProcess;

  constructor(
    readonly name: string,
    command: string,
    args: readonly string[],
    cwd: string,
    env: NodeJS.ProcessEnv,
  ) {
    // Detached: the dev server forks workers, so the whole group is stopped together.
    this.proc = spawn(command, args, {
      cwd,
      env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    for (const stream of [this.proc.stdout, this.proc.stderr]) {
      stream?.setEncoding('utf8');
      stream?.on('data', (chunk: string) =>
        this.lines.push(...chunk.split('\n').filter((line) => line.length > 0)),
      );
    }
    this.proc.on('exit', () => (this.exited = true));
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

@Command({
  name: 'smoke-dev',
  description:
    'Run the @app smoke test of the dev loop: ng serve proxies /api to the HTTPS gateway (REQ-DEV-02, REQ-DEV-04).',
  arguments: '[ignored...]',
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
@Injectable()
export class SmokeDevCommand extends CommandRunner {
  private readonly children: Child[] = [];
  private base = '';
  private passed = 0;

  constructor(private readonly repo: RepoRoot) {
    super();
  }

  override async run(): Promise<void> {
    const root = this.repo.path;
    this.base = mkdtempSync(join(tmpdir(), 'lan-smoke-dev-'));
    try {
      this.writeConfig(root);
      const tools = join(root, 'apps', 'tools-cli', 'dist', 'main.js');
      const gateway = join(root, 'apps', 'api-gateway', 'dist', 'main.js');
      this.checkCerts(tools);
      this.checkGatewayFailures(tools, gateway);
      await this.checkProxy(root, gateway);
    } finally {
      await this.cleanup();
    }
    process.stdout.write(`smoke-dev: ${this.passed} checks passed\n`);
  }

  private async cleanup(): Promise<void> {
    await Promise.all(this.children.map((child) => child.stop()));
    rmSync(this.base, { recursive: true, force: true });
  }

  private child(
    name: string,
    command: string,
    args: readonly string[],
    cwd: string,
    env: NodeJS.ProcessEnv,
  ): Child {
    const created = new Child(name, command, args, cwd, env);
    this.children.push(created);
    return created;
  }

  // The cleanup of the failed run happens in run() after these lines, as the retired script did.
  private fail(message: string, ...logs: Child[]): never {
    process.stderr.write(`FAIL ${message}\n`);
    for (const log of logs) process.stderr.write(`${log.tail()}\n`);
    throw new ExitError(EXIT_CODE.startupFailed);
  }

  private pass(message: string): void {
    this.passed += 1;
    process.stdout.write(`ok   ${message}\n`);
  }

  private freePort(): Promise<number> {
    return new Promise((done, reject) => {
      const server = createServer();
      server.once('error', reject);
      server.listen(0, HOST, () => {
        const { port } = server.address() as { port: number };
        server.close(() => done(port));
      });
    });
  }

  private async get(
    url: string,
  ): Promise<{ status: number; body: string } | undefined> {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
      return { status: response.status, body: await response.text() };
    } catch {
      return undefined;
    }
  }

  private async waitFor(url: string, owner: Child): Promise<void> {
    const deadline = Date.now() + READY_WAIT_MS;
    while (Date.now() < deadline) {
      if (owner.exited) this.fail(`${owner.name} exited early`, owner);
      if ((await this.get(url))?.status === EXPECTED_OK) return;
      await sleep(POLL_MS);
    }
    this.fail(`${owner.name} not ready at ${url}`, owner);
  }

  // The tracked proxy file stays untouched: only its target is rewritten, in a copy under the base.
  private proxyCopy(root: string, name: string): string {
    const tracked = jsonText(proxySchema).parse(
      readFileSync(
        join(root, 'apps', 'web-angular', 'proxy.conf.json'),
        'utf8',
      ),
    );
    const entries = Object.entries(tracked).map(([prefix, rule]) => [
      prefix,
      { ...rule, target: `https://${HOST}:${HTTPS_PORT}` },
    ]);
    const file = join(this.base, name);
    writeFileSync(file, JSON.stringify(Object.fromEntries(entries)));
    return file;
  }

  private devServer(
    root: string,
    name: string,
    port: number,
    caFile: string | undefined,
  ): Child {
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env['NODE_TLS_REJECT_UNAUTHORIZED'];
    if (caFile === undefined) delete env['NODE_EXTRA_CA_CERTS'];
    else env['NODE_EXTRA_CA_CERTS'] = caFile;
    const args = [
      '--filter',
      'web-angular',
      'exec',
      'ng',
      'serve',
      '--host',
      HOST,
      '--port',
      String(port),
      '--proxy-config',
      this.proxyCopy(root, `${name}.json`),
    ];
    return this.child(name, 'pnpm', args, root, env);
  }

  private writeConfig(root: string): void {
    const example = jsonText(exampleSchema).parse(
      readFileSync(
        join(root, 'libs', 'shared-core', 'config.example.json'),
        'utf8',
      ),
    );
    mkdirSync(join(this.base, 'config'));
    writeFileSync(
      join(this.base, 'config', 'config.json'),
      JSON.stringify({
        ...example,
        net: {
          ...example.net,
          bind: HOST,
          httpsPort: HTTPS_PORT,
          httpPort: HTTP_PORT,
        },
      }),
    );
  }

  // The gateway never creates certificates: the command does, like `pnpm dev:certs` before `pnpm dev:gateway`.
  private checkCerts(tools: string): void {
    const generate = spawnSync(
      process.execPath,
      [tools, 'generate-certs', '--base', this.base],
      { encoding: 'utf8' },
    );
    if (generate.status !== 0)
      this.fail(`generate-certs exited ${generate.status}: ${generate.stderr}`);
    this.pass(
      'generate-certs created the CA and the leaf in the throwaway base',
    );
  }

  // A gateway run that must end at once: the exit code and the stderr text are what the operator sees.
  private stoppedGateway(
    gateway: string,
    cwd: string,
  ): { status: number | null; stderr: string } {
    const run = spawnSync(process.execPath, [gateway, '--web', 'none'], {
      cwd,
      encoding: 'utf8',
      timeout: READY_WAIT_MS,
    });
    return { status: run.status, stderr: run.stderr };
  }

  private checkGatewayFailures(tools: string, gateway: string): void {
    const bareBase = mkdtempSync(join(tmpdir(), 'lan-smoke-dev-bare-'));
    const brokenBase = mkdtempSync(join(tmpdir(), 'lan-smoke-dev-broken-'));
    try {
      for (const dir of [bareBase, brokenBase]) {
        mkdirSync(join(dir, 'config'));
        copyFileSync(
          join(this.base, 'config', 'config.json'),
          join(dir, 'config', 'config.json'),
        );
      }
      const missing = this.stoppedGateway(gateway, bareBase);
      if (
        missing.status !== 1 ||
        !missing.stderr.includes('pnpm dev:certs') ||
        !missing.stderr.includes('ca.crt is missing')
      ) {
        this.fail(
          `gateway without certs: exit ${missing.status}, stderr ${missing.stderr}`,
        );
      }
      if (existsSync(join(bareBase, 'certs')))
        this.fail('gateway without certs created the certs/ folder');
      this.pass(
        'gateway without certs exits 1, names the missing file and pnpm dev:certs, creates nothing',
      );

      if (
        spawnSync(process.execPath, [
          tools,
          'generate-certs',
          '--base',
          brokenBase,
        ]).status !== 0
      )
        this.fail('generate-certs failed for the mismatch case');
      // The key of the other base is a valid key that belongs to another certificate.
      copyFileSync(
        join(this.base, 'certs', 'leaf.key'),
        join(brokenBase, 'certs', 'leaf.key'),
      );
      const mismatch = this.stoppedGateway(gateway, brokenBase);
      if (
        mismatch.status !== 1 ||
        !mismatch.stderr.includes('leaf.key does not belong to')
      )
        this.fail(
          `gateway with a mismatched leaf.key: exit ${mismatch.status}, stderr ${mismatch.stderr}`,
        );
      this.pass(
        'gateway with a leaf.key that does not match leaf.crt exits 1 and names the mismatch',
      );
    } finally {
      rmSync(bareBase, { recursive: true, force: true });
      rmSync(brokenBase, { recursive: true, force: true });
    }
  }

  private async checkProxy(root: string, gatewayMain: string): Promise<void> {
    const gateway = this.child(
      'gateway',
      process.execPath,
      [gatewayMain, '--web', 'none'],
      this.base,
      process.env,
    );
    const caFile = join(this.base, 'certs', 'ca.crt');
    const deadline = Date.now() + READY_WAIT_MS;
    while (
      !this.children.some((c) =>
        c.lines.some((line) =>
          line.includes(`listening on ${HOST}:${HTTPS_PORT}`),
        ),
      )
    ) {
      if (gateway.exited || Date.now() > deadline)
        this.fail('gateway HTTPS listener did not start', gateway);
      await sleep(POLL_MS);
    }
    this.pass(
      `gateway listens on https://${HOST}:${HTTPS_PORT} with cwd = ${this.base}`,
    );

    const trustedPort = await this.freePort();
    const trusted = this.devServer(root, 'dev-trusted', trustedPort, caFile);
    await this.waitFor(`http://${HOST}:${trustedPort}/`, trusted);
    const viaProxy = await this.get(`http://${HOST}:${trustedPort}/api/health`);
    const health =
      viaProxy === undefined
        ? undefined
        : jsonText(healthSchema).safeParse(viaProxy.body);
    if (viaProxy?.status !== EXPECTED_OK || health?.success !== true)
      this.fail(
        `proxy with the CA answered ${viaProxy?.status} ${viaProxy?.body}`,
        trusted,
        gateway,
      );
    this.pass(
      `:${trustedPort}/api/health -> ${viaProxy.status} ${viaProxy.body.trim()} (CA trusted through NODE_EXTRA_CA_CERTS)`,
    );

    const untrustedPort = await this.freePort();
    const untrusted = this.devServer(
      root,
      'dev-untrusted',
      untrustedPort,
      undefined,
    );
    await this.waitFor(`http://${HOST}:${untrustedPort}/`, untrusted);
    const refused = await this.get(
      `http://${HOST}:${untrustedPort}/api/health`,
    );
    if (refused === undefined || !PROXY_FAILURES.includes(refused.status))
      this.fail(
        `proxy without the CA answered ${refused?.status}, expected a proxy failure`,
        untrusted,
      );
    this.pass(
      `:${untrustedPort}/api/health -> ${refused.status} without NODE_EXTRA_CA_CERTS (the CA is what makes it work)`,
    );
  }
}
