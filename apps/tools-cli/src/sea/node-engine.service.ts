import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { RepoRoot } from '../services/repo-root.service.js';
import { readJson } from './json-file.js';

type Version = [number, number, number];

const rootPackageSchema = z.looseObject({
  engines: z.looseObject({ node: z.string().optional() }).optional(),
});

// The build Node must satisfy the root engines.node range.
@Injectable()
export class NodeEngineService {
  constructor(private readonly repo: RepoRoot) {}

  assertBuildNodeMatchesEngine(): void {
    const pkg = readJson(
      join(this.repo.path, 'package.json'),
      rootPackageSchema,
    );
    const range = pkg.engines?.node;
    if (!range) throw new Error('root package.json has no engines.node');
    const version = this.parseVersion(process.version);
    if (!this.satisfies(version, range)) {
      throw new Error(
        `build Node ${process.version} does not satisfy engines.node "${range}"`,
      );
    }
    process.stdout.write(
      `node ${process.version} satisfies engines.node "${range}"\n`,
    );
  }

  private parseVersion(text: string): Version {
    const parts = text.replace(/^v/, '').split('.').map(Number);
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  }

  private compare(a: Version, b: Version): number {
    for (let i = 0; i < 3; i++) {
      if (a[i] !== b[i]) return a[i] - b[i];
    }
    return 0;
  }

  // Supports the comparators used by the root engines.node range (for example ">=26.13.0 <27").
  private satisfies(version: Version, range: string): boolean {
    return range
      .trim()
      .split(/\s+/)
      .every((comparator) => {
        const match = /^(>=|<=|>|<|=)?v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(
          comparator,
        );
        if (!match)
          throw new Error(`unsupported engines.node comparator: ${comparator}`);
        const op = match[1] ?? '=';
        const bound: Version = [
          Number(match[2]),
          Number(match[3] ?? 0),
          Number(match[4] ?? 0),
        ];
        const diff = this.compare(version, bound);
        switch (op) {
          case '>=':
            return diff >= 0;
          case '<=':
            return diff <= 0;
          case '>':
            return diff > 0;
          case '<':
            return diff < 0;
          default:
            return diff === 0;
        }
      });
  }
}
