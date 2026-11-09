import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';
import { RepoRoot } from '../services/repo-root.service.js';

// Stages the packaged SEA runtime as the Tauri `externalBin` sidecar.
// Run from anywhere: `tools-cli stage-sidecar` (the repository root comes from the location of the built CLI, apps/tools-cli/dist/main.js).
// compile-sea already names each artifact `sea-runtime-<target-triple>[.exe]`, which is the name Tauri expects under src-tauri/binaries/ (REQ-DESK-01).
// The staged copies are ignored by git. Run `nx run sea-runtime:package` first (REQ-ECO-06).
// A missing input throws: ToolsCliMain prints `tools-cli: <message>` and exits 1. The retired script ignored every argument and so does this command.
@Command({
  name: 'stage-sidecar',
  description: 'Copy the packaged SEA runtime artifacts to apps/desktop/src-tauri/binaries as the Tauri sidecar (REQ-DESK-01).',
  arguments: '[ignored...]',
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
@Injectable()
export class StageSidecarCommand extends CommandRunner {
  constructor(private readonly repo: RepoRoot) {
    super();
  }

  override run(): Promise<void> {
    const root = this.repo.path;
    const artifacts = join(root, 'artifacts', 'sea-runtime');
    const binaries = join(root, 'apps', 'desktop', 'src-tauri', 'binaries');

    if (!existsSync(artifacts)) throw new Error(`${artifacts} is missing: run "pnpm exec nx run sea-runtime:package" first`);
    const staged = readdirSync(artifacts).filter((name) => name.startsWith('sea-runtime-'));
    if (staged.length === 0) throw new Error(`${artifacts} holds no sea-runtime-<target-triple> artifact`);

    mkdirSync(binaries, { recursive: true });
    for (const name of staged) {
      copyFileSync(join(artifacts, name), join(binaries, name));
      process.stdout.write(`staged ${name}\n`);
    }
    return Promise.resolve();
  }
}
