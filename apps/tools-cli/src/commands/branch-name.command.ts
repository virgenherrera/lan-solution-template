import { spawnSync } from 'node:child_process';
import { Injectable } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';
import { EXIT_CODE } from 'service-registry';
import { z } from 'zod';
import { ExitError } from '../constants/exit-error.js';

// REQ-VERSION-02: PR source branch validator.
//   major/<slug> -> major, minor/<slug> -> minor, fix/<slug> -> patch
//   docs/<slug>, chore/<slug> -> none (explicit exemption: no release)
// Any other name, including `main`, is rejected (exit 1). A slug is lowercase letters, digits and single hyphens.
// Usage: tools-cli branch-name [<branch>]   defaults to the current git branch.
// Prints `<branch> bump=<major|minor|patch|none>` on success.
const BUMPS: Readonly<Record<string, string>> = {
  major: 'major',
  minor: 'minor',
  fix: 'patch',
  docs: 'none',
  chore: 'none',
};
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// The one input of the command: zero or one positional. A second positional is a usage error.
const inputSchema = z.tuple([]).or(z.tuple([z.string()]));

@Command({
  name: 'branch-name',
  description:
    'Validate a PR source branch name and print its release bump (REQ-VERSION-02).',
  arguments: '[branch...]',
  // The retired script took no options: `--x` was a branch name and exit 1 rejected it. Keep that.
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
@Injectable()
export class BranchNameCommand extends CommandRunner {
  override run(passedParams: string[]): Promise<void> {
    const input = inputSchema.safeParse(passedParams);
    if (!input.success) {
      process.stderr.write('usage: tools-cli branch-name [<branch>]\n');
      throw new ExitError(EXIT_CODE.argumentRejected);
    }
    const branch = input.data[0] ?? this.currentBranch();
    const [prefix, slug, ...extra] = branch.split('/');
    const bump =
      prefix !== undefined && Object.hasOwn(BUMPS, prefix)
        ? BUMPS[prefix]
        : undefined;

    if (
      bump === undefined ||
      slug === undefined ||
      extra.length > 0 ||
      !SLUG.test(slug)
    ) {
      process.stderr.write(
        `branch-name: "${branch}" is invalid; expected <${Object.keys(BUMPS).join('|')}>/<slug> (lowercase, digits, hyphens)\n`,
      );
      throw new ExitError(EXIT_CODE.startupFailed);
    }
    process.stdout.write(`${branch} bump=${bump}\n`);
    return Promise.resolve();
  }

  private currentBranch(): string {
    const result = spawnSync('git', ['branch', '--show-current'], {
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      process.stderr.write('branch-name: cannot read the current git branch\n');
      throw new ExitError(EXIT_CODE.argumentRejected);
    }
    return result.stdout.trim();
  }
}
