import { getRawAsset } from 'node:sea';
import { join } from 'node:path';
import { catchError, concatMap, defer, from, map, type MonoTypeOperatorFunction, type Observable, tap, throwError, toArray } from 'rxjs';
import {
  SqliteVector,
  createDbAdapter,
  derivePaths,
  initConfig,
  migrate$,
  resolveRoot,
  type DbAdapter,
  type MigrationEvent,
} from 'shared-core';
import { writeAppMeta$ } from './app-meta.js';
import { readBuildInfo } from './build-info.js';
import { readEmbeddedMigrations } from './migrations-source.js';

export interface PersistenceBoot {
  readonly db: DbAdapter;
  readonly root: string;
}

type Log = (text: string) => void;

// A half-started database is closed before the error reaches the supervisor (REQ-DB-06).
function closeOnError<T>(db: DbAdapter): MonoTypeOperatorFunction<T> {
  return catchError((error: unknown) => from(db.close()).pipe(concatMap(() => throwError(() => error))));
}

function openDatabase$(log: Log): Observable<PersistenceBoot> {
  return defer(() => {
    const resolved = resolveRoot({ argv: process.argv.slice(2), env: process.env, execPath: process.execPath, platform: process.platform });
    const paths = derivePaths(resolved, process.execPath);
    log(`root ${paths.root} (${resolved.source})`);
    const db = createDbAdapter(initConfig(paths), paths, {
      sqliteVector: new SqliteVector({ getAsset: (name) => getRawAsset(name), directory: join(paths.dataDir, 'native') }),
    });
    return from(db.connect()).pipe(
      map((): PersistenceBoot => ({ db, root: paths.root })),
      closeOnError(db),
    );
  });
}

// Skipped and applied steps are worth a line; "checked" is noise.
function logMigration(log: Log, event: MigrationEvent): void {
  if (event.type === 'applied') log(`migration ${event.version} ${event.name} applied in ${event.durationMs} ms`);
  if (event.type === 'skipped') log(`migration ${event.version} ${event.name} already applied`);
}

function prepare$(boot: PersistenceBoot, log: Log): Observable<PersistenceBoot> {
  const { db } = boot;
  return defer(() => {
    const info = readBuildInfo();
    return from(db.verifyVector()).pipe(
      concatMap(() => migrate$(db, readEmbeddedMigrations(), { runtimeVersion: info.runtime_version })),
      tap((event) => logMigration(log, event)),
      toArray(),
      concatMap(() => writeAppMeta$(db, info)),
      tap(() => log(`database ${db.engine} ready, vector ok`)),
      map(() => boot),
    );
  }).pipe(closeOnError(db));
}

// Startup order (REQ-DB-06): root, config, adapter, connection, vector check, migrations, app_meta, ready.
// Any failure ends the stream with an error before a service is spawned. Nothing runs until someone subscribes.
export function bootPersistence$(log: Log): Observable<PersistenceBoot> {
  return openDatabase$(log).pipe(concatMap((boot) => prepare$(boot, log)));
}
