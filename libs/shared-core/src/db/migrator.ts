import { createHash } from 'node:crypto';
import type { DbAdapter } from './port.js';

// In-house migrator (REQ-DB-04, REQ-DB-05). It only knows the DbAdapter port, so any engine reuses it.
export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
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

export function checksumOf(sql: string): string {
  return createHash('sha256').update(sql).digest('hex');
}

// Rejects bad input before any database access.
function validate(migrations: readonly Migration[]): void {
  let previous = 0;
  for (const migration of migrations) {
    if (!Number.isInteger(migration.version) || migration.version < 1) {
      throw new MigrationInputError(`version ${migration.version} must be a positive integer`);
    }
    if (migration.version === previous) throw new MigrationInputError(`duplicate version ${migration.version}`);
    if (migration.version < previous) {
      throw new MigrationInputError(`version ${migration.version} comes after ${previous}; list must be ascending`);
    }
    previous = migration.version;
  }
}

// The port runs one statement per call, so a migration script is split on semicolons.
// Limit: a semicolon inside a string literal or a trigger body is not supported.
function statementsOf(sql: string): string[] {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

// Engine-neutral check for "another connection holds the write lock" (SQLite: database is locked / busy).
function isLockContention(error: unknown): boolean {
  return error instanceof Error && /locked|busy/i.test(error.message);
}

async function withLockRetry<T>(action: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      if (!isLockContention(error) || attempt >= LOCK_RETRY_LIMIT) throw error;
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_DELAY_MS));
    }
  }
}

async function readHistory(db: DbAdapter): Promise<Map<number, string>> {
  const rows = await db.all(`SELECT version, checksum FROM ${HISTORY_TABLE}`);
  return new Map(rows.map((row) => [Number(row.version), String(row.checksum)]));
}

function assertUntampered(history: ReadonlyMap<number, string>, migrations: readonly Migration[]): void {
  for (const migration of migrations) {
    const stored = history.get(migration.version);
    if (stored !== undefined && stored !== checksumOf(migration.sql)) {
      throw new MigrationTamperedError(migration.version, migration.name);
    }
  }
}

// Applies pending migrations in order, one transaction each (REQ-DB-05).
// Locking: db.transaction() takes the engine write lock (SQLite: BEGIN IMMEDIATE). History is re-read
// inside that lock, so two concurrent runners never apply the same version twice.
export async function runMigrations(db: DbAdapter, migrations: readonly Migration[]): Promise<MigrationResult> {
  validate(migrations);

  await withLockRetry(() =>
    db.run(
      `CREATE TABLE IF NOT EXISTS ${HISTORY_TABLE} (version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)`,
    ),
  );

  // Fail before applying anything when an already applied migration was edited.
  assertUntampered(await readHistory(db), migrations);

  const applied: number[] = [];
  for (const migration of migrations) {
    const didApply = await withLockRetry(() =>
      db.transaction(async () => {
        const history = await readHistory(db);
        assertUntampered(history, [migration]);
        if (history.has(migration.version)) return false;
        for (const statement of statementsOf(migration.sql)) await db.run(statement);
        // Recorded in the same transaction: a migration counts as applied only once it commits.
        await db.run(`INSERT INTO ${HISTORY_TABLE} (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)`, [
          migration.version,
          migration.name,
          checksumOf(migration.sql),
          new Date().toISOString(),
        ]);
        return true;
      }),
    );
    if (didApply) applied.push(migration.version);
  }
  return { applied };
}
