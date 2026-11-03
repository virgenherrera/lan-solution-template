// Names mirror the exports of tools/scripts/pack-migrations.ts, which packs them as SEA assets. Keep both in sync.
// Assets live under "db-migrations/<engine>/" so the runtime reads only the selected engine's files.
export const MIGRATIONS_ASSET_DIR = 'db-migrations';
export const manifestAsset = (engine: string): string => `${MIGRATIONS_ASSET_DIR}/${engine}/manifest.json`;
export const buildInfoAsset = (engine: string): string => `${MIGRATIONS_ASSET_DIR}/${engine}/build-info.json`;
export const migrationAsset = (engine: string, file: string): string => `${MIGRATIONS_ASSET_DIR}/${engine}/${file}`;
