// Packages apps/api-gateway into one self-contained Node SEA executable.
// Run from the repository root: `node tools/scripts/compile-sea.ts`, or through Nx.
// The SEA config is generated here at build time and is never committed.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..', '..');
const entry = join(root, 'apps', 'api-gateway', 'dist', 'main.js');
const workDir = join(root, 'dist', 'sea-build');
const outDir = join(root, 'dist', 'sea');
const bundlePath = join(workDir, 'api-gateway.mjs');
const configPath = join(workDir, 'sea-config.json');
const binaryPath = join(outDir, 'api-gateway');

type Version = [number, number, number];

function parseVersion(text: string): Version {
  const parts = text.replace(/^v/, '').split('.').map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function compareVersions(a: Version, b: Version): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

// Supports the comparators used by the root engines.node range (for example ">=26.13.0 <27").
function satisfiesEngine(version: Version, range: string): boolean {
  return range.trim().split(/\s+/).every((comparator) => {
    const match = /^(>=|<=|>|<|=)?v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(comparator);
    if (!match) throw new Error(`unsupported engines.node comparator: ${comparator}`);
    const op = match[1] ?? '=';
    const bound: Version = [Number(match[2]), Number(match[3] ?? 0), Number(match[4] ?? 0)];
    const diff = compareVersions(version, bound);
    switch (op) {
      case '>=': return diff >= 0;
      case '<=': return diff <= 0;
      case '>': return diff > 0;
      case '<': return diff < 0;
      default: return diff === 0;
    }
  });
}

function assertBuildNodeMatchesEngine(): void {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    engines?: { node?: string };
  };
  const range = pkg.engines?.node;
  if (!range) throw new Error('root package.json has no engines.node');
  const version = parseVersion(process.version);
  if (!satisfiesEngine(version, range)) {
    throw new Error(`build Node ${process.version} does not satisfy engines.node "${range}"`);
  }
  console.log(`node ${process.version} satisfies engines.node "${range}"`);
}

async function bundle(): Promise<void> {
  await build({
    entryPoints: [entry],
    outfile: bundlePath,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node26',
    logLevel: 'warning',
    // CJS dependencies in the ESM bundle call require(); give them a real require (built-ins only, no file system).
    banner: {
      js: "import { createRequire as __seaCreateRequire } from 'node:module'; const require = __seaCreateRequire(import.meta.url);",
    },
    // Nest loads these optional peers only for features this app does not use (microservices, websockets, validation pipes).
    external: [
      '@nestjs/microservices',
      '@nestjs/microservices/*',
      '@nestjs/websockets',
      '@nestjs/websockets/*',
      'class-validator',
      'class-transformer',
    ],
  });
}

function writeSeaConfig(): void {
  const config = {
    main: bundlePath,
    mainFormat: 'module',
    output: binaryPath,
    useVfs: false,
    useSnapshot: false,
    useCodeCache: true,
    execArgvExtension: 'none',
  };
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

function buildSea(): void {
  execFileSync(process.execPath, ['--build-sea', configPath], { stdio: 'inherit' });
  // The Node SEA doc requires an ad-hoc signature on macOS; an unsigned arm64 binary is killed at start.
  if (process.platform === 'darwin') {
    execFileSync('codesign', ['--sign', '-', binaryPath], { stdio: 'inherit' });
  }
}

async function main(): Promise<void> {
  if (!existsSync(entry)) {
    throw new Error(`missing ${entry}; run the api-gateway build target first`);
  }
  assertBuildNodeMatchesEngine();

  rmSync(workDir, { recursive: true, force: true });
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  await bundle();
  writeSeaConfig();
  buildSea();

  const size = statSync(binaryPath).size;
  console.log(`sea executable: ${binaryPath} (${size} bytes)`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
