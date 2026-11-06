import type { DbConfig } from '../schemas/config-dtos.js';
import type { AppPaths } from '../paths.js';
import type { DbAdapter } from './port.js';
import type { PgOptions } from './pg/index.js';
import type { SqliteOptions } from './sqlite/index.js';

type Engine = DbConfig['engine'];

// Per-engine options, keyed by engine. Type-only: nothing engine specific is loaded by importing this file.
export interface AdapterDeps {
  readonly sqlite?: SqliteOptions;
  readonly pg?: PgOptions;
}

interface EngineModule {
  createAdapter(config: DbConfig, paths: AppPaths, deps: AdapterDeps): DbAdapter;
}

// Strategy registry keyed by `db.engine`. Each value is a literal dynamic import so the bundler can resolve it,
// and an engine module is evaluated only when it is selected. A new engine adds one entry here and one value to the config enum.
const ENGINES: Readonly<Record<Engine, () => Promise<EngineModule>>> = {
  sqlite: async () => {
    const { createAdapter } = await import('./sqlite/index.js');
    return { createAdapter: (config, paths, deps) => createAdapter(config, paths, deps.sqlite) };
  },
  pg: async () => {
    const { createAdapter } = await import('./pg/index.js');
    return { createAdapter: (config, paths, deps) => createAdapter(config, paths, deps.pg) };
  },
};

export async function createDbAdapter(config: DbConfig, paths: AppPaths, deps: AdapterDeps = {}): Promise<DbAdapter> {
  const load = ENGINES[config.engine];
  if (load === undefined) throw new Error(`unknown db engine: ${String(config.engine)}`);
  return (await load()).createAdapter(config, paths, deps);
}
