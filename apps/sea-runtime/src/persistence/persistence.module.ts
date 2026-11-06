import { Module } from '@nestjs/common';
import { isSea } from 'node:sea';
import { join } from 'node:path';
import { AppConfigModule, AppPathsService, CONFIG_FILE, DbConfig, configFileSource } from 'shared-core';
import { SidecarModule } from '../sidecar/sidecar.module.js';
import { AssetSource, SeaAssetSource } from './asset-source.js';
import { FsAssetSource } from './dev-assets.js';
import { PersistenceService } from './persistence.service.js';

// Resolved while the module graph is declared: AppConfigModule needs the config location before Nest builds any provider.
const { paths } = new AppPathsService();

@Module({
  imports: [
    // A missing or invalid config throws while Nest builds the modules, so the start fails before any service is spawned.
    AppConfigModule.forRoot({
      // A new config namespace is registered by adding its class here (and exporting it from shared-core).
      configClasses: [DbConfig],
      source: configFileSource(paths),
      origin: join(paths.configDir, CONFIG_FILE),
    }),
    SidecarModule,
  ],
  providers: [
    // The SEA executable embeds the assets; a dev launch reads the files the package step produced.
    { provide: AssetSource, useClass: isSea() ? SeaAssetSource : FsAssetSource },
    AppPathsService,
    PersistenceService,
  ],
  exports: [PersistenceService],
})
export class PersistenceModule {}
