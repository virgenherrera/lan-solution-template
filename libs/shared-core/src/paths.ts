import { dirname, join, resolve } from 'node:path';

export interface BaseInput {
  // True inside the SEA executable (node:sea isSea()).
  readonly sea: boolean;
  readonly execPath: string;
  readonly cwd: string;
}

export interface AppPaths {
  readonly root: string;
  // Read-only: the SEA and its bundled assets.
  readonly installDir: string;
  readonly configDir: string;
  readonly dataDir: string;
  readonly logDir: string;
  readonly certDir: string;
}

// The only thing that differs between dev and prod: a packaged run uses the folder of the executable, a dev run uses the cwd.
export function resolveBase({ sea, execPath, cwd }: BaseInput): string {
  return sea ? dirname(execPath) : resolve(cwd);
}

// Everything lives under the base with the same layout in both modes.
export function derivePaths(base: string): AppPaths {
  return Object.freeze({
    root: base,
    installDir: base,
    configDir: join(base, 'config'),
    dataDir: join(base, 'data'),
    logDir: join(base, 'logs'),
    certDir: join(base, 'certs'),
  });
}
