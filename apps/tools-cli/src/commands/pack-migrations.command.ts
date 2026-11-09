import { Injectable } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';
import { EXIT_CODE } from 'service-registry';
import { ExitError } from '../constants/exit-error.js';
import { MigrationPackService } from '../services/migration-pack.service.js';

// Packs the generated SQL migrations for the SEA (S7, S8). Run from anywhere: `tools-cli pack-migrations [--engine <engine>]`.
// Reads libs/db-migrations/<engine>/migrations (journal order), writes dist/db-migrations/<engine>/{manifest.json,build-info.json,<tag>.sql}.
// Without --engine it packs every engine the db-migrations contract lists (ENGINES); there is no implicit single engine.
// Exit codes: 0 done, 1 error (the message goes to stderr as the retired script printed it). Any other argument is ignored, as before.
@Command({
  name: 'pack-migrations',
  description:
    'Pack the generated SQL migrations into dist/db-migrations/<engine> for the SEA (S7, S8).',
  arguments: '[args...]',
  // The command reads --engine from its own arguments, as the retired script did.
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
@Injectable()
export class PackMigrationsCommand extends CommandRunner {
  constructor(private readonly packer: MigrationPackService) {
    super();
  }

  override run(passedParams: string[]): Promise<void> {
    try {
      this.packer.pack(this.requestedEngine(passedParams));
    } catch (error) {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`,
      );
      throw new ExitError(EXIT_CODE.startupFailed);
    }
    return Promise.resolve();
  }

  private requestedEngine(args: readonly string[]): string | undefined {
    const index = args.indexOf('--engine');
    if (index < 0) return undefined;
    const value = args[index + 1];
    if (value === undefined) throw new Error('--engine needs a value');
    return value;
  }
}
