// Packages a supervisor app and its workspace service dependencies into ONE Node SEA executable.
// Run from the repository root: `node tools/scripts/compile-sea.ts <supervisor-project> [--target <triple> --executable <node-binary>]`.
// Without --target the build is native (host triple). A different --target is a cross build: it needs --executable (the Node binary of the target, used as the SEA base) and turns the code cache off (REQ-SEA-03). Cross builds are not verified.
// Dependencies of the supervisor (`workspace:` ranges) are classified by build output: <root>/dist/main.js is a service; <root>/dist/<name>/browser/index.html (or angular.json outputPath + /browser) is a web bundle; anything else fails.
// At most one web bundle; zero means no web assets and no --web flag.
// The generated role-map entry and the SEA config are written under dist/ at build time and are never committed.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import * as rspackNamespace from '@rspack/core';
import sharedNestConfig from '../rspack/nest.config.ts';
import {
  BUILD_INFO_FILE,
  MANIFEST_FILE,
  PACK_OUT_DIR,
  buildInfoAssetName,
  manifestAssetName,
  migrationAssetName,
  migrationsDir,
} from './pack-migrations.ts';

const root = resolve(import.meta.dirname, '..', '..');
const workDir = join(root, 'dist', 'sea-package');
const entryPath = join(workDir, 'entry.mjs');
const bundlePath = join(workDir, 'sea-app.mjs');
const servicesPath = join(workDir, 'services.json');
const configPath = join(workDir, 'sea-config.json');
const manifestPath = join(workDir, 'web-manifest.json');
const vectorPinPath = join(workDir, 'sqlite-vector-pin.json');
// Versioned pin table of the sqlite-vector library (REQ-DB-09): source, version and sha256 per platform.
const vectorTablePath = join(root, 'tools', 'vector', 'sqlite-vector-1.1.2.json');
// Downloaded tarballs are cached here and re-verified on every build.
const vectorCacheDir = join(root, 'dist', 'vector-cache');

// Keys are "<process.platform> <process.arch>"; values are Rust target triples (the Tauri sidecar naming).
const TARGET_TRIPLES: Record<string, string> = {
  'darwin arm64': 'aarch64-apple-darwin',
  'darwin x64': 'x86_64-apple-darwin',
  'linux x64': 'x86_64-unknown-linux-gnu',
  'linux arm64': 'aarch64-unknown-linux-gnu',
  'win32 x64': 'x86_64-pc-windows-msvc',
  'win32 arm64': 'aarch64-pc-windows-msvc',
};

// Target triple to the platform key of the pin table (the runtime key of sqlite-vector.ts). Linux triples here are glibc.
const VECTOR_PLATFORM_KEYS: Record<string, string> = {
  'aarch64-apple-darwin': 'darwin-arm64',
  'x86_64-apple-darwin': 'darwin-x64',
  'x86_64-unknown-linux-gnu': 'linux-x64-glibc',
  'aarch64-unknown-linux-gnu': 'linux-arm64-glibc',
  'x86_64-pc-windows-msvc': 'win32-x64',
};

type Version = [number, number, number];

interface ServiceEntry {
  service: string;
  entryPath: string;
}

// Built entry of a workspace library (package.json "main"); bundled into the executable, never started.
interface LibEntry {
  name: string;
  entryPath: string;
}

interface WebBundle {
  name: string;
  dir: string;
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

function hostTriple(): string {
  const triple = TARGET_TRIPLES[`${process.platform} ${process.arch}`];
  if (triple === undefined) {
    throw new Error(`unsupported platform ${process.platform} ${process.arch}: no Rust target triple`);
  }
  return triple;
}

interface BuildTarget {
  triple: string;
  // Node binary used as the SEA base; undefined means the running Node (native build).
  executable: string | undefined;
}

// Native by default; a target that differs from the host needs the target's own Node binary.
function resolveTarget(argv: readonly string[]): { supervisor: string; target: BuildTarget } {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: { target: { type: 'string' }, executable: { type: 'string' } },
  });
  const [supervisor, ...extra] = positionals;
  if (!supervisor || extra.length > 0) {
    throw new Error('usage: node tools/scripts/compile-sea.ts <supervisor-project> [--target <triple> --executable <node-binary>]');
  }
  const host = hostTriple();
  const triple = values.target ?? host;
  if (!Object.values(TARGET_TRIPLES).includes(triple)) throw new Error(`unknown --target "${triple}"`);
  if (triple !== host && values.executable === undefined) {
    throw new Error(`cross build for ${triple} on ${host} needs --executable <node binary of the target>`);
  }
  if (triple === host && values.executable !== undefined) {
    throw new Error('--executable is only for a cross build; omit it for a native build');
  }
  return { supervisor, target: { triple, executable: values.executable } };
}

// Asks Nx where a project lives; the project name is the package name.
function projectRoot(name: string): string {
  const project = JSON.parse(
    execFileSync('pnpm', ['exec', 'nx', 'show', 'project', name, '--json'], { cwd: root, encoding: 'utf8' }),
  ) as { root: string };
  return join(root, project.root);
}

// Angular browser output: angular.json outputPath (default dist/<name>) plus the application builder's browser/ folder.
function webBrowserDir(name: string, projectDir: string): string {
  const angularJson = join(projectDir, 'angular.json');
  const config = existsSync(angularJson)
    ? (JSON.parse(readFileSync(angularJson, 'utf8')) as {
        architect?: { build?: { options?: { outputPath?: string } } };
      })
    : undefined;
  const outputPath = config?.architect?.build?.options?.outputPath ?? join('dist', name);
  return join(projectDir, outputPath, 'browser');
}

// The library that holds the dispatcher contract. Its name is the one bootstrap literal: the library cannot supply its own location.
const REGISTRY_LIB = 'service-registry';

type Registry = typeof import('service-registry');

// Loads the built contract library; every other literal of the assembler comes from its ASSEMBLER_CONFIG.
async function loadRegistry(): Promise<{ lib: LibEntry; contract: Registry }> {
  const dir = projectRoot(REGISTRY_LIB);
  const main = (JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { main?: string }).main;
  if (main === undefined || !existsSync(join(dir, main))) {
    throw new Error(`${REGISTRY_LIB}: missing built "main" under ${dir}; run the ${REGISTRY_LIB} build target first`);
  }
  const entryPath = join(dir, main);
  return { lib: { name: REGISTRY_LIB, entryPath }, contract: (await import(entryPath)) as Registry };
}

// Classifies one workspace dependency by its build output shape; the first matching shape wins.
function classify(
  name: string,
  serviceEntry: string,
): { kind: 'service'; entry: ServiceEntry } | { kind: 'web'; bundle: WebBundle } | { kind: 'lib'; lib: LibEntry } {
  const dir = projectRoot(name);
  const entry = join(dir, serviceEntry);
  if (existsSync(entry)) return { kind: 'service', entry: { service: name, entryPath: entry } };
  const browser = webBrowserDir(name, dir);
  if (existsSync(join(browser, 'index.html'))) return { kind: 'web', bundle: { name, dir: browser } };
  const main = (JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { main?: string }).main;
  if (main !== undefined && existsSync(join(dir, main))) return { kind: 'lib', lib: { name, entryPath: join(dir, main) } };
  throw new Error(
    `${name}: neither a service (missing ${entry}), a web bundle (missing ${join(browser, 'index.html')}) nor a library (missing package.json "main" output); run the ${name} build target first`,
  );
}

// Dependencies are the supervisor's workspace dependencies, read from its own package.json.
function discoverDependencies(
  supervisor: string,
  supervisorDir: string,
  serviceEntry: string,
): { services: ServiceEntry[]; web: WebBundle | undefined } {
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
  const classified = names.map((name) => classify(name, serviceEntry));
  const services = classified.flatMap((c) => (c.kind === 'service' ? [c.entry] : []));
  const webs = classified.flatMap((c) => (c.kind === 'web' ? [c.bundle] : []));
  if (!classified.some((c) => c.kind === 'lib' && c.lib.name === REGISTRY_LIB)) {
    throw new Error(`${supervisor} must depend on the ${REGISTRY_LIB} library (workspace:*)`);
  }
  if (webs.length > 1) {
    throw new Error(`exactly one web bundle is allowed; found ${webs.map((w) => w.name).join(', ')}`);
  }
  if (services.length === 0) {
    throw new Error(`${supervisor} has no service dependency (${serviceEntry})`);
  }
  return { services, web: webs[0] };
}

// Builds the registry from the discovered services and validates it with the 2b contract. Every declared entrypoint must exist; this runs before bundling and before `node --build-sea`.
function validateRegistry(services: ServiceEntry[], contract: Registry): string[] {
  const parsed = contract.serviceRegistrySchema.safeParse(
    services.map((s) => ({ id: s.service, entry: s.entryPath })),
  );
  if (!parsed.success) {
    throw new Error(`invalid service registry: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
  }
  for (const service of parsed.data) {
    if (!existsSync(service.entry)) throw new Error(`service "${service.id}": declared entrypoint missing: ${service.entry}`);
  }
  return parsed.data.filter((s) => s.enabled).map((s) => s.id);
}

// The generated entry only lists the registered services; the dispatcher (libs/service-registry) picks the role: no --service starts the supervisor, --service <id> starts that one service, anything else exits with the reject code.
function writeEntry(supervisorEntry: string, services: ServiceEntry[], registry: LibEntry): void {
  const table = services
    .map((s) => `  [${JSON.stringify(s.service)}, () => import(${JSON.stringify(s.entryPath)})],`)
    .join('\n');
  const source = `// Generated by tools/scripts/compile-sea.ts. Do not edit.
import { DISPATCHER_CONFIG, dispatch } from ${JSON.stringify(registry.entryPath)};

const services = new Map([
${table}
]);
const target = dispatch(process.argv.slice(2), [...services.keys()]);
if (target.kind === 'rejected') {
  console.error(target.message);
  process.exit(DISPATCHER_CONFIG.rejectExitCode);
} else if (target.kind === 'service') {
  await services.get(target.id)();
} else {
  await import(${JSON.stringify(supervisorEntry)});
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

// Every file of the web bundle becomes SEA asset "web/<relative path>"; the manifest (path to sha256) is written next to the bundle and embedded as "web-manifest.json".
// No web bundle means no web assets and no manifest; the supervisor then passes no --web flag. With a bundle, the supervisor reads the files in memory (getRawAsset) and sends them to the gateway over IPC; nothing is extracted.
function webAssets(web: WebBundle | undefined): Record<string, string> {
  if (web === undefined) return {};
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
    );
  const files = walk(web.dir).map((file) => file.slice(web.dir.length + 1).split('\\').join('/')).sort();
  const hashes = Object.fromEntries(
    files.map((rel) => [rel, createHash('sha256').update(readFileSync(join(web.dir, rel))).digest('hex')]),
  );
  writeFileSync(manifestPath, `${JSON.stringify({ files: hashes }, null, 2)}\n`);
  const assets: Record<string, string> = { 'web-manifest.json': manifestPath };
  for (const rel of files) assets[`web/${rel}`] = join(web.dir, rel);
  console.log(`web bundle ${web.name}: ${files.length} files from ${web.dir}`);
  return assets;
}

// The sqlite-vector variant of the target becomes SEA assets "sqlite-vector/<file>" and "sqlite-vector/pin.json" (names mirror libs/shared-core/src/db/sqlite-vector.ts).
// The tarball comes from the pinned npm URL, is checked against the pinned sha512 integrity, and its binary against the pinned sha256. A platform without a pin fails the build.
async function vectorAssets(target: BuildTarget): Promise<Record<string, string>> {
  const table = JSON.parse(readFileSync(vectorTablePath, 'utf8')) as {
    version: string;
    unavailable: string[];
    platforms: Record<string, { tarball: string; tarballIntegrity: string; file: string; librarySha256: string }>;
  };
  const key = VECTOR_PLATFORM_KEYS[target.triple];
  const entry = key === undefined ? undefined : table.platforms[key];
  if (key === undefined || entry === undefined) {
    throw new Error(
      `sqlite-vector ${table.version} has no pinned binary for ${target.triple}; unavailable upstream: ${table.unavailable.join(', ')}`,
    );
  }
  mkdirSync(vectorCacheDir, { recursive: true });
  const tarball = join(vectorCacheDir, `${key}-${table.version}.tgz`);
  const integrityOf = (file: string): string => `sha512-${createHash('sha512').update(readFileSync(file)).digest('base64')}`;
  if (!existsSync(tarball) || integrityOf(tarball) !== entry.tarballIntegrity) {
    const response = await fetch(entry.tarball);
    if (!response.ok) throw new Error(`download ${entry.tarball} failed: HTTP ${response.status}`);
    writeFileSync(tarball, Buffer.from(await response.arrayBuffer()));
  }
  if (integrityOf(tarball) !== entry.tarballIntegrity) throw new Error(`sqlite-vector tarball integrity mismatch for ${key}`);
  const extractDir = join(vectorCacheDir, `${key}-${table.version}`);
  rmSync(extractDir, { recursive: true, force: true });
  mkdirSync(extractDir, { recursive: true });
  execFileSync('tar', ['-xzf', tarball, '-C', extractDir, `package/${entry.file}`]);
  const binary = join(extractDir, 'package', entry.file);
  const sha256 = createHash('sha256').update(readFileSync(binary)).digest('hex');
  if (sha256 !== entry.librarySha256) throw new Error(`sqlite-vector binary sha256 mismatch for ${key}: expected ${entry.librarySha256}, got ${sha256}`);
  writeFileSync(vectorPinPath, `${JSON.stringify({ version: table.version, platform: key, file: entry.file, sha256 }, null, 2)}\n`);
  console.log(`sqlite-vector ${table.version}: ${key} ${entry.file} sha256 ${sha256}`);
  return { 'sqlite-vector/pin.json': vectorPinPath, [`sqlite-vector/${entry.file}`]: binary };
}

// The packed migrations (pack-migrations.ts, run before this script) become SEA assets "db-migrations/manifest.json", "db-migrations/build-info.json" and "db-migrations/<tag>.sql".
// Asset names come from the constants shared with the pack step; only SQL and JSON travel, never Drizzle (S7).
function migrationAssets(): Record<string, string> {
  const manifestPath = join(PACK_OUT_DIR, MANIFEST_FILE);
  const buildInfoPath = join(PACK_OUT_DIR, BUILD_INFO_FILE);
  for (const path of [manifestPath, buildInfoPath]) {
    if (!existsSync(path)) throw new Error(`${path} missing; run "node tools/scripts/pack-migrations.ts" first`);
  }
  const { migrations } = JSON.parse(readFileSync(manifestPath, 'utf8')) as { migrations: { file: string; sha256: string }[] };
  const assets: Record<string, string> = { [manifestAssetName]: manifestPath, [buildInfoAssetName]: buildInfoPath };
  for (const { file, sha256 } of migrations) {
    const path = join(migrationsDir, file);
    if (createHash('sha256').update(readFileSync(path, 'utf8')).digest('hex') !== sha256) {
      throw new Error(`${file}: differs from the packed manifest; run "node tools/scripts/pack-migrations.ts" again`);
    }
    assets[migrationAssetName(file)] = path;
  }
  console.log(`db migrations: ${migrations.length} sql file(s) plus manifest and build info`);
  return assets;
}

// REQ-SEA-03 baseline from ASSEMBLER_CONFIG; the code cache follows the native/cross rule; a cross build names the target's Node as the SEA base.
function writeSeaConfig(
  binaryPath: string,
  web: WebBundle | undefined,
  contract: Registry,
  target: BuildTarget,
  vector: Record<string, string>,
): void {
  const { ASSEMBLER_CONFIG, DISPATCHER_CONFIG } = contract;
  const config = {
    main: bundlePath,
    mainFormat: ASSEMBLER_CONFIG.mainFormat,
    output: binaryPath,
    ...(target.executable === undefined ? {} : { executable: target.executable }),
    useVfs: ASSEMBLER_CONFIG.useVfs,
    useSnapshot: ASSEMBLER_CONFIG.useSnapshot,
    useCodeCache: contract.useCodeCache(hostTriple(), target.triple),
    execArgvExtension: ASSEMBLER_CONFIG.execArgvExtension,
    assets: { [DISPATCHER_CONFIG.servicesAsset]: servicesPath, ...webAssets(web), ...vector, ...migrationAssets() },
  };
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

function buildSea(binaryPath: string, target: BuildTarget): void {
  execFileSync(process.execPath, ['--build-sea', configPath], { stdio: 'inherit' });
  // The Node SEA doc requires an ad-hoc signature on macOS; an unsigned arm64 binary is killed at start. codesign only runs for a macOS target built on macOS.
  if (process.platform === 'darwin' && target.triple.endsWith('-apple-darwin')) {
    execFileSync('codesign', ['--sign', '-', binaryPath], { stdio: 'inherit' });
  }
}

async function main(): Promise<void> {
  const { supervisor, target } = resolveTarget(process.argv.slice(2));
  assertBuildNodeMatchesEngine();

  const { lib: registry, contract } = await loadRegistry();
  const supervisorDir = projectRoot(supervisor);
  const supervisorEntry = join(supervisorDir, contract.ASSEMBLER_CONFIG.serviceEntry);
  if (!existsSync(supervisorEntry)) {
    throw new Error(`${supervisor}: missing ${supervisorEntry}; run the ${supervisor} build target first`);
  }
  const { services, web } = discoverDependencies(supervisor, supervisorDir, contract.ASSEMBLER_CONFIG.serviceEntry);
  const serviceIds = validateRegistry(services, contract);
  console.log(
    `supervisor ${supervisor}; services: ${serviceIds.join(', ')}; web: ${web?.name ?? 'none'}; target ${target.triple}; code cache ${contract.useCodeCache(hostTriple(), target.triple) ? 'on' : 'off'}`,
  );

  const artifactDir = join(root, 'artifacts', supervisor);
  const binaryName = `${supervisor}-${target.triple}${target.triple.includes('windows') ? '.exe' : ''}`;
  const binaryPath = join(artifactDir, binaryName);

  rmSync(workDir, { recursive: true, force: true });
  rmSync(artifactDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });
  mkdirSync(artifactDir, { recursive: true });

  writeEntry(supervisorEntry, services, registry);
  writeFileSync(
    servicesPath,
    `${JSON.stringify(contract.servicesAssetSchema.parse({ services: serviceIds }), null, 2)}\n`,
  );
  await bundle();
  const vector = await vectorAssets(target);
  writeSeaConfig(binaryPath, web, contract, target, vector);
  buildSea(binaryPath, target);

  console.log(`sea executable: ${binaryPath} (${statSync(binaryPath).size} bytes)`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
