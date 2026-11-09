import { spawnSync } from 'node:child_process';
import { Injectable } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';
import { EXIT_CODE } from 'service-registry';
import { ExitError } from '../constants/exit-error.js';

// Test selection adapter for the root `test` script (REQ-TEST-02, REQ-TEST-03, REQ-ECO-04).
//
// Optional selection tags. A tag never changes the runner, the bootstrap or the environment:
//   @ut   selects behaviors observable through the real app.
//   @int  selects interactions between real components.
//   @app  selects the complete APP suite; untagged cases are also APP.
//
// Usage (pnpm appends the arguments after `--`):
//   pnpm test                          all cases
//   pnpm test -- --filter @ut|@int|@app
//
// The adapter is the first step of `test`: it validates the filter before anything runs, then runs securityCheck and the Nx test fan-out.
// The filter never reaches Nx or pnpm. Prints the runner arguments as JSON: { "jest": [...], "playwright": [...] }.
// Jest receives --testNamePattern and Playwright receives --grep.
// Unknown tags, an empty tag and any other argument exit with code 2 before any step runs.
const TAGS: readonly string[] = ['@ut', '@int', '@app'];
const USAGE = 'usage: tools-cli test-filter [-- --filter @ut|@int|@app]';

@Command({
  name: 'test-filter',
  description: 'Validate the test selection tag, print the runner arguments and run the security and test steps (REQ-TEST-02).',
  arguments: '[args...]',
  // `--filter` is not a commander option of this command: the adapter parses its own argv, as the retired script did.
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
@Injectable()
export class TestFilterCommand extends CommandRunner {
  override run(passedParams: string[]): Promise<void> {
    const tag = this.parseTag(passedParams);
    // @app is the complete suite, so it adds no pattern.
    const selects = tag !== undefined && tag !== '@app';
    const translation = {
      jest: selects ? ['--testNamePattern', tag] : [],
      playwright: selects ? ['--grep', tag] : [],
    };

    process.stdout.write(`${JSON.stringify(translation)}\n`);

    // Static and security checks always run, whatever the filter selected.
    this.step('pnpm', ['run', 'securityCheck']);
    // The translated runner arguments are not consumed yet: no APP tests exist for them to select.
    this.step('pnpm', ['exec', 'nx', 'run-many', '-t', 'test', '--exclude=lan-solution-template']);
    return Promise.resolve();
  }

  private fail(message: string): never {
    process.stderr.write(`test-filter: ${message}\n${USAGE}\n`);
    throw new ExitError(EXIT_CODE.argumentRejected);
  }

  private parseTag(argv: readonly string[]): string | undefined {
    // pnpm forwards the arguments after `--` and keeps that separator in argv.
    const args = argv[0] === '--' ? argv.slice(1) : argv;
    if (args.length === 0) {
      return undefined;
    }
    if (args.length !== 2 || args[0] !== '--filter') {
      return this.fail(`unsupported arguments: ${args.join(' ')}`);
    }
    const tag = args[1] ?? '';
    if (tag.trim() === '') {
      return this.fail('--filter requires a non-empty tag');
    }
    if (!TAGS.includes(tag)) {
      return this.fail(`unknown filter "${tag}"; expected one of ${TAGS.join(', ')}`);
    }
    return tag;
  }

  private step(command: string, args: readonly string[]): void {
    const result = spawnSync(command, [...args], { stdio: 'inherit', shell: false });
    if (result.error !== undefined) {
      process.stderr.write(`test-filter: ${command} failed to start: ${result.error.message}\n`);
      throw new ExitError(EXIT_CODE.startupFailed);
    }
    if (result.status !== 0) {
      throw new ExitError(result.status ?? EXIT_CODE.startupFailed);
    }
  }
}
