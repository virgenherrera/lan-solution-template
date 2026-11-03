import { Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import { isSea } from 'node:sea';
import { catchError, concatMap, defer, firstValueFrom, from, map, type Observable, throwError } from 'rxjs';
import { createDbAdapter, derivePaths, initConfig, resolveBase, type AppConfig, type AppPaths, type DbAdapter } from 'shared-core';
import { APP_CONFIG, APP_PATHS, DB_ADAPTER } from './tokens.js';

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

// One connection per service, opened once while Nest builds the module. If the handshake fails, the application does not start.
@Module({
  providers: [
    // A child is the same executable as the supervisor, so both resolve the same base and open the same database.
    {
      provide: APP_PATHS,
      useFactory: (): AppPaths =>
        derivePaths(resolveBase({ sea: isSea(), execPath: process.execPath, cwd: process.cwd() })),
    },
    // A missing or invalid config throws here and the application does not start.
    { provide: APP_CONFIG, inject: [APP_PATHS], useFactory: (paths: AppPaths): AppConfig => initConfig(paths) },
    {
      provide: DB_ADAPTER,
      inject: [APP_CONFIG, APP_PATHS],
      useFactory: async (config: AppConfig, paths: AppPaths): Promise<DbAdapter> => firstValueFrom(open$(await createDbAdapter(config, paths))),
    },
    DatabaseLifecycle,
  ],
  exports: [APP_PATHS, APP_CONFIG, DB_ADAPTER],
})
export class DatabaseModule {}
