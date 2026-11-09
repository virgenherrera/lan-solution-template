import 'reflect-metadata';
import { dirname, join } from 'node:path';
import { CommandFactory } from 'nest-commander';
import { EXIT_CODE } from 'service-registry';
import { ExitError } from './constants/exit-error.js';
import { ToolsCliModule } from './tools-cli.module.js';

const COMMANDER_OK_CODES = new Set(['commander.helpDisplayed', 'commander.help', 'commander.version']);

class ToolsCliMain {
  static async main(): Promise<void> {
    await new ToolsCliMain().run();
  }

  private async run(): Promise<void> {
    const logger = this.initLogger();
    this.nameProgram();
    try {
      await this.execute(logger);
    } catch (error) {
      this.handleExit(error);
    }
  }

  // Nest logging is off: a command owns its stdout and stderr contract byte for byte.
  private initLogger(): false {
    return false;
  }

  // commander names the program after the basename of argv[1] (`main` for dist/main.js); help must print the tool name.
  private nameProgram(): void {
    const script = process.argv[1];
    if (script !== undefined) process.argv[1] = join(dirname(script), 'tools-cli');
  }

  // Each command parses its own input (zod) inside its handler; nothing else reads process.argv.
  private async execute(logger: false): Promise<void> {
    await CommandFactory.run(ToolsCliModule, {
      logger,
      cliName: 'tools-cli',
      // commander prints its own message, then this hook ends the run with the usage code.
      errorHandler: (error) => {
        const code = (error as { code?: string }).code ?? '';
        throw new ExitError(COMMANDER_OK_CODES.has(code) ? EXIT_CODE.ok : EXIT_CODE.argumentRejected);
      },
      // A failure inside a command reaches handleExit instead of a stack trace.
      serviceErrorHandler: (error) => {
        throw error;
      },
    });
  }

  private handleExit(error: unknown): never {
    if (error instanceof ExitError) process.exit(error.code);
    const lines = error instanceof Error ? error.message.split('\n') : [String(error)];
    lines.forEach((line) => process.stderr.write(`tools-cli: ${line}\n`));
    process.exit(EXIT_CODE.startupFailed);
  }
}

await ToolsCliMain.main();
