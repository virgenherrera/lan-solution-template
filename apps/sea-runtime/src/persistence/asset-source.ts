import { Injectable } from '@nestjs/common';
import { getAsset, getRawAsset } from 'node:sea';

// Where the persistence boot reads its build assets from: the SEA executable or, in dev, files on disk.
// Both return the same bytes, so the boot code has one path. The class is the injection token.
export abstract class AssetSource {
  // A missing asset means a broken build, so it throws.
  abstract readText(name: string): string;
  // Matches `getRawAsset`: undefined when the asset does not exist.
  abstract readRaw(name: string): ArrayBuffer | Uint8Array | undefined;
}

@Injectable()
export class SeaAssetSource extends AssetSource {
  readText(name: string): string {
    const text = getAsset(name, 'utf8');
    if (text === undefined) throw new Error(`SEA asset "${name}" is missing`);
    return text;
  }

  readRaw(name: string): ArrayBuffer | undefined {
    return getRawAsset(name);
  }
}
