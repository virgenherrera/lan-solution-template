// Stages the packaged SEA runtime as the Tauri `externalBin` sidecar.
// Run from anywhere: `node tools/scripts/stage-sidecar.ts`.
// compile-sea.ts already names each artifact `sea-runtime-<target-triple>[.exe]`, which is the name Tauri expects under src-tauri/binaries/ (REQ-DESK-01).
// The staged copies are ignored by git. Run `nx run sea-runtime:package` first (REQ-ECO-06).
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const artifacts = join(root, 'artifacts', 'sea-runtime');
const binaries = join(root, 'apps', 'desktop', 'src-tauri', 'binaries');

if (!existsSync(artifacts)) throw new Error(`${artifacts} is missing: run "pnpm exec nx run sea-runtime:package" first`);
const staged = readdirSync(artifacts).filter((name) => name.startsWith('sea-runtime-'));
if (staged.length === 0) throw new Error(`${artifacts} holds no sea-runtime-<target-triple> artifact`);

mkdirSync(binaries, { recursive: true });
for (const name of staged) {
  copyFileSync(join(artifacts, name), join(binaries, name));
  console.log(`staged ${name}`);
}
