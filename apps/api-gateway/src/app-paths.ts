import type { Provider } from '@nestjs/common';
import { isSea } from 'node:sea';
import { derivePaths, resolveBase, type AppPaths } from 'shared-core';

// The gateway is its own process (REQ-CFG-06): it builds its own paths, never the supervisor's.
export const APP_PATHS = Symbol('APP_PATHS');

// A child is the same executable as the supervisor, so both resolve the same base and open the same database.
export function resolveAppPaths(): AppPaths {
  return derivePaths(resolveBase({ sea: isSea(), execPath: process.execPath, cwd: process.cwd() }));
}

export const appPathsProvider: Provider<AppPaths> = { provide: APP_PATHS, useFactory: resolveAppPaths };
