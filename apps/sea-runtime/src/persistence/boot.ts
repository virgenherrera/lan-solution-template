import { getRawAsset } from 'node:sea';
import { join } from 'node:path';
import {
  SqliteVector,
  createDbAdapter,
  derivePaths,
  initConfig,
  resolveRoot,
  runMigrations,
  type DbAdapter,
  type Migration,
} from 'shared-core';

// Versioned migrations packaged in the app (REQ-DB-04). POC-3 owns the mechanism and the history table; the first schema arrives with the first feature that needs a table.
const MIGRATIONS: readonly Migration[] = [];

export interface PersistenceBoot {
  readonly db: DbAdapter;
  readonly root: string;
}

// Startup order (REQ-DB-06): config, adapter, connection, vector check, migrations, ready. Any failure throws before a service is spawned.
export async function bootPersistence(log: (text: string) => void): Promise<PersistenceBoot> {
  const resolved = resolveRoot({ argv: process.argv.slice(2), env: process.env, execPath: process.execPath, platform: process.platform });
  const paths = derivePaths(resolved, process.execPath);
  log(`root ${paths.root} (${resolved.source})`);

  const config = initConfig(paths);
  const db = createDbAdapter(config, paths, {
    sqliteVector: new SqliteVector({ getAsset: (name) => getRawAsset(name), directory: join(paths.dataDir, 'native') }),
  });
  try {
    await db.connect();
    await db.verifyVector();
    const result = await runMigrations(db, MIGRATIONS);
    log(`database ${db.engine} ready, vector ok, migrations applied: ${result.applied.length}`);
    return { db, root: paths.root };
  } catch (error) {
    await db.close();
    throw error;
  }
}
