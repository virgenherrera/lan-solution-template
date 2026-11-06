import type { DbConfig } from '../../schemas/config-dtos.js';
import type { AppPaths } from '../../paths.js';
import type { DbAdapter } from '../port.js';
import { SqliteAdapter, type SqliteVectorBackend } from './adapter.js';

export * from './adapter.js';
export * from './vector.js';

// Everything the SQLite engine accepts beyond the persisted config.
export interface SqliteOptions {
  readonly vector?: SqliteVectorBackend;
}

export function createAdapter(config: DbConfig, paths: AppPaths, options: SqliteOptions = {}): DbAdapter {
  if (config.engine !== 'sqlite') throw new Error(`the sqlite engine cannot open a "${config.engine}" config`);
  return new SqliteAdapter(config.sqlite, paths.dataDir, options.vector);
}
