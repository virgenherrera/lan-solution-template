import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// Name of the marker file that makes the directory of the executable the root (REQ-CFG-05, decision 11). Assumption: the SRS does not fix the name.
export const ROOT_MARKER = 'lan-root.marker';

export type RootSource = 'flag' | 'env' | 'marker' | 'dev' | 'os-default';

export interface RootInput {
  readonly argv: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
  // In a SEA this is process.execPath; the anchor is its directory, never the cwd.
  readonly execPath: string;
  readonly platform: NodeJS.Platform;
  // Set only by a dev launch (the ignored `.local` folder of the repo). A packaged run leaves it undefined.
  readonly devAnchor?: string;
  readonly exists?: (path: string) => boolean;
}

export interface ResolvedRoot {
  readonly root: string;
  readonly source: RootSource;
}

export interface AppPaths extends ResolvedRoot {
  // Read-only: the SEA and its bundled assets.
  readonly installDir: string;
  readonly configDir: string;
  readonly dataDir: string;
  readonly logDir: string;
  readonly certDir: string;
}

// Value of `--root <dir>` or `--root=<dir>`; an empty or missing value is an error, not a fallthrough.
function rootFlag(argv: readonly string[]): string | undefined {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string;
    if (arg === '--root') {
      const value = argv[i + 1];
      if (value === undefined || value === '' || value.startsWith('--')) throw new Error('--root needs a directory');
      return value;
    }
    if (arg.startsWith('--root=')) {
      const value = arg.slice('--root='.length);
      if (value === '') throw new Error('--root needs a directory');
      return value;
    }
  }
  return undefined;
}

// OS default roots (decision 11: the installer POCs confirm them). Assumption: not verified on a real install.
function osDefaultRoot(platform: NodeJS.Platform, env: RootInput['env']): string {
  if (platform === 'win32') return join(env['ProgramData'] ?? 'C:\\ProgramData', 'LanSolution');
  if (platform === 'darwin') return '/Library/Application Support/LanSolution';
  return '/var/lib/lan-solution';
}

// One root, resolved once. Precedence: --root, APP_HOME, marker beside the executable, dev anchor, OS default.
export function resolveRoot(input: RootInput): ResolvedRoot {
  const exists = input.exists ?? existsSync;
  const flag = rootFlag(input.argv);
  if (flag !== undefined) return { root: resolve(flag), source: 'flag' };
  const env = input.env['APP_HOME'];
  if (env !== undefined && env !== '') return { root: resolve(env), source: 'env' };
  const exeDir = dirname(input.execPath);
  if (exists(join(exeDir, ROOT_MARKER))) return { root: exeDir, source: 'marker' };
  if (input.devAnchor !== undefined) return { root: resolve(input.devAnchor), source: 'dev' };
  return { root: osDefaultRoot(input.platform, input.env), source: 'os-default' };
}

// Derived paths are relative to the root. Dev layout: config/ and data/ under the ignored `.local` folder of the repo.
export function derivePaths(resolved: ResolvedRoot, execPath: string): AppPaths {
  const { root } = resolved;
  return Object.freeze({
    ...resolved,
    installDir: resolved.source === 'dev' ? root : dirname(execPath),
    configDir: join(root, 'config'),
    dataDir: join(root, 'data'),
    logDir: join(root, 'logs'),
    certDir: join(root, 'certs'),
  });
}
