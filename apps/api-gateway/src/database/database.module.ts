import { Injectable, Module, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { catchError, concatMap, defer, firstValueFrom, from, map, type Observable, throwError } from 'rxjs';
import { AppPathsService, createDbAdapter, DbConfig, InjectConfig, type DbAdapter } from 'shared-core';

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

// One connection per service, opened once while the application initializes (`app.init()`, which main awaits before it listens). If the handshake fails, the application does not start.
@Injectable()
export class DatabaseService implements OnModuleInit, OnApplicationShutdown {
  private db: DbAdapter | undefined;

  constructor(
    @InjectConfig(DbConfig) private readonly config: DbConfig,
    private readonly appPaths: AppPathsService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.db = await firstValueFrom(open$(await createDbAdapter(this.config, this.appPaths.paths)));
  }

  async onApplicationShutdown(): Promise<void> {
    await this.db?.close();
  }

  get adapter(): DbAdapter {
    if (this.db === undefined) throw new Error('the database is not open yet');
    return this.db;
  }
}

@Module({
  providers: [AppPathsService, DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
