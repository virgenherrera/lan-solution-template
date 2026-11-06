// Parity check (S6). Run from the repository root: `node tools/scripts/db-parity.ts [--engine sqlite|pg] [--migrations-dir <dir>]`.
// Engine pg also takes [--pg-host localhost] [--pg-port 5432] [--pg-user postgres] [--pg-database postgres] and PGPASSWORD (default empty).
// It creates a throwaway database on that server, migrates it, compares it and drops it.
// Applies the real migrations with the real migrator to a temp database, reads the resulting structure back and
// compares it with the declarative descriptor in libs/db-migrations/contract/tables.ts. Exit 0 = parity, 1 = diff.
// Needs the built libraries: `pnpm --filter shared-core run build` and `pnpm --filter db-migrations run build`.
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { z } from 'zod';

const root = resolve(import.meta.dirname, '..', '..');
const { jsonText } = (await import(join(root, 'libs', 'service-registry', 'dist', 'json-text.js'))) as typeof import('../../libs/service-registry/dist/json-text.js');
const sharedCorePath = join(root, 'libs', 'shared-core', 'dist', 'index.js');
const contractPath = join(root, 'libs', 'db-migrations', 'dist', 'contract', 'index.js');
const defaultMigrationsDir = (engine: string): string => join(root, 'libs', 'db-migrations', engine, 'migrations');

// Strategy registry: one entry per engine with the built module that holds its adapter and how to open it on a throwaway
// directory. A new engine adds one entry here and the check itself does not change.
type ParityAdapter = import('../../libs/shared-core/dist/db/port.js').DbAdapter;
interface EngineEntry {
  readonly modulePath: string;
  open(workDir: string): Promise<ParityAdapter>;
  // Runs after close(), for state the adapter does not own (a database created on a server).
  cleanup?(workDir: string): Promise<void>;
}
const sqliteModulePath = join(root, 'libs', 'shared-core', 'dist', 'db', 'sqlite', 'index.js');
const pgModulePath = join(root, 'libs', 'shared-core', 'dist', 'db', 'pg', 'index.js');
const PG_PASSWORD_FILE = 'pg.pass';
const ENGINES: Readonly<Record<string, EngineEntry>> = {
  sqlite: {
    modulePath: sqliteModulePath,
    open: async (workDir) => {
      const { SqliteAdapter } = (await import(sqliteModulePath)) as typeof import('../../libs/shared-core/dist/db/sqlite/index.js');
      return new SqliteAdapter({ file: 'parity.db', foreignKeys: true, journalMode: 'DELETE', synchronous: 'NORMAL' }, workDir);
    },
  },
  pg: pgEntry(),
};

// The server comes from the --pg-* options; the password from PGPASSWORD goes to a file in the work dir, as the adapter expects (decision 11).
// Each run migrates a database of its own, so the server's other databases are never touched.
function pgEntry(): EngineEntry {
  const database = `parity_${randomBytes(6).toString('hex')}`;
  const connect = async (workDir: string, name: string): Promise<ParityAdapter> => {
    const { PgAdapter } = (await import(pgModulePath)) as typeof import('../../libs/shared-core/dist/db/pg/index.js');
    writeFileSync(join(workDir, PG_PASSWORD_FILE), process.env.PGPASSWORD ?? '');
    const settings = {
      host: option('pg-host', 'localhost'),
      port: Number(option('pg-port', '5432')),
      database: name,
      user: option('pg-user', 'postgres'),
      passwordFile: PG_PASSWORD_FILE,
    };
    const db = new PgAdapter(settings, workDir);
    await db.connect();
    return db;
  };
  const adminDo = async (workDir: string, statement: string): Promise<void> => {
    const admin = await connect(workDir, option('pg-database', 'postgres'));
    try {
      await admin.run(statement);
    } finally {
      await admin.close();
    }
  };
  return {
    modulePath: pgModulePath,
    open: async (workDir) => {
      await adminDo(workDir, `CREATE DATABASE ${database}`);
      return connect(workDir, database);
    },
    cleanup: (workDir) => adminDo(workDir, `DROP DATABASE IF EXISTS ${database} WITH (FORCE)`),
  };
}

function fail(message: string): never {
  throw new Error(message);
}

// Drizzle owns the journal file, so only the fields read here are checked.
const journalSchema = z.looseObject({ entries: z.array(z.looseObject({ idx: z.number(), tag: z.string() })) });

// Same order and numbering as the migrator input: journal idx + 1 is the version.
function readMigrations(dir: string): { version: number; name: string; sql: string }[] {
  const journalPath = join(dir, 'meta', '_journal.json');
  const parsed = jsonText(journalSchema).safeParse(readFileSync(journalPath, 'utf8'));
  if (!parsed.success) fail(`${journalPath}: ${z.prettifyError(parsed.error)}`);
  const journal = parsed.data;
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
  const entry = ENGINES[engine] ?? fail(`no introspector for engine "${engine}" (known: ${Object.keys(ENGINES).join(', ')})`);
  for (const path of [sharedCorePath, entry.modulePath, contractPath]) {
    if (!existsSync(path)) fail(`${path} missing; build shared-core and db-migrations first`);
  }
  const { runMigrations } = (await import(sharedCorePath)) as typeof import('../../libs/shared-core/dist/index.js');
  const { tablesByEngine, tablesSchema, compareSchema } = (await import(contractPath)) as typeof import('../../libs/db-migrations/dist/contract/index.js');
  const migrations = readMigrations(resolve(option('migrations-dir', defaultMigrationsDir(engine))));

  const workDir = mkdtempSync(join(tmpdir(), 'db-parity-'));
  const db = await entry.open(workDir);
  try {
    await db.connect();
    await runMigrations(db, migrations);
    const key = engine as keyof typeof tablesByEngine;
    const tables = tablesByEngine[key];
    // Validate the descriptor itself first, then compare it exactly with what the real migrations built.
    const diff = compareSchema(tablesSchema.parse(tables), await db.introspectSchema(), 'exact', key).problems;
    if (diff.length === 0) {
      console.log(`parity ok: ${tables.length} table(s) match the descriptor (engine ${engine})`);
      return 0;
    }
    console.error(`parity FAILED (engine ${engine}):\n${diff.map((line) => `  ${line}`).join('\n')}`);
    return 1;
  } finally {
    await db.close();
    await entry.cleanup?.(workDir);
    rmSync(workDir, { recursive: true, force: true });
  }
}

// A refused connection reaches us as an AggregateError with an empty message (one inner error per address tried), so the inner messages carry the cause.
function describeError(error: unknown): string {
  if (error instanceof AggregateError) {
    const inner = error.errors.map((item) => describeError(item)).join('\n');
    return error.message === '' ? inner : `${error.message}\n${inner}`;
  }
  if (!(error instanceof Error)) return String(error);
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && !error.message.includes(code) ? `${code}: ${error.message}` : error.message;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(describeError(error));
    process.exit(1);
  },
);
