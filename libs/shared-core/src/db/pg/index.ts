import type { DbConfig } from '../../schemas/config-dtos.js';
import type { AppPaths } from '../../paths.js';
import type { DbAdapter } from '../port.js';
import { PgAdapter } from './adapter.js';

export * from './adapter.js';

// Everything the PostgreSQL engine accepts beyond the persisted config.
export interface PgOptions {
  // Dimension of the vector columns; defaults to the SQLite backend's.
  readonly dimension?: number;
}

export function createAdapter(config: DbConfig, paths: AppPaths, options: PgOptions = {}): DbAdapter {
  if (config.engine !== 'pg') throw new Error(`the pg engine cannot open a "${config.engine}" config`);
  return new PgAdapter(config.pg, paths.dataDir, options.dimension);
}
