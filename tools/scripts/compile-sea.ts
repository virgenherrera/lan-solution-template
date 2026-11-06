// Packages a supervisor app and its workspace service dependencies into ONE Node SEA executable.
// Run from the repository root: `node tools/scripts/compile-sea.ts <supervisor-project> [--target <triple> --executable <node-binary>]`.
// Without --target the build is native (host triple). A different --target is a cross build: it needs --executable (the Node binary of the target, used as the SEA base) and turns the code cache off (REQ-SEA-03). Cross builds are not verified.
// Dependencies of the supervisor (`workspace:` ranges) are classified by build output: <root>/dist/main.js is a service; <root>/dist/<name>/browser/index.html (or angular.json outputPath + /browser) is a web bundle; anything else fails.
// At most one web bundle; zero means no web assets and no --web flag.
// The SEA entry is TypeScript (apps/sea-runtime/src/sea-entry.ts); the bundle, the staged service bootstraps and the SEA config are written under dist/ at build time and are never committed.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import * as rspackNamespace from '@rspack/core';
import sharedNestConfig from '../rspack/nest.config.ts';
import {
  BUILD_INFO_FILE,
  MANIFEST_FILE,
  PACK_OUT_DIR,
  buildInfoAssetName,
  manifestAssetName,
  migrationAssetName,
  packOutDirFor,
} from './pack-migrations.ts';

const root = resolve(import.meta.dirname, '..', '..');
// The pack step wrote the migration manifest with this schema, so it is read back with it (pack-migrations.ts runs first and builds nothing here).
const { manifestSchema } = (await import(join(root, 'libs', 'db-migrations', 'dist', 'contract', 'index.js'))) as typeof import('db-migrations');
// The assembler loads the contract library from its build output, as it does for db-migrations above.
const { jsonText } = (await import(join(root, 'libs', 'service-registry', 'dist', 'json-text.js'))) as typeof import('../../libs/service-registry/dist/json-text.js');

// Only the fields this script reads. Files other tools own (package.json, angular.json, nx output) stay loose; the vector pin table is ours and stays strict.
const rootPackageSchema = z.looseObject({ engines: z.looseObject({ node: z.string().optional() }).optional() });
const mainPackageSchema = z.looseObject({ main: z.string().optional() });
const dependencyPackageSchema = z.looseObject({
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
});
const nxProjectSchema = z.looseObject({ root: z.string() });
const angularJsonSchema = z.looseObject({
  architect: z.looseObject({ build: z.looseObject({ options: z.looseObject({ outputPath: z.string().optional() }).optional() }).optional() }).optional(),
});
const vectorTableSchema = z.strictObject({
  library: z.string(),
  version: z.string(),
  source: z.string(),
  platforms: z.record(
    z.string(),
    z.strictObject({ package: z.string(), tarball: z.string(), tarballIntegrity: z.string(), file: z.string(), librarySha256: z.string() }),
  ),
  unavailable: z.array(z.string()),
});

function readJson<S extends z.ZodType>(path: string, schema: S): z.output<S> {
  return parseJson(path, readFileSync(path, 'utf8'), schema);
}

function parseJson<S extends z.ZodType>(label: string, text: string, schema: S): z.output<S> {
  const parsed = jsonText(schema).safeParse(text);
  if (!parsed.success) throw new Error(`${label}: ${z.prettifyError(parsed.error)}`);
  return parsed.data;
}

const workDir = join(root, 'dist', 'sea-package');
// Built service bootstraps are staged here, one copy per registered service; the SEA entry reaches them through the alias sea-services.
const servicesDir = join(workDir, 'services');
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
  const pkg = readJson(join(root, 'package.json'), rootPackageSchema);
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
  const project = parseJson(
    `nx project ${name}`,
    execFileSync('pnpm', ['exec', 'nx', 'show', 'project', name, '--json'], { cwd: root, encoding: 'utf8' }),
    nxProjectSchema,
  );
  return join(root, project.root);
}

// Angular browser output: angular.json outputPath (default dist/<name>) plus the application builder's browser/ folder.
function webBrowserDir(name: string, projectDir: string): string {
  const angularJson = join(projectDir, 'angular.json');
  const config = existsSync(angularJson)
    ? readJson(angularJson, angularJsonSchema)
    : undefined;
  const outputPath = config?.architect?.build?.options?.outputPath ?? join('dist', name);
  return join(projectDir, outputPath, 'browser');
}

// The library that holds the dispatcher contract. Its name is the one bootstrap literal: the library cannot supply its own location.
const REGISTRY_LIB = 'service-registry';

type Registry = typeof import('service-registry');
type DeclaredEntry = import('service-registry').ServiceEntry;

// Loads the built contract library; every other literal of the assembler comes from its ASSEMBLER_CONFIG.
async function loadRegistry(): Promise<Registry> {
  const dir = projectRoot(REGISTRY_LIB);
  const main = readJson(join(dir, 'package.json'), mainPackageSchema).main;
  if (main === undefined || !existsSync(join(dir, main))) {
    throw new Error(`${REGISTRY_LIB}: missing built "main" under ${dir}; run the ${REGISTRY_LIB} build target first`);
  }
  return (await import(join(dir, main))) as Registry;
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
  const main = readJson(join(dir, 'package.json'), mainPackageSchema).main;
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
  const manifest = readJson(join(supervisorDir, 'package.json'), dependencyPackageSchema);
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

// Matches each declared route to the built service of its workspace project, so the entry table is keyed by route id. Runs before bundling and before `node --build-sea`.
function resolveRoutes(routes: readonly DeclaredEntry[], built: ServiceEntry[], supervisor: string, serviceEntry: string): ServiceEntry[] {
  return routes.map((route) => {
    const found = built.find((s) => s.service === route.id);
    if (found === undefined) {
      throw new Error(
        `service "${route.id}": project "${route.id}" is not a built workspace dependency of ${supervisor}; add it as "workspace:*" and build it (${serviceEntry})`,
      );
    }
    return { service: route.id, entryPath: found.entryPath };
  });
}

// The entry (sea-entry.ts) picks the role through the dispatcher and reaches each registered service with one import() context, so only registered services reach the bundle.
function stageServices(services: ServiceEntry[]): void {
  mkdirSync(servicesDir, { recursive: true });
  for (const s of services) copyFileSync(s.entryPath, join(servicesDir, `${s.service}.js`));
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
async function bundle(supervisorEntry: string, certsCommandEntry: string): Promise<void> {
  const shared = sharedNestConfig({ plugins: [] }, rspackNamespace);
  await runRspack({
    mode: 'production',
    devtool: false,
    target: 'node',
    entry: join(root, 'apps', 'sea-runtime', 'src', 'sea-entry.ts'),
    resolve: {
      extensionAlias: { '.js': ['.ts', '.js'] },
      alias: { 'sea-services': servicesDir, 'sea-supervisor$': supervisorEntry, 'sea-certs-command$': certsCommandEntry },
    },
    module: {
      rules: [{ test: /\.ts$/, loader: 'builtin:swc-loader', type: 'javascript/auto', options: { jsc: { parser: { syntax: 'typescript' }, target: 'es2023' } } }],
    },
    output: {
      path: workDir,
      filename: 'sea-app.mjs',
      module: true,
      library: { type: 'module' },
      chunkFormat: 'module',
    },
    experiments: { outputModule: true },
    externals: shared.externals,
    optimization: shared.optimization,
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
  const table = readJson(vectorTablePath, vectorTableSchema);
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

// The packed migrations (pack-migrations.ts, run before this script) become SEA assets "db-migrations/<engine>/manifest.json", "db-migrations/<engine>/build-info.json" and "db-migrations/<engine>/<tag>.sql".
// Every packed engine is embedded and the runtime reads only the selected one. Asset names come from the constants shared with the pack step; only SQL and JSON travel, never Drizzle (S7).
function engineMigrationAssets(engine: string): Record<string, string> {
  const outDir = packOutDirFor(engine);
  const manifestPath = join(outDir, MANIFEST_FILE);
  const buildInfoPath = join(outDir, BUILD_INFO_FILE);
  for (const path of [manifestPath, buildInfoPath]) {
    if (!existsSync(path)) throw new Error(`${path} missing; run "node tools/scripts/pack-migrations.ts --engine ${engine}" first`);
  }
  const { migrations, engine: packedEngine } = readJson(manifestPath, manifestSchema);
  if (packedEngine !== engine) throw new Error(`${manifestPath}: packed for engine "${packedEngine}", expected "${engine}"`);
  const assets: Record<string, string> = { [manifestAssetName(engine)]: manifestPath, [buildInfoAssetName(engine)]: buildInfoPath };
  for (const { file, sha256 } of migrations) {
    const path = join(outDir, file);
    if (!existsSync(path) || createHash('sha256').update(readFileSync(path, 'utf8')).digest('hex') !== sha256) {
      throw new Error(`${path}: missing or differs from the packed manifest; run "node tools/scripts/pack-migrations.ts --engine ${engine}" again`);
    }
    assets[migrationAssetName(engine, file)] = path;
  }
  console.log(`db migrations (${engine}): ${migrations.length} sql file(s) plus manifest and build info`);
  return assets;
}

function migrationAssets(): Record<string, string> {
  const engines = existsSync(PACK_OUT_DIR) ? readdirSync(PACK_OUT_DIR, { withFileTypes: true }).filter((entry) => entry.isDirectory()) : [];
  if (engines.length === 0) throw new Error(`${PACK_OUT_DIR}: no packed engine; run "node tools/scripts/pack-migrations.ts" first`);
  return Object.assign({}, ...engines.map((entry) => engineMigrationAssets(entry.name)));
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

  const contract = await loadRegistry();
  const supervisorDir = projectRoot(supervisor);
  const supervisorEntry = join(supervisorDir, contract.ASSEMBLER_CONFIG.serviceEntry);
  if (!existsSync(supervisorEntry)) {
    throw new Error(`${supervisor}: missing ${supervisorEntry}; run the ${supervisor} build target first`);
  }
  // The `--generate-certs` operation lives in shared-core (a built workspace dependency of the supervisor); it is not part of the library's public exports.
  const certsCommandEntry = join(projectRoot('shared-core'), 'dist', 'tls', 'certs-command.js');
  if (!existsSync(certsCommandEntry)) {
    throw new Error(`shared-core: missing ${certsCommandEntry}; run the shared-core build target first`);
  }
  const built = discoverDependencies(supervisor, supervisorDir, contract.ASSEMBLER_CONFIG.serviceEntry);
  // Loaded after the contract check above: services.ts imports the built service-registry.
  const { SERVICES } = (await import('../../apps/sea-runtime/src/services.ts')) as typeof import('../../apps/sea-runtime/src/services.ts');
  const declared = contract.serviceEntries(SERVICES);
  const services = resolveRoutes(declared, built.services, supervisor, contract.ASSEMBLER_CONFIG.serviceEntry);
  const web = built.web;
  console.log(
    `supervisor ${supervisor}; services: ${declared.filter((r) => r.enabled).map((r) => r.id).join(', ')}; web: ${web?.name ?? 'none'}; target ${target.triple}; code cache ${contract.useCodeCache(hostTriple(), target.triple) ? 'on' : 'off'}`,
  );

  const artifactDir = join(root, 'artifacts', supervisor);
  const binaryName = `${supervisor}-${target.triple}${target.triple.includes('windows') ? '.exe' : ''}`;
  const binaryPath = join(artifactDir, binaryName);

  rmSync(workDir, { recursive: true, force: true });
  rmSync(artifactDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });
  mkdirSync(artifactDir, { recursive: true });

  stageServices(services);
  writeFileSync(
    servicesPath,
    `${JSON.stringify(contract.servicesAssetSchema.parse({ services: declared }), null, 2)}\n`,
  );
  await bundle(supervisorEntry, certsCommandEntry);
  const vector = await vectorAssets(target);
  writeSeaConfig(binaryPath, web, contract, target, vector);
  buildSea(binaryPath, target);

  console.log(`sea executable: ${binaryPath} (${statSync(binaryPath).size} bytes)`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
