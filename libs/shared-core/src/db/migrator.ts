import { createHash } from 'node:crypto';
import { concat, defer, filter, from, lastValueFrom, map, Observable, of, retry, throwError, timer, toArray, concatMap } from 'rxjs';
import type { DbAdapter } from './port.js';
import type { MigrationApplied, MigrationEvent } from './migration-events.js';

// In-house migrator (REQ-DB-04, REQ-DB-05). It only knows the DbAdapter port, so any engine reuses it.
export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
  // Expected checksum from the build manifest. When present it is verified before the database is touched.
  readonly sha256?: string;
}

export interface MigrationOptions {
  // Exact runtime version (`name@exactVersion`) stored on every history row this run writes.
  readonly runtimeVersion?: string;
}

export interface MigrationResult {
  readonly applied: readonly number[];
}

export class MigrationTamperedError extends Error {
  constructor(version: number, name: string) {
    super(`migration ${version} (${name}) changed after it was applied`);
    this.name = 'MigrationTamperedError';
  }
}

export class MigrationInputError extends Error {
  constructor(reason: string) {
    super(`invalid migration list: ${reason}`);
    this.name = 'MigrationInputError';
  }
}

const HISTORY_TABLE = 'schema_migrations';
const LOCK_RETRY_LIMIT = 200;
const LOCK_RETRY_DELAY_MS = 25;
const STATEMENT_BREAKPOINT = /-->\s*statement-breakpoint/;
// A semicolon followed by an even number of quotes is outside a single-quoted literal.
const SEMICOLON_OUTSIDE_LITERAL = /;(?=(?:[^']*'[^']*')*[^']*$)/;

// Columns added after the first release of the history table; old databases get them by ALTER TABLE.
const LATER_COLUMNS = [
  { name: 'runtime_version', definition: "TEXT NOT NULL DEFAULT ''" },
  { name: 'duration_ms', definition: 'INTEGER NOT NULL DEFAULT 0' },
] as const;

export function checksumOf(sql: string): string {
  return createHash('sha256').update(sql).digest('hex');
}

// Rejects bad input before any database access.
function validate(migrations: readonly Migration[]): void {
  migrations.forEach((migration, index) => {
    const previous = migrations[index - 1]?.version ?? 0;
    if (!Number.isInteger(migration.version) || migration.version < 1) {
      throw new MigrationInputError(`version ${migration.version} must be a positive integer`);
    }
    if (migration.version === previous) throw new MigrationInputError(`duplicate version ${migration.version}`);
    if (migration.version < previous) {
      throw new MigrationInputError(`version ${migration.version} comes after ${previous}; list must be ascending`);
    }
    if (migration.sha256 !== undefined && migration.sha256 !== checksumOf(migration.sql)) {
      throw new MigrationTamperedError(migration.version, migration.name);
    }
  });
}

// The port runs one statement per call. A drizzle-kit breakpoint wins; otherwise split on semicolons.
// Limit: a semicolon inside a trigger body is not supported without breakpoints.
function statementsOf(sql: string): string[] {
  const chunks = STATEMENT_BREAKPOINT.test(sql) ? sql.split(STATEMENT_BREAKPOINT) : sql.split(SEMICOLON_OUTSIDE_LITERAL);
  return chunks
    .map((chunk) => chunk.trim().replace(/;+$/, '').trim())
    .filter((statement) => statement.length > 0);
}

// Engine-neutral check for "another connection holds the write lock" (SQLite: database is locked / busy).
function isLockContention(error: unknown): boolean {
  return error instanceof Error && /locked|busy/i.test(error.message);
}

// Runs the action again, with a pause, only while the failure is lock contention.
function withLockRetry<T>(action: () => Promise<T>): Observable<T> {
  return defer(action).pipe(
    retry({
      count: LOCK_RETRY_LIMIT,
      delay: (error) => (isLockContention(error) ? timer(LOCK_RETRY_DELAY_MS) : throwError(() => error)),
    }),
  );
}

async function hasColumn(db: DbAdapter, column: string): Promise<boolean> {
  try {
    await db.all(`SELECT ${column} FROM ${HISTORY_TABLE} LIMIT 1`);
    return true;
  } catch (error) {
    // A lock error says nothing about the column; let the retry handle it.
    if (isLockContention(error)) throw error;
    return false;
  }
}

async function addColumnIfMissing(db: DbAdapter, column: { name: string; definition: string }): Promise<void> {
  if (await hasColumn(db, column.name)) return;
  await db.run(`ALTER TABLE ${HISTORY_TABLE} ADD COLUMN ${column.name} ${column.definition}`);
}

// Creates the history table, or upgrades one made by an older migrator, in one transaction so
// two starting processes cannot both try to add the same column.
function prepareHistoryTable(db: DbAdapter): Observable<void> {
  return withLockRetry(() =>
    db.transaction(async () => {
      await db.run(
        `CREATE TABLE IF NOT EXISTS ${HISTORY_TABLE} (version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL, runtime_version TEXT NOT NULL DEFAULT '', duration_ms INTEGER NOT NULL DEFAULT 0)`,
      );
      const [runtimeVersion, durationMs] = LATER_COLUMNS;
      await addColumnIfMissing(db, runtimeVersion);
      await addColumnIfMissing(db, durationMs);
    }),
  );
}

async function readHistory(db: DbAdapter): Promise<Map<number, string>> {
  const rows = await db.all(`SELECT version, checksum FROM ${HISTORY_TABLE}`);
  return new Map(rows.map((row) => [Number(row.version), String(row.checksum)]));
}

function assertUntampered(history: ReadonlyMap<number, string>, migrations: readonly Migration[]): void {
  const tampered = migrations.find((migration) => {
    const stored = history.get(migration.version);
    return stored !== undefined && stored !== checksumOf(migration.sql);
  });
  if (tampered !== undefined) throw new MigrationTamperedError(tampered.version, tampered.name);
}

// One transaction per migration (REQ-DB-05). db.transaction() takes the engine write lock (SQLite: BEGIN IMMEDIATE),
// and the history is re-read inside that lock, so two concurrent runners never apply the same version twice.
// Resolves to the elapsed milliseconds, or undefined when the version was already applied.
function applyInTransaction(db: DbAdapter, migration: Migration, runtimeVersion: string): Observable<number | undefined> {
  return withLockRetry(() =>
    db.transaction(async () => {
      const history = await readHistory(db);
      assertUntampered(history, [migration]);
      if (history.has(migration.version)) return undefined;

      const startedAt = performance.now();
      await lastValueFrom(from(statementsOf(migration.sql)).pipe(concatMap((statement) => db.run(statement))), { defaultValue: undefined });
      const durationMs = Math.round(performance.now() - startedAt);
      // Recorded in the same transaction: a migration counts as applied only once it commits.
      await db.run(
        `INSERT INTO ${HISTORY_TABLE} (version, name, checksum, applied_at, runtime_version, duration_ms) VALUES (?, ?, ?, ?, ?, ?)`,
        [migration.version, migration.name, checksumOf(migration.sql), new Date().toISOString(), runtimeVersion, durationMs],
      );
      return durationMs;
    }),
  );
}

function processMigration(db: DbAdapter, migration: Migration, runtimeVersion: string): Observable<MigrationEvent> {
  const { version, name } = migration;
  const outcome$ = applyInTransaction(db, migration, runtimeVersion).pipe(
    map((durationMs): MigrationEvent => (durationMs === undefined ? { type: 'skipped', version, name } : { type: 'applied', version, name, durationMs })),
  );
  return concat(of<MigrationEvent>({ type: 'checked', version, name }), outcome$);
}

// Applies pending migrations in order and reports each step as an event (REQ-DB-05).
// Nothing runs until someone subscribes. A failure ends the stream with an error; later migrations do not start.
export function migrate$(db: DbAdapter, migrations: readonly Migration[], options: MigrationOptions = {}): Observable<MigrationEvent> {
  const runtimeVersion = options.runtimeVersion ?? '';
  return defer(() => {
    validate(migrations);
    return prepareHistoryTable(db);
  }).pipe(
    concatMap(() => readHistory(db)),
    // Fail before applying anything when an already applied migration was edited.
    concatMap((history) => {
      assertUntampered(history, migrations);
      return from(migrations);
    }),
    concatMap((migration) => processMigration(db, migration, runtimeVersion)),
  );
}

// Promise wrapper for callers that only want the final list of applied versions.
export function runMigrations(db: DbAdapter, migrations: readonly Migration[], options: MigrationOptions = {}): Promise<MigrationResult> {
  return lastValueFrom(
    migrate$(db, migrations, options).pipe(
      filter((event): event is MigrationApplied => event.type === 'applied'),
      map((event) => event.version),
      toArray(),
      map((applied) => ({ applied })),
    ),
  );
}
