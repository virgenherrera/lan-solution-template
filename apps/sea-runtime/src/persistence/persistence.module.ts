import { Module } from '@nestjs/common';
import { isSea } from 'node:sea';
import { join } from 'node:path';
import {
  createDbAdapter,
  derivePaths,
  initConfig,
  resolveBase,
  type AdapterDeps,
  type AppConfig,
  type AppPaths,
  type DbAdapter,
} from 'shared-core';
import { SidecarModule } from '../sidecar/sidecar.module.js';
import { ASSET_SOURCE, seaAssetSource, type AssetSource } from './asset-source.js';
import { fsAssetSource } from './dev-assets.js';
import { PersistenceService } from './persistence.service.js';
import { APP_CONFIG, APP_PATHS, DATABASE_ADAPTER } from './tokens.js';

// Options only for the engine the config selects; the engine module is imported when it is chosen, not when this file loads.
async function engineDeps(config: AppConfig, paths: AppPaths, source: AssetSource): Promise<AdapterDeps> {
  if (config.db.engine !== 'sqlite') return {};
  const { SqliteVector } = await import('shared-core/sqlite');
  return { sqlite: { vector: new SqliteVector({ getAsset: (name) => source.readRaw(name), directory: join(paths.dataDir, 'native') }) } };
}

@Module({
  imports: [SidecarModule],
  providers: [
    // The SEA executable embeds the assets; a dev launch reads the files the package step produced.
    { provide: ASSET_SOURCE, useFactory: () => (isSea() ? seaAssetSource : fsAssetSource()) },
    {
      provide: APP_PATHS,
      useFactory: (): AppPaths => derivePaths(resolveBase({ sea: isSea(), execPath: process.execPath, cwd: process.cwd() })),
    },
    // A missing or invalid config throws here, so the start fails before any service is spawned.
    { provide: APP_CONFIG, inject: [APP_PATHS], useFactory: (paths: AppPaths): AppConfig => initConfig(paths) },
    {
      provide: DATABASE_ADAPTER,
      inject: [APP_CONFIG, APP_PATHS, ASSET_SOURCE],
      useFactory: async (config: AppConfig, paths: AppPaths, source: AssetSource): Promise<DbAdapter> =>
        createDbAdapter(config, paths, await engineDeps(config, paths, source)),
    },
    PersistenceService,
  ],
  exports: [PersistenceService, APP_PATHS, APP_CONFIG, DATABASE_ADAPTER],
})
export class PersistenceModule {}
