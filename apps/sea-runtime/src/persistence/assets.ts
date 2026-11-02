import { getAsset } from 'node:sea';

// Names mirror the exports of tools/scripts/pack-migrations.ts, which packs them as SEA assets. Keep both in sync.
export const MIGRATIONS_ASSET_DIR = 'db-migrations';
export const MANIFEST_ASSET = `${MIGRATIONS_ASSET_DIR}/manifest.json`;
export const BUILD_INFO_ASSET = `${MIGRATIONS_ASSET_DIR}/build-info.json`;
export const migrationAsset = (file: string): string => `${MIGRATIONS_ASSET_DIR}/${file}`;

// A missing asset means a broken build, so it stops the boot with a clear message.
export function readTextAsset(name: string): string {
  const text = getAsset(name, 'utf8');
  if (text === undefined) throw new Error(`SEA asset "${name}" is missing`);
  return text;
}
