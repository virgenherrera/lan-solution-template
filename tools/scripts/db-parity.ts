// Parity check (S6). Run from the repository root: `node tools/scripts/db-parity.ts [--engine sqlite] [--migrations-dir <dir>]`.
// Applies the real migrations with the real migrator to a temp database, reads the resulting structure back and
// compares it with the declarative descriptor in libs/db-migrations/contract/tables.ts. Exit 0 = parity, 1 = diff.
// Needs the built libraries: `pnpm --filter shared-core run build` and `pnpm --filter db-migrations run build`.
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const sharedCorePath = join(root, 'libs', 'shared-core', 'dist', 'index.js');
const contractPath = join(root, 'libs', 'db-migrations', 'dist', 'contract', 'index.js');
const DEFAULT_MIGRATIONS_DIR = join(root, 'libs', 'db-migrations', 'sqlite', 'migrations');

// Only sqlite has an adapter wired here; a new engine adds its adapter and the check itself does not change.
const ENGINES: readonly string[] = ['sqlite'];

function fail(message: string): never {
  throw new Error(message);
}

// Same order and numbering as the migrator input: journal idx + 1 is the version.
function readMigrations(dir: string): { version: number; name: string; sql: string }[] {
  const journal = JSON.parse(readFileSync(join(dir, 'meta', '_journal.json'), 'utf8')) as { entries: { idx: number; tag: string }[] };
  return [...journal.entries]
    .sort((a, b) => a.idx - b.idx)
    .map((entry) => ({ version: entry.idx + 1, name: entry.tag, sql: readFileSync(join(dir, `${entry.tag}.sql`), 'utf8') }));
}

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? fail(`--${name} needs a value`)) : fallback;
}

async function main(): Promise<number> {
  const engine = option('engine', 'sqlite');
  if (!ENGINES.includes(engine)) fail(`no introspector for engine "${engine}" (known: ${ENGINES.join(', ')})`);
  for (const path of [sharedCorePath, contractPath]) {
    if (!existsSync(path)) fail(`${path} missing; build shared-core and db-migrations first`);
  }
  const { SqliteAdapter, runMigrations } = (await import(sharedCorePath)) as typeof import('../../libs/shared-core/dist/index.js');
  const { tables, tablesSchema, compareSchema } = (await import(contractPath)) as typeof import('../../libs/db-migrations/dist/contract/index.js');
  const migrations = readMigrations(resolve(option('migrations-dir', DEFAULT_MIGRATIONS_DIR)));

  const workDir = mkdtempSync(join(tmpdir(), 'db-parity-'));
  const db = new SqliteAdapter({ file: 'parity.db', foreignKeys: true, journalMode: 'DELETE', synchronous: 'NORMAL' }, workDir);
  try {
    await db.connect();
    await runMigrations(db, migrations);
    // Validate the descriptor itself first, then compare it exactly with what the real migrations built.
    const diff = compareSchema(tablesSchema.parse(tables), await db.introspectSchema(), 'exact').problems;
    if (diff.length === 0) {
      console.log(`parity ok: ${tables.length} table(s) match the descriptor (engine ${engine})`);
      return 0;
    }
    console.error(`parity FAILED (engine ${engine}):\n${diff.map((line) => `  ${line}`).join('\n')}`);
    return 1;
  } finally {
    await db.close();
    rmSync(workDir, { recursive: true, force: true });
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
