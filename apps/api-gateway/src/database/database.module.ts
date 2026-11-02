import { Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import { catchError, concatMap, defer, firstValueFrom, from, map, type Observable, throwError } from 'rxjs';
import { createDbAdapter, derivePaths, initConfig, resolveRoot, type DbAdapter } from 'shared-core';

export const DB_ADAPTER = Symbol('DB_ADAPTER');

// The question every engine can answer: proves the connection works, not that the schema is right (the supervisor checked that before spawning this service).
function handshake$(db: DbAdapter): Observable<void> {
  return defer(() => from(db.all('SELECT 1 AS ok'))).pipe(
    map((rows) => {
      if (Number(rows[0]?.['ok']) !== 1) throw new Error('SELECT 1 did not answer 1');
    }),
  );
}

// A failed handshake closes what was opened and ends the stream with an error that names the engine.
function open$(): Observable<DbAdapter> {
  return defer(() => {
    // The supervisor passes its root through APP_HOME, so both processes use the same database.
    const resolved = resolveRoot({ argv: process.argv.slice(2), env: process.env, execPath: process.execPath, platform: process.platform });
    const paths = derivePaths(resolved, process.execPath);
    const db = createDbAdapter(initConfig(paths), paths);
    return from(db.connect()).pipe(
      concatMap(() => handshake$(db)),
      map(() => db),
      catchError((error: unknown) =>
        from(db.close()).pipe(
          concatMap(() => throwError(() => new Error(`database handshake failed (${db.engine}): ${error instanceof Error ? error.message : String(error)}`))),
        ),
      ),
    );
  });
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
  providers: [{ provide: DB_ADAPTER, useFactory: () => firstValueFrom(open$()) }, DatabaseLifecycle],
  exports: [DB_ADAPTER],
})
export class DatabaseModule {}
