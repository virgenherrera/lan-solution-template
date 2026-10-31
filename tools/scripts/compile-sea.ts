// Packages a supervisor app and its workspace service dependencies into ONE Node SEA executable.
// Run from the repository root: `node tools/scripts/compile-sea.ts <supervisor-project>`.
// Services are the workspace dependencies of the supervisor (`workspace:` ranges); each service's entry is its built dist/main.js.
// The generated role-map entry and the SEA config are written under dist/ at build time and are never committed.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as rspackNamespace from '@rspack/core';
import sharedNestConfig from '../rspack/nest.config.ts';

const root = resolve(import.meta.dirname, '..', '..');
const workDir = join(root, 'dist', 'sea-package');
const entryPath = join(workDir, 'entry.mjs');
const bundlePath = join(workDir, 'sea-app.mjs');
const servicesPath = join(workDir, 'services.json');
const configPath = join(workDir, 'sea-config.json');

// Keys are "<process.platform> <process.arch>"; values are Rust target triples (the Tauri sidecar naming).
const TARGET_TRIPLES: Record<string, string> = {
  'darwin arm64': 'aarch64-apple-darwin',
  'darwin x64': 'x86_64-apple-darwin',
  'linux x64': 'x86_64-unknown-linux-gnu',
  'linux arm64': 'aarch64-unknown-linux-gnu',
  'win32 x64': 'x86_64-pc-windows-msvc',
  'win32 arm64': 'aarch64-pc-windows-msvc',
};

type Version = [number, number, number];

interface ServiceEntry {
  service: string;
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

function targetTriple(): string {
  const triple = TARGET_TRIPLES[`${process.platform} ${process.arch}`];
  if (triple === undefined) {
    throw new Error(`unsupported platform ${process.platform} ${process.arch}: no Rust target triple`);
  }
  return triple;
}

// Asks Nx where a project lives; the project name is the package name.
function projectRoot(name: string): string {
  const project = JSON.parse(
    execFileSync('pnpm', ['exec', 'nx', 'show', 'project', name, '--json'], { cwd: root, encoding: 'utf8' }),
  ) as { root: string };
  return join(root, project.root);
}

function builtEntry(name: string, projectDir: string): string {
  const entry = join(projectDir, 'dist', 'main.js');
  if (!existsSync(entry)) {
    throw new Error(`${name}: missing ${entry}; run the ${name} build target first`);
  }
  return entry;
}

// Services are the supervisor's workspace dependencies, read from its own package.json.
function discoverServices(supervisor: string, supervisorDir: string): ServiceEntry[] {
  const manifest = JSON.parse(readFileSync(join(supervisorDir, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
  const names = Object.keys(dependencies)
    .filter((name) => dependencies[name]?.startsWith('workspace:'))
    .sort();
  if (names.length === 0) {
    throw new Error(`${supervisor} has no workspace dependency to package as a service`);
  }
  return names.map((name) => ({
    service: name,
    entryPath: builtEntry(name, projectRoot(name)),
  }));
}

// The generated entry picks the role: no --service argument starts the supervisor; --service <id> starts that service.
function writeEntry(supervisorEntry: string, services: ServiceEntry[]): void {
  const table = services
    .map((s) => `  [${JSON.stringify(s.service)}, () => import(${JSON.stringify(s.entryPath)})],`)
    .join('\n');
  const source = `// Generated by tools/scripts/compile-sea.ts. Do not edit.
// No --service argument starts the supervisor; --service <id> starts that one service.
const services = new Map([
${table}
]);
const flag = process.argv.indexOf('--service');
if (flag === -1) {
  await import(${JSON.stringify(supervisorEntry)});
} else {
  const id = process.argv[flag + 1];
  const start = services.get(id);
  if (start === undefined) {
    console.error(\`unknown service "\${id}"; registered: \${[...services.keys()].join(', ')}\`);
    process.exit(2);
  }
  await start();
}
`;
  writeFileSync(entryPath, source);
}

function runRspack(options: rspackNamespace.RspackOptions): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    rspackNamespace.rspack(options, (error, stats) => {
      if (error) return reject(error);
      if (stats?.hasErrors()) return reject(new Error(stats.toString({ all: false, errors: true })));
      resolvePromise();
    });
  });
}

// One ESM file. Externals and ignore rules come from the shared Nest config; the banner gives CommonJS dependencies a real require.
async function bundle(): Promise<void> {
  const shared = sharedNestConfig({ plugins: [] }, rspackNamespace);
  await runRspack({
    mode: 'production',
    devtool: false,
    target: 'node',
    entry: entryPath,
    output: {
      path: workDir,
      filename: 'sea-app.mjs',
      module: true,
      library: { type: 'module' },
      chunkFormat: 'module',
    },
    experiments: { outputModule: true },
    externals: shared.externals,
    plugins: [
      ...shared.plugins,
      new rspackNamespace.BannerPlugin({
        raw: true,
        banner: "import { createRequire as __seaCreateRequire } from 'node:module'; const require = __seaCreateRequire(import.meta.url);",
      }),
    ],
  });
}

function writeSeaConfig(binaryPath: string): void {
  const config = {
    main: bundlePath,
    mainFormat: 'module',
    output: binaryPath,
    useVfs: false,
    useSnapshot: false,
    useCodeCache: true,
    execArgvExtension: 'none',
    assets: { 'services.json': servicesPath },
  };
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

function buildSea(binaryPath: string): void {
  execFileSync(process.execPath, ['--build-sea', configPath], { stdio: 'inherit' });
  // The Node SEA doc requires an ad-hoc signature on macOS; an unsigned arm64 binary is killed at start.
  if (process.platform === 'darwin') {
    execFileSync('codesign', ['--sign', '-', binaryPath], { stdio: 'inherit' });
  }
}

async function main(): Promise<void> {
  const supervisor = process.argv[2];
  if (!supervisor) throw new Error('usage: node tools/scripts/compile-sea.ts <supervisor-project>');
  assertBuildNodeMatchesEngine();

  const supervisorDir = projectRoot(supervisor);
  const supervisorEntry = builtEntry(supervisor, supervisorDir);
  const services = discoverServices(supervisor, supervisorDir);
  console.log(`supervisor ${supervisor}; services: ${services.map((s) => s.service).join(', ')}`);

  const artifactDir = join(root, 'artifacts', supervisor);
  const binaryName = `${supervisor}-${targetTriple()}${process.platform === 'win32' ? '.exe' : ''}`;
  const binaryPath = join(artifactDir, binaryName);

  rmSync(workDir, { recursive: true, force: true });
  rmSync(artifactDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });
  mkdirSync(artifactDir, { recursive: true });

  writeEntry(supervisorEntry, services);
  writeFileSync(
    servicesPath,
    `${JSON.stringify({ services: services.map((s) => s.service) }, null, 2)}\n`,
  );
  await bundle();
  writeSeaConfig(binaryPath);
  buildSea(binaryPath);

  console.log(`sea executable: ${binaryPath} (${statSync(binaryPath).size} bytes)`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
