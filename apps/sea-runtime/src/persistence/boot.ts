import { join, resolve } from 'node:path';
import { catchError, concatMap, defer, from, map, type MonoTypeOperatorFunction, type Observable, tap, throwError, toArray } from 'rxjs';
import {
  createDbAdapter,
  derivePaths,
  initConfig,
  migrate$,
  resolveRoot,
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

// The engine module is imported only here, so it is evaluated when the adapter is built and not when this file loads.
async function createAdapter(config: AppConfig, paths: AppPaths, source: AssetSource): Promise<DbAdapter> {
  const { SqliteVector } = await import('shared-core/sqlite');
  return createDbAdapter(config, paths, {
    sqlite: { vector: new SqliteVector({ getAsset: (name) => source.readRaw(name), directory: join(paths.dataDir, 'native') }) },
  });
}

function openDatabase$(log: Log, source: AssetSource, devAnchor?: string): Observable<PersistenceBoot> {
  return defer(() => {
    const resolved = resolveRoot({ argv: process.argv.slice(2), env: process.env, execPath: process.execPath, platform: process.platform, devAnchor });
    const paths = derivePaths(resolved, process.execPath);
    log(`root ${paths.root} (${resolved.source})`);
    const config = initConfig(paths);
    const location = resolve(paths.dataDir, config.db.sqlite.file);
    return from(createAdapter(config, paths, source)).pipe(
      concatMap((db) =>
        from(db.connect()).pipe(
          // "file is not a database" alone does not say which file; the operator needs the path.
          catchError((error: unknown) => throwError(() => new Error(`cannot open the database at ${location}: ${error instanceof Error ? error.message : String(error)}`))),
          map((): PersistenceBoot => ({ db, root: paths.root, config, location })),
          closeOnError(db),
        ),
      ),
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
    const info = readBuildInfo(source, boot.config.db.engine);
    return from(db.verifyVector()).pipe(
      concatMap(() => migrate$(db, readEmbeddedMigrations(source, boot.config.db.engine), { runtimeVersion: info.runtime_version })),
      tap((event) => logMigration(log, event)),
      toArray(),
      concatMap(() => verifySchema$(db, location, log)),
      concatMap(() => writeAppMeta$(db, info)),
      tap(() => log(`database ${db.engine} ready, vector ok`)),
      map(() => boot),
    );
  }).pipe(closeOnError(db));
}

// Startup order (REQ-DB-06): root, config, adapter, connection, vector check, migrations, schema check, app_meta, ready.
// Any failure ends the stream with an error before a service is spawned. Nothing runs until someone subscribes.
// `devAnchor` is set only by a dev launch, as the last root candidate (see resolveRoot).
export function bootPersistence$(log: Log, source: AssetSource, devAnchor?: string): Observable<PersistenceBoot> {
  return openDatabase$(log, source, devAnchor).pipe(concatMap((boot) => prepare$(boot, log, source)));
}
