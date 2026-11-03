import { resolve } from 'node:path';
import { catchError, concatMap, defer, from, map, type MonoTypeOperatorFunction, type Observable, tap, throwError, toArray } from 'rxjs';
import {
  migrate$,
  type AppConfig,
  type AppPaths,
  type DbAdapter,
  type MigrationEvent,
} from 'shared-core';
import { writeAppMeta$ } from './app-meta.js';
import type { AssetSource } from './asset-source.js';
import { readBuildInfo } from './build-info.js';
import { readEmbeddedMigrations } from './migrations-source.js';
import { verifySchema$ } from './schema-check.js';

export interface PersistenceBoot {
  readonly db: DbAdapter;
  readonly root: string;
  readonly config: AppConfig;
  // Where the database lives, for operator messages.
  readonly location: string;
}

type Log = (text: string) => void;

// A half-started database is closed before the error reaches the supervisor (REQ-DB-06).
function closeOnError<T>(db: DbAdapter): MonoTypeOperatorFunction<T> {
  return catchError((error: unknown) => from(db.close()).pipe(concatMap(() => throwError(() => error))));
}

// What the providers already built: paths, validated config and the adapter chosen by `db.engine`.
export interface PersistenceDeps {
  readonly paths: AppPaths;
  readonly config: AppConfig;
  readonly db: DbAdapter;
}

function openDatabase$(log: Log, { paths, config, db }: PersistenceDeps): Observable<PersistenceBoot> {
  return defer(() => {
    log(`root ${paths.root} (${paths.source})`);
    const location = resolve(paths.dataDir, config.db.sqlite.file);
    return from(db.connect()).pipe(
      // "file is not a database" alone does not say which file; the operator needs the path.
      catchError((error: unknown) => throwError(() => new Error(`cannot open the database at ${location}: ${error instanceof Error ? error.message : String(error)}`))),
      map((): PersistenceBoot => ({ db, root: paths.root, config, location })),
      closeOnError(db),
    );
  });
}

// Skipped and applied steps are worth a line; "checked" is noise.
function logMigration(log: Log, event: MigrationEvent): void {
  if (event.type === 'applied') log(`migration ${event.version} ${event.name} applied in ${event.durationMs} ms`);
  if (event.type === 'skipped') log(`migration ${event.version} ${event.name} already applied`);
}

function prepare$(boot: PersistenceBoot, log: Log, source: AssetSource): Observable<PersistenceBoot> {
  const { db, location } = boot;
  return defer(() => {
    const info = readBuildInfo(source);
    return from(db.verifyVector()).pipe(
      concatMap(() => migrate$(db, readEmbeddedMigrations(source), { runtimeVersion: info.runtime_version })),
      tap((event) => logMigration(log, event)),
      toArray(),
      concatMap(() => verifySchema$(db, location, log)),
      concatMap(() => writeAppMeta$(db, info)),
      tap(() => log(`database ${db.engine} ready, vector ok`)),
      map(() => boot),
    );
  }).pipe(closeOnError(db));
}

// Startup order (REQ-DB-06): root, config, adapter (built by the providers), connection, vector check, migrations, schema check, app_meta, ready.
// Any failure ends the stream with an error before a service is spawned. Nothing runs until someone subscribes.
export function bootPersistence$(log: Log, source: AssetSource, deps: PersistenceDeps): Observable<PersistenceBoot> {
  return openDatabase$(log, deps).pipe(concatMap((boot) => prepare$(boot, log, source)));
}
