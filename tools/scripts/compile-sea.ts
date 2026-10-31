// Packages every registered service into one self-contained Node SEA executable.
// A service registers by declaring in its own package.json: "sea": { "service": "<name>", "entry": "<built entry, relative to the project>" }.
// Run from the repository root: `node tools/scripts/compile-sea.ts`, or through Nx (`nx package sea-build`).
// The generated entry file and the SEA config are written under dist/ at build time and are never committed.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..', '..');
const workDir = join(root, 'dist', 'sea-build');
const outDir = join(root, 'dist', 'sea');
const entryPath = join(workDir, 'entry.mjs');
const bundlePath = join(workDir, 'sea-app.mjs');
const configPath = join(workDir, 'sea-config.json');
const binaryPath = join(outDir, 'sea-app');

type Version = [number, number, number];

interface Registration {
  service: string;
  projectName: string;
  entryPath: string;
}

function parseVersion(text: string): Version {
  const parts = text.replace(/^v/, '').split('.').map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function compareVersions(a: Version, b: Version): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

// Supports the comparators used by the root engines.node range (for example ">=26.13.0 <27").
function satisfiesEngine(version: Version, range: string): boolean {
  return range.trim().split(/\s+/).every((comparator) => {
    const match = /^(>=|<=|>|<|=)?v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(comparator);
    if (!match) throw new Error(`unsupported engines.node comparator: ${comparator}`);
    const op = match[1] ?? '=';
    const bound: Version = [Number(match[2]), Number(match[3] ?? 0), Number(match[4] ?? 0)];
    const diff = compareVersions(version, bound);
    switch (op) {
      case '>=': return diff >= 0;
      case '<=': return diff <= 0;
      case '>': return diff > 0;
      case '<': return diff < 0;
      default: return diff === 0;
    }
  });
}

function assertBuildNodeMatchesEngine(): void {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    engines?: { node?: string };
  };
  const range = pkg.engines?.node;
  if (!range) throw new Error('root package.json has no engines.node');
  const version = parseVersion(process.version);
  if (!satisfiesEngine(version, range)) {
    throw new Error(`build Node ${process.version} does not satisfy engines.node "${range}"`);
  }
  console.log(`node ${process.version} satisfies engines.node "${range}"`);
}

// Asks Nx for every project and its root, then reads each project's package.json "sea" registration.
function discoverRegistrations(): Registration[] {
  const names = JSON.parse(
    execFileSync('pnpm', ['exec', 'nx', 'show', 'projects', '--json'], { cwd: root, encoding: 'utf8' }),
  ) as string[];

  const registrations: Registration[] = [];
  for (const projectName of names) {
    const project = JSON.parse(
      execFileSync('pnpm', ['exec', 'nx', 'show', 'project', projectName, '--json'], { cwd: root, encoding: 'utf8' }),
    ) as { root: string };
    const manifestPath = join(root, project.root, 'package.json');
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      sea?: { service?: unknown; entry?: unknown };
    };
    if (manifest.sea === undefined) continue;
    const { service, entry } = manifest.sea;
    if (typeof service !== 'string' || service === '' || typeof entry !== 'string' || entry === '') {
      throw new Error(`${projectName}: "sea" needs non-empty string fields "service" and "entry"`);
    }
    const builtEntry = join(root, project.root, entry);
    if (!existsSync(builtEntry)) {
      throw new Error(`${projectName}: missing ${builtEntry}; run the ${projectName} build target first`);
    }
    registrations.push({ service, projectName, entryPath: builtEntry });
  }

  if (registrations.length === 0) {
    throw new Error('no service is registered: add "sea": { "service", "entry" } to a project package.json');
  }
  const seen = new Set<string>();
  for (const registration of registrations) {
    if (seen.has(registration.service)) {
      throw new Error(`service "${registration.service}" is registered more than once`);
    }
    seen.add(registration.service);
  }
  return registrations.sort((a, b) => a.service.localeCompare(b.service));
}

// Each service is a lazy import, so only the role selected at run time starts. The default role is the first service in alphabetical order.
function writeEntry(registrations: Registration[]): void {
  const table = registrations
    .map((r) => `  [${JSON.stringify(r.service)}, () => import(${JSON.stringify(r.entryPath)})],`)
    .join('\n');
  const defaultService = registrations[0].service;
  const source = `// Generated by tools/scripts/compile-sea.ts. Do not edit.
// Role selection: \`--service <name>\` on the command line; default "${defaultService}".
const services = new Map([
${table}
]);
const args = process.argv.slice(1);
const flag = args.indexOf('--service');
const name = flag === -1 ? ${JSON.stringify(defaultService)} : args[flag + 1];
const start = services.get(name);
if (start === undefined) {
  console.error(\`unknown service "\${name}"; registered: \${[...services.keys()].join(', ')}\`);
  process.exit(2);
}
await start();
`;
  writeFileSync(entryPath, source);
}

async function bundle(): Promise<void> {
  await build({
    entryPoints: [entryPath],
    outfile: bundlePath,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node26',
    logLevel: 'warning',
    // CJS dependencies in the ESM bundle call require(); give them a real require (built-ins only, no file system).
    banner: {
      js: "import { createRequire as __seaCreateRequire } from 'node:module'; const require = __seaCreateRequire(import.meta.url);",
    },
    // Nest loads these optional peers only for features this app does not use (microservices, websockets, validation pipes).
    external: [
      '@nestjs/microservices',
      '@nestjs/microservices/*',
      '@nestjs/websockets',
      '@nestjs/websockets/*',
      'class-validator',
      'class-transformer',
    ],
  });
}

function writeSeaConfig(): void {
  const config = {
    main: bundlePath,
    mainFormat: 'module',
    output: binaryPath,
    useVfs: false,
    useSnapshot: false,
    useCodeCache: true,
    execArgvExtension: 'none',
  };
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

function buildSea(): void {
  execFileSync(process.execPath, ['--build-sea', configPath], { stdio: 'inherit' });
  // The Node SEA doc requires an ad-hoc signature on macOS; an unsigned arm64 binary is killed at start.
  if (process.platform === 'darwin') {
    execFileSync('codesign', ['--sign', '-', binaryPath], { stdio: 'inherit' });
  }
}

async function main(): Promise<void> {
  assertBuildNodeMatchesEngine();
  const registrations = discoverRegistrations();
  console.log(`registered services: ${registrations.map((r) => r.service).join(', ')}`);

  rmSync(workDir, { recursive: true, force: true });
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  writeEntry(registrations);
  await bundle();
  writeSeaConfig();
  buildSea();

  const size = statSync(binaryPath).size;
  console.log(`sea executable: ${binaryPath} (${size} bytes)`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
