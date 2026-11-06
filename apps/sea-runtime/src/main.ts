import { NestFactory } from '@nestjs/core';
import { Logger, type INestApplicationContext } from '@nestjs/common';
import { EXIT_CODE, SUPERVISOR_CONFIG } from 'service-registry';
import { InjectLogger, provideLogger } from 'shared-core';
import { RuntimeModule } from './modules/runtime.module.js';

class SeaRuntimeMain {
  @InjectLogger() private declare readonly logger: Logger;

  static async main(): Promise<void> {
    await new SeaRuntimeMain().run();
  }

  private async run(): Promise<void> {
    try {
      this.initLogger();
      const app = await this.createApp();
      this.configureApp(app);
    } catch (error) {
      this.handleFatal(error);
    }
  }

  // Installs the logger Nest keeps for the whole process; every line carries the supervisor id as prefix.
  private initLogger(): void {
    Logger.overrideLogger(provideLogger({ prefix: SUPERVISOR_CONFIG.id }));
  }

  private createApp(): Promise<INestApplicationContext> {
    return NestFactory.createApplicationContext(RuntimeModule, {
      // Without this Nest aborts the process; the catch below reports the failure instead.
      abortOnError: false,
    });
  }

  private configureApp(app: INestApplicationContext): void {
    app.enableShutdownHooks();
  }

  private handleFatal(error: unknown): never {
    // A rejected top-level await makes Node print a line of the bundled source. The message, once and prefixed, plus exit code 1 is what the operator needs.
    const lines = error instanceof Error ? error.message.split('\n') : [String(error)];
    lines.forEach((line, index) => this.logger.error(`${index === 0 ? 'startup failed: ' : ''}${line}`));
    process.exit(EXIT_CODE.startupFailed);
  }
}

await SeaRuntimeMain.main();
