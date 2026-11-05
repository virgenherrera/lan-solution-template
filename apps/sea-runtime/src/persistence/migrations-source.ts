import { manifestSchema } from 'db-migrations';
import { jsonText } from 'service-registry';
import type { Migration } from 'shared-core';
import type { AssetSource } from './asset-source.js';
import { manifestAsset, migrationAsset } from './assets.js';

// Builds the migration list from the selected engine's embedded manifest and .sql files. A missing asset or a manifest
// packed for another engine throws. The manifest sha256 travels with each migration, so the migrator rejects a file that no longer matches the build.
export function readEmbeddedMigrations(source: AssetSource, engine: string): Migration[] {
  const manifest = jsonText(manifestSchema).parse(source.readText(manifestAsset(engine)));
  if (manifest.engine !== engine) throw new Error(`migration manifest is for engine "${manifest.engine}", expected "${engine}"`);
  return manifest.migrations.map((entry) => ({
    // The migrator wants versions from 1; drizzle journal ids start at 0.
    version: entry.id + 1,
    name: entry.tag,
    sql: source.readText(migrationAsset(engine, entry.file)),
    sha256: entry.sha256,
  }));
}
