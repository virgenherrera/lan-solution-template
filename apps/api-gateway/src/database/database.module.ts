import { Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import { catchError, concatMap, defer, firstValueFrom, from, map, type Observable, throwError } from 'rxjs';
import { createDbAdapter, DbConfig, InjectConfig, NetConfig, TlsConfig, type AppPaths, type DbAdapter } from 'shared-core';
import { APP_PATHS, appPathsProvider } from '../app-paths.js';
import { DB_ADAPTER } from './tokens.js';

export { DB_ADAPTER };

// The question every engine can answer: proves the connection works, not that the schema is right (the supervisor checked that before spawning this service).
function handshake$(db: DbAdapter): Observable<void> {
  return defer(() => from(db.all('SELECT 1 AS ok'))).pipe(
    map((rows) => {
      if (Number(rows[0]?.['ok']) !== 1) throw new Error('SELECT 1 did not answer 1');
    }),
  );
}

// A failed handshake closes what was opened and ends the stream with an error that names the engine.
function open$(db: DbAdapter): Observable<DbAdapter> {
  return defer(() => from(db.connect())).pipe(
    concatMap(() => handshake$(db)),
    map(() => db),
    catchError((error: unknown) =>
      from(db.close()).pipe(
        concatMap(() => throwError(() => new Error(`database handshake failed (${db.engine}): ${error instanceof Error ? error.message : String(error)}`))),
      ),
    ),
  );
}

@Injectable()
class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DB_ADAPTER) private readonly db: DbAdapter) {}

  async onApplicationShutdown(): Promise<void> {
    await this.db.close();
  }
}

// Reassembles the persisted config from its namespaces: the adapter factory takes the whole of it, though only `db` is read.
@Injectable()
class DatabaseOpener {
  constructor(
    @InjectConfig(DbConfig) private readonly db: DbConfig,
    @InjectConfig(NetConfig) private readonly net: NetConfig,
    @InjectConfig(TlsConfig) private readonly tls: TlsConfig,
    @Inject(APP_PATHS) private readonly paths: AppPaths,
  ) {}

  async open(): Promise<DbAdapter> {
    return firstValueFrom(open$(await createDbAdapter({ db: this.db, net: this.net, tls: this.tls }, this.paths)));
  }
}

// One connection per service, opened once while Nest builds the module. If the handshake fails, the application does not start.
@Module({
  providers: [
    appPathsProvider,
    DatabaseOpener,
    { provide: DB_ADAPTER, inject: [DatabaseOpener], useFactory: (opener: DatabaseOpener): Promise<DbAdapter> => opener.open() },
    DatabaseLifecycle,
  ],
  exports: [DB_ADAPTER],
})
export class DatabaseModule {}
