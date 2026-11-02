import { manifestSchema } from 'db-migrations';
import type { Migration } from 'shared-core';
import type { AssetSource } from './asset-source.js';
import { MANIFEST_ASSET, migrationAsset } from './assets.js';

// Builds the migration list from the embedded manifest and .sql files. The manifest sha256 travels with each
// migration, so the migrator rejects a file that no longer matches the build.
export function readEmbeddedMigrations(source: AssetSource): Migration[] {
  const manifest = manifestSchema.parse(JSON.parse(source.readText(MANIFEST_ASSET)));
  return manifest.migrations.map((entry) => ({
    // The migrator wants versions from 1; drizzle journal ids start at 0.
    version: entry.id + 1,
    name: entry.tag,
    sql: source.readText(migrationAsset(entry.file)),
    sha256: entry.sha256,
  }));
}
