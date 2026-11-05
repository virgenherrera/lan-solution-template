import type { AppConfig } from '../../config.js';
import type { AppPaths } from '../../paths.js';
import type { DbAdapter } from '../port.js';
import { SqliteAdapter, type SqliteVectorBackend } from './adapter.js';

export * from './adapter.js';
export * from './vector.js';

// Everything the SQLite engine accepts beyond the persisted config.
export interface SqliteOptions {
  readonly vector?: SqliteVectorBackend;
}

export function createAdapter(config: AppConfig, paths: AppPaths, options: SqliteOptions = {}): DbAdapter {
  if (config.db.engine !== 'sqlite') throw new Error(`the sqlite engine cannot open a "${config.db.engine}" config`);
  return new SqliteAdapter(config.db.sqlite, paths.dataDir, options.vector);
}
