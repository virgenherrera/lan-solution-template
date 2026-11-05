import { Module } from '@nestjs/common';
import { isSea } from 'node:sea';
import { join } from 'node:path';
import {
  AppConfigModule,
  CONFIG_FILE,
  DbConfig,
  InjectConfig,
  NetConfig,
  TlsConfig,
  configFileSource,
  createDbAdapter,
  derivePaths,
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
import { APP_PATHS, DATABASE_ADAPTER } from './tokens.js';

// Derived once: AppConfigModule needs the config location when the module graph is declared, before Nest builds any provider.
const paths = derivePaths(resolveBase({ sea: isSea(), execPath: process.execPath, cwd: process.cwd() }));

// Options only for the engine the config selects; the engine module is imported when it is chosen, not when this file loads.
async function engineDeps(config: DbConfig, paths: AppPaths, source: AssetSource): Promise<AdapterDeps> {
  if (config.engine !== 'sqlite') return {};
  const { SqliteVector } = await import('shared-core/sqlite');
  return { sqlite: { vector: new SqliteVector({ getAsset: (name) => source.readRaw(name), directory: join(paths.dataDir, 'native') }) } };
}

@Module({
  imports: [
    // A missing or invalid config throws while Nest builds the modules, so the start fails before any service is spawned.
    AppConfigModule.forRoot({
      configClasses: [DbConfig, NetConfig, TlsConfig],
      source: configFileSource(paths),
      origin: join(paths.configDir, CONFIG_FILE),
    }),
    SidecarModule,
  ],
  providers: [
    // The SEA executable embeds the assets; a dev launch reads the files the package step produced.
    { provide: ASSET_SOURCE, useFactory: () => (isSea() ? seaAssetSource : fsAssetSource()) },
    { provide: APP_PATHS, useValue: paths },
    {
      provide: DATABASE_ADAPTER,
      inject: [AppConfigModule.getToken(DbConfig), AppConfigModule.getToken(NetConfig), AppConfigModule.getToken(TlsConfig), ASSET_SOURCE],
      // createDbAdapter still takes the whole AppConfig; it reads only db.
      useFactory: async (db: DbConfig, net: NetConfig, tls: TlsConfig, source: AssetSource): Promise<DbAdapter> => {
        const config: AppConfig = { db, net, tls };
        return createDbAdapter(config, paths, await engineDeps(db, paths, source));
      },
    },
    PersistenceService,
  ],
  exports: [PersistenceService, APP_PATHS, DATABASE_ADAPTER],
})
export class PersistenceModule {}
