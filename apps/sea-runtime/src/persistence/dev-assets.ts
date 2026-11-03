import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsonText } from 'service-registry';
import { z } from 'zod';
import type { AssetSource } from './asset-source.js';

// Dev (`nest start`) reads the files the package step already produced. Prerequisite: run
// `pnpm exec nx run sea-runtime:package` once; it writes dist/sea-package/sea-config.json (the asset map) and dist/db-migrations/.
const PACKAGE_HINT = 'run `pnpm exec nx run sea-runtime:package` first';
const WORKSPACE_MARKER = 'pnpm-workspace.yaml';
// Ignored dev root: config/, data/, logs/ and certs/ live here, never in the repo root.
const DEV_ROOT_DIR = '.local';
const SEA_CONFIG = join('dist', 'sea-package', 'sea-config.json');

// Walks up from this file until the workspace marker. The root comes from the file's location, never the cwd,
// because `pnpm --filter` changes the cwd to the app folder. No fixed depth: the bundler may report the source or the dist path.
export function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, WORKSPACE_MARKER))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`repo root not found above ${dirname(fileURLToPath(import.meta.url))}`);
    dir = parent;
  }
  return dir;
}

// Root for config, data and logs of a dev launch: an ignored folder, so dev state never lands in tracked files.
export function devAnchor(): string {
  return join(repoRoot(), DEV_ROOT_DIR);
}

const seaConfigSchema = z.object({ assets: z.record(z.string(), z.string()) });

function readAssetMap(base: string): Record<string, string> {
  const configPath = join(base, SEA_CONFIG);
  if (!existsSync(configPath)) throw new Error(`${configPath} not found: ${PACKAGE_HINT}`);
  return jsonText(seaConfigSchema).parse(readFileSync(configPath, 'utf8')).assets;
}

function readFile(name: string, path: string): Buffer {
  if (!existsSync(path)) throw new Error(`asset "${name}" file ${path} not found: ${PACKAGE_HINT}`);
  return readFileSync(path);
}

// Same name list the SEA embeds: the assets map of sea-config.json maps each name to its file.
export function fsAssetSource(base: string = repoRoot()): AssetSource {
  const assets = readAssetMap(base);
  return {
    readText(name) {
      const path = assets[name];
      if (path === undefined) throw new Error(`asset "${name}" is not in ${SEA_CONFIG}: ${PACKAGE_HINT}`);
      return readFile(name, path).toString('utf8');
    },
    readRaw(name) {
      const path = assets[name];
      return path === undefined ? undefined : readFile(name, path);
    },
  };
}
