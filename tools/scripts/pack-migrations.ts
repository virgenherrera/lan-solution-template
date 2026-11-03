// Packs the generated SQL migrations for the SEA (S7, S8). Run from the repository root: `node tools/scripts/pack-migrations.ts [--engine sqlite]`.
// Reads libs/db-migrations/<engine>/migrations (journal order), writes dist/db-migrations/<engine>/{manifest.json,build-info.json,<tag>.sql}.
// Without --engine it packs every engine the db-migrations contract lists (ENGINES); there is no implicit single engine.
// Needs the built db-migrations library (`pnpm --filter db-migrations run build`): the manifest is validated with its Zod schema.
// Only the SQL and the two JSON files travel in the SEA; Drizzle never does. compile-sea.ts imports the constants below.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const libDir = join(root, 'libs', 'db-migrations');
export const migrationsDirFor = (engine: string): string => join(libDir, engine, 'migrations');
const contractPath = join(libDir, 'dist', 'contract', 'index.js');

// Where the pack step writes, and the SEA asset names shared with compile-sea.ts and the boot code that reads them.
// Asset names: "db-migrations/<engine>/manifest.json", "db-migrations/<engine>/build-info.json" and "db-migrations/<engine>/<tag>.sql".
export const PACK_OUT_DIR = join(root, 'dist', 'db-migrations');
export const MANIFEST_FILE = 'manifest.json';
export const BUILD_INFO_FILE = 'build-info.json';
export const MIGRATIONS_ASSET_DIR = 'db-migrations';
export const packOutDirFor = (engine: string): string => join(PACK_OUT_DIR, engine);
export const manifestAssetName = (engine: string): string => `${MIGRATIONS_ASSET_DIR}/${engine}/${MANIFEST_FILE}`;
export const buildInfoAssetName = (engine: string): string => `${MIGRATIONS_ASSET_DIR}/${engine}/${BUILD_INFO_FILE}`;
export const migrationAssetName = (engine: string, file: string): string => `${MIGRATIONS_ASSET_DIR}/${engine}/${file}`;

// Separator emitted by drizzle-kit between statements (S8).
const STATEMENT_BREAKPOINT = '--> statement-breakpoint';
// Exact semver (optionally pre-release/build); anything with ^ ~ or a range operator fails.
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

interface Journal {
  entries: { idx: number; tag: string }[];
}

function fail(message: string): never {
  throw new Error(message);
}

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

function exact(name: string, version: string | undefined, where: string): string {
  if (version === undefined || !EXACT_VERSION.test(version)) {
    fail(`${where}: "${name}" version "${version ?? ''}" is not an exact version (no ^, ~ or range)`);
  }
  return `${name}@${version}`;
}

function packageVersion(relativeDir: string): string {
  const path = join(root, relativeDir, 'package.json');
  const pkg = readJson<{ name?: string; version?: string }>(path);
  return exact(pkg.name ?? fail(`${path}: no name`), pkg.version, path);
}

// drizzle-kit as pinned for the library: a literal devDependency, or a `catalog:` reference whose version the lockfile resolves to the installed copy.
function drizzleKit(): string {
  const path = join(libDir, 'package.json');
  const spec = readJson<{ devDependencies?: Record<string, string> }>(path).devDependencies?.['drizzle-kit'];
  const installedPath = join(libDir, 'node_modules', 'drizzle-kit', 'package.json');
  const installed = existsSync(installedPath) ? readJson<{ version?: string }>(installedPath).version : undefined;
  if (spec?.startsWith('catalog:')) return exact('drizzle-kit', installed ?? fail(`${installedPath}: run \`pnpm install\` first`), installedPath);
  if (installed !== undefined && installed !== spec) fail(`${installedPath}: installed drizzle-kit ${installed} differs from the pin ${spec}`);
  return exact('drizzle-kit', spec, path);
}

// A file with several statements needs the drizzle-kit marker; a plain file may hold one statement only.
function assertStatements(file: string, text: string): void {
  if (text.includes(STATEMENT_BREAKPOINT)) return;
  const statements = text
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .filter((part) => part.trim() !== '');
  if (statements.length > 1) {
    fail(`${file}: ${statements.length} statements without the "${STATEMENT_BREAKPOINT}" marker`);
  }
}

function readEntries(engine: string): { id: number; tag: string; file: string; sha256: string }[] {
  const migrationsDir = migrationsDirFor(engine);
  const journalPath = join(migrationsDir, 'meta', '_journal.json');
  const journal = readJson<Journal>(journalPath);
  const entries = [...journal.entries].sort((a, b) => a.idx - b.idx);
  entries.forEach((entry, position) => {
    if (entry.idx !== position) fail(`${journalPath}: journal gap, expected idx ${position}, found ${entry.idx}`);
  });
  const listed = new Set(entries.map((entry) => `${entry.tag}.sql`));
  const stray = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql') && !listed.has(name));
  if (stray.length > 0) fail(`${migrationsDir}: .sql files outside the journal: ${stray.join(', ')}`);
  return entries.map((entry) => {
    const file = `${entry.tag}.sql`;
    const path = join(migrationsDir, file);
    if (!existsSync(path)) fail(`${path}: listed in the journal but missing`);
    const text = readFileSync(path, 'utf8');
    assertStatements(file, text);
    return { id: entry.idx, tag: entry.tag, file, sha256: createHash('sha256').update(text).digest('hex') };
  });
}

type ManifestSchema = { parse(value: unknown): { generator: string; migrations: unknown[] } };

function writeEngine(engine: string, manifestSchema: ManifestSchema, buildInfo: { drizzle_version: string }): void {
  const { drizzle_version: generator } = buildInfo;
  const entries = readEntries(engine);
  const manifest = manifestSchema.parse({ engine, generator, migrations: entries });
  const outDir = packOutDirFor(engine);
  // Start clean so a tag removed from the journal cannot linger as a stale .sql.
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  for (const entry of entries) copyFileSync(join(migrationsDirFor(engine), entry.file), join(outDir, entry.file));
  writeFileSync(join(outDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(outDir, BUILD_INFO_FILE), `${JSON.stringify(buildInfo, null, 2)}\n`);
  console.log(`packed ${manifest.migrations.length} migration(s) for ${engine}, generator ${generator}, into ${outDir}`);
}

function requestedEngines(known: readonly string[]): readonly string[] {
  const index = process.argv.indexOf('--engine');
  if (index < 0) return known;
  const engine = process.argv[index + 1] ?? fail('--engine needs a value');
  return known.includes(engine) ? [engine] : fail(`unknown engine "${engine}" (known: ${known.join(', ')})`);
}

async function main(): Promise<void> {
  if (!existsSync(contractPath)) fail(`${contractPath} missing; run "pnpm --filter db-migrations run build" first`);
  const contract = (await import(contractPath)) as { manifestSchema: ManifestSchema; ENGINES: readonly string[] };

  const generator = drizzleKit();
  const sqlite = readJson<{ library: string; version: string }>(join(root, 'tools', 'vector', 'sqlite-vector-1.1.2.json'));
  const buildInfo = {
    runtime_version: packageVersion('apps/sea-runtime'),
    gateway_version: packageVersion('apps/api-gateway'),
    web_version: packageVersion('apps/web-angular'),
    vector_lib_version: exact(sqlite.library, sqlite.version, 'tools/vector/sqlite-vector-1.1.2.json'),
    drizzle_version: generator,
  };
  for (const engine of requestedEngines(contract.ENGINES)) writeEngine(engine, contract.manifestSchema, buildInfo);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
