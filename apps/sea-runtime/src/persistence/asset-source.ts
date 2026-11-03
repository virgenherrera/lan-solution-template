import { getAsset, getRawAsset } from 'node:sea';

// Where the persistence boot reads its build assets from: the SEA executable or, in dev, files on disk.
// Both return the same bytes, so the boot code has one path.
export interface AssetSource {
  // A missing asset means a broken build, so it throws.
  readText(name: string): string;
  // Matches `getRawAsset`: undefined when the asset does not exist.
  readRaw(name: string): ArrayBuffer | Uint8Array | undefined;
}

export const ASSET_SOURCE = Symbol('ASSET_SOURCE');

export const seaAssetSource: AssetSource = {
  readText(name) {
    const text = getAsset(name, 'utf8');
    if (text === undefined) throw new Error(`SEA asset "${name}" is missing`);
    return text;
  },
  readRaw: (name) => getRawAsset(name),
};
