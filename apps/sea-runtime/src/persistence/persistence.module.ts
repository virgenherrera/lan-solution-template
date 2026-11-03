import { Module } from '@nestjs/common';
import { isSea } from 'node:sea';
import { SidecarModule } from '../sidecar/sidecar.module.js';
import { ASSET_SOURCE, seaAssetSource } from './asset-source.js';
import { fsAssetSource } from './dev-assets.js';
import { PersistenceService } from './persistence.service.js';

@Module({
  imports: [SidecarModule],
  providers: [
    // The SEA executable embeds the assets; a dev launch reads the files the package step produced.
    { provide: ASSET_SOURCE, useFactory: () => (isSea() ? seaAssetSource : fsAssetSource()) },
    PersistenceService,
  ],
  exports: [PersistenceService],
})
export class PersistenceModule {}
