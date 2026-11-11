import { dirname, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';

// The repository root. The bundle rewrites import.meta.url to the source path, so the root comes from the entry script: <root>/apps/tools-cli/dist/main.js.
@Injectable()
export class RepoRoot {
  get path(): string {
    return resolve(dirname(process.argv[1] ?? ''), '..', '..', '..');
  }
}
