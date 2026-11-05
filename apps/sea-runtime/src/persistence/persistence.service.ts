import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { DbConfig, InjectConfig, type AppPaths, type DbAdapter } from 'shared-core';
import { SupervisorLogger } from '../sidecar/supervisor-logger.js';
import { ASSET_SOURCE, type AssetSource } from './asset-source.js';
import { bootPersistence$, type PersistenceBoot } from './boot.js';
import { APP_PATHS, DATABASE_ADAPTER } from './tokens.js';

// Opens and checks the database while Nest builds the modules. Invalid config or an incompatible database stops the start, before any service is spawned (REQ-DB-06).
@Injectable()
export class PersistenceService implements OnModuleInit {
  private booted?: PersistenceBoot;

  constructor(
    @Inject(ASSET_SOURCE) private readonly source: AssetSource,
    @Inject(APP_PATHS) private readonly paths: AppPaths,
    @InjectConfig(DbConfig) private readonly dbConfig: DbConfig,
    @Inject(DATABASE_ADAPTER) private readonly db: DbAdapter,
    private readonly logger: SupervisorLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    const { paths, dbConfig, db } = this;
    this.booted = await lastValueFrom(bootPersistence$((text) => this.logger.log(text), this.source, { paths, dbConfig, db }));
  }

  get boot(): PersistenceBoot {
    if (this.booted === undefined) throw new Error('persistence has not booted yet');
    return this.booted;
  }

  async close(): Promise<void> {
    await this.booted?.db.close();
  }
}
