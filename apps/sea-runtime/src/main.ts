import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext, LoggerService } from '@nestjs/common';
import { EXIT_CODE, SUPERVISOR_CONFIG } from 'service-registry';
import { provideLogger } from 'shared-core';
import { RuntimeModule } from './modules/runtime.module.js';

class SeaRuntimeMain {
  static async main(): Promise<void> {
    await new SeaRuntimeMain().run();
  }

  private async run(): Promise<void> {
    const logger = this.initLogger();
    try {
      const app = await this.createApp(logger);
      this.configureApp(app);
    } catch (error) {
      this.handleFatal(logger, error);
    }
  }

  // Creates the logger handed to Nest; every line carries the supervisor id as prefix.
  private initLogger(): LoggerService {
    return provideLogger({ prefix: SUPERVISOR_CONFIG.id });
  }

  private createApp(logger: LoggerService): Promise<INestApplicationContext> {
    return NestFactory.createApplicationContext(RuntimeModule, {
      logger,
      // Without this Nest aborts the process; the catch below reports the failure instead.
      abortOnError: false,
    });
  }

  private configureApp(app: INestApplicationContext): void {
    app.enableShutdownHooks();
  }

  private handleFatal(logger: LoggerService, error: unknown): never {
    // A rejected top-level await makes Node print a line of the bundled source. The message, once and prefixed, plus exit code 1 is what the operator needs.
    const lines = error instanceof Error ? error.message.split('\n') : [String(error)];
    lines.forEach((line, index) => logger.error(`${index === 0 ? 'startup failed: ' : ''}${line}`, SeaRuntimeMain.name));
    process.exit(EXIT_CODE.startupFailed);
  }
}

await SeaRuntimeMain.main();
