import type { AppConfig } from '../config.js';
import type { AppPaths } from '../paths.js';
import type { DbAdapter } from './port.js';
import { SqliteAdapter, type SqliteVectorBackend } from './sqlite-adapter.js';

export interface AdapterDeps {
  readonly sqliteVector?: SqliteVectorBackend;
}

type EngineFactory = (config: AppConfig, paths: AppPaths, deps: AdapterDeps) => DbAdapter;

// Strategy registry keyed by `db.engine`. A new engine adds one entry here and one value to the config enum.
const ENGINES: Readonly<Record<AppConfig['db']['engine'], EngineFactory>> = {
  sqlite: (config, paths, deps) => new SqliteAdapter(config.db.sqlite, paths.dataDir, deps.sqliteVector),
};

export function createDbAdapter(config: AppConfig, paths: AppPaths, deps: AdapterDeps = {}): DbAdapter {
  const factory = ENGINES[config.db.engine];
  if (factory === undefined) throw new Error(`unknown db engine: ${String(config.db.engine)}`);
  return factory(config, paths, deps);
}
