import { compareSchema, tablesByEngine, tablesSchema, type Engine, type SchemaReport } from 'db-migrations';
import { defer, from, map, type Observable, tap } from 'rxjs';
import type { DbAdapter } from 'shared-core';

type Log = (text: string) => void;

// The operator reads this text (S8): every problem on its own line, then what it means and what to do.
export class SchemaMismatchError extends Error {
  constructor(engine: string, location: string, problems: readonly string[]) {
    super(
      [
        `schema check FAILED (engine ${engine}, ${problems.length} problem(s)):`,
        ...problems.map((problem) => `  ${problem}`),
        `The database at ${location} does not have the structure this build expects. No service was started. Restore a backup taken with this build, or start the build that last migrated this database.`,
      ].join('\n'),
    );
    this.name = 'SchemaMismatchError';
  }
}

function logOk(log: Log, tolerated: readonly string[]): void {
  if (tolerated.length === 0) return log('schema ok');
  log(`schema ok, ${tolerated.length} extra(s) tolerated`);
  tolerated.forEach((line) => log(`  ${line}`));
}

// Throwing here ends the boot stream, so no service is spawned (REQ-DB-06).
function assertMatches(db: DbAdapter, location: string, report: SchemaReport): SchemaReport {
  if (report.problems.length > 0) throw new SchemaMismatchError(db.engine, location, report.problems);
  return report;
}

function failUnknownEngine(engine: string): never {
  throw new Error(`no table descriptors for db engine "${engine}"`);
}

// Runs once per start, after the migrations: the live structure must contain what this build needs (S4, S6).
// Extras that cannot hurt this build are tolerated and only logged.
export function verifySchema$(db: DbAdapter, location: string, log: Log): Observable<SchemaReport> {
  return defer(() => {
    const expected = tablesSchema.parse(tablesByEngine[db.engine as Engine] ?? failUnknownEngine(db.engine));
    return from(db.introspectSchema()).pipe(map((live) => assertMatches(db, location, compareSchema(expected, live, 'required'))));
  }).pipe(
    // A failure is printed once, in full, by main.ts when the boot stream rejects.
    tap((report) => logOk(log, report.tolerated)),
  );
}
