import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { join, resolve } from 'node:path';
import { catchError, concatMap, defer, from, lastValueFrom, map, type Observable, tap, throwError, toArray } from 'rxjs';
import { AppPathsService, DbConfig, InjectConfig, createDbAdapter, migrate$, type AdapterDeps, type DbAdapter, type MigrationEvent } from 'shared-core';
import { SUPERVISOR_CONFIG } from 'service-registry';
import { writeAppMeta$ } from '../persistence/app-meta.js';
import { AssetSource } from '../persistence/asset-source.js';
import { readBuildInfo } from '../persistence/build-info.js';
import { readEmbeddedMigrations } from '../persistence/migrations-source.js';
import { verifySchema$ } from '../persistence/schema-check.js';

// Opens and checks the database while Nest builds the modules. Invalid config or an incompatible database stops the start, before any service is spawned (REQ-DB-06).
@Injectable()
export class PersistenceService implements OnModuleInit {
  private readonly logger = new Logger(SUPERVISOR_CONFIG.id);
  private db?: DbAdapter;

  constructor(
    private readonly source: AssetSource,
    private readonly appPaths: AppPathsService,
    @InjectConfig(DbConfig) private readonly dbConfig: DbConfig,
  ) {}

  // Startup order (REQ-DB-06): root, config, adapter, connection, vector check, migrations, schema check, app_meta, ready.
  // Any failure rejects before a service is spawned.
  async onModuleInit(): Promise<void> {
    await lastValueFrom(this.boot$());
  }

  async close(): Promise<void> {
    await this.db?.close();
  }

  private boot$(): Observable<void> {
    return defer(() => from(this.createAdapter())).pipe(
      concatMap((db) => this.open$(db)),
      concatMap((db) => this.prepare$(db)),
    );
  }

  // Options only for the engine the config selects; the engine module is imported when it is chosen, not when this file loads.
  private async engineDeps(): Promise<AdapterDeps> {
    if (this.dbConfig.engine !== 'sqlite') return {};
    const { SqliteVector } = await import('shared-core/sqlite');
    return { sqlite: { vector: new SqliteVector({ getAsset: (name) => this.source.readRaw(name), directory: join(this.appPaths.paths.dataDir, 'native') }) } };
  }

  private async createAdapter(): Promise<DbAdapter> {
    return createDbAdapter(this.dbConfig, this.appPaths.paths, await this.engineDeps());
  }

  // Where the operator looks for the database: the file for SQLite, the server and database name for PostgreSQL.
  private get location(): string {
    const db = this.dbConfig;
    return db.engine === 'sqlite' ? resolve(this.appPaths.paths.dataDir, db.sqlite.file) : `${db.pg.host}:${db.pg.port}/${db.pg.database}`;
  }

  private open$(db: DbAdapter): Observable<DbAdapter> {
    this.logger.log(`root ${this.appPaths.paths.root}`);
    return from(db.connect()).pipe(
      // "file is not a database" alone does not say which file; the operator needs the path.
      catchError((error: unknown) => throwError(() => new Error(`cannot open the database at ${this.location}: ${error instanceof Error ? error.message : String(error)}`))),
      map(() => db),
      this.closeOnError(db),
    );
  }

  private prepare$(db: DbAdapter): Observable<void> {
    return defer(() => {
      const info = readBuildInfo(this.source, this.dbConfig.engine);
      return from(db.verifyVector()).pipe(
        concatMap(() => migrate$(db, readEmbeddedMigrations(this.source, this.dbConfig.engine), { runtimeVersion: info.runtime_version })),
        tap((event) => this.logMigration(event)),
        toArray(),
        concatMap(() => verifySchema$(db, this.location, (text) => this.logger.log(text))),
        concatMap(() => writeAppMeta$(db, info)),
        tap(() => {
          this.db = db;
          this.logger.log(`database ${db.engine} ready, vector ok`);
        }),
      );
    }).pipe(this.closeOnError(db));
  }

  // Skipped and applied steps are worth a line; "checked" is noise.
  private logMigration(event: MigrationEvent): void {
    if (event.type === 'applied') this.logger.log(`migration ${event.version} ${event.name} applied in ${event.durationMs} ms`);
    if (event.type === 'skipped') this.logger.log(`migration ${event.version} ${event.name} already applied`);
  }

  // A half-started database is closed before the error reaches the supervisor (REQ-DB-06).
  private closeOnError<T>(db: DbAdapter) {
    return catchError<T, Observable<never>>((error: unknown) => from(db.close()).pipe(concatMap(() => throwError(() => error))));
  }
}
