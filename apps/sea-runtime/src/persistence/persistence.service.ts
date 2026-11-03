import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { isSea } from 'node:sea';
import { lastValueFrom } from 'rxjs';
import { SupervisorLogger } from '../sidecar/supervisor-logger.js';
import { ASSET_SOURCE, type AssetSource } from './asset-source.js';
import { bootPersistence$, type PersistenceBoot } from './boot.js';
import { devAnchor } from './dev-assets.js';

// Opens and checks the database while Nest builds the modules. Invalid config or an incompatible database stops the start, before any service is spawned (REQ-DB-06).
@Injectable()
export class PersistenceService implements OnModuleInit {
  private booted?: PersistenceBoot;

  constructor(
    @Inject(ASSET_SOURCE) private readonly source: AssetSource,
    private readonly logger: SupervisorLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    // A dev launch (`nest start`) adds the repo root as the last root candidate.
    const anchor = isSea() ? undefined : devAnchor();
    this.booted = await lastValueFrom(bootPersistence$((text) => this.logger.log(text), this.source, anchor));
  }

  get boot(): PersistenceBoot {
    if (this.booted === undefined) throw new Error('persistence has not booted yet');
    return this.booted;
  }

  async close(): Promise<void> {
    await this.booted?.db.close();
  }
}
