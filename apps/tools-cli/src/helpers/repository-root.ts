import { dirname, resolve } from 'node:path';

// The bundle rewrites import.meta.url to the source path, so the root comes from the entry script: <root>/apps/tools-cli/dist/main.js.
// ToolsCliMain renames argv[1] to `tools-cli` inside the same directory, so dirname stays valid.
export const repositoryRoot = (): string =>
  resolve(dirname(process.argv[1] ?? ''), '..', '..', '..');
