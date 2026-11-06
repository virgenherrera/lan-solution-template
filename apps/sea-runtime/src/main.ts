import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { EXIT_CODE, SUPERVISOR_CONFIG, serviceEntries } from 'service-registry';
import { ServiceLogger } from 'shared-core';
import { RuntimeModule } from './modules/runtime.module.js';
import { SERVICES } from './services.js';

class SeaRuntimeMain {
  static async main(): Promise<void> {
    await new SeaRuntimeMain().run();
  }

  private async run(): Promise<void> {
    try {
      const logger = this.initLogger();
      const app = await this.createApp(logger);
      this.configureApp(app);
    } catch (error) {
      this.handleFatal(error);
    }
  }

  // The supervisor and every service id print plain `[id] text` lines; Nest's own lines are dropped.
  private initLogger(): ServiceLogger {
    const serviceIds = serviceEntries(SERVICES).map((entry) => entry.id);
    return new ServiceLogger({ plainContexts: new Set([SUPERVISOR_CONFIG.id, ...serviceIds]), plainPrefix: true, nest: false });
  }

  private createApp(logger: ServiceLogger): Promise<INestApplicationContext> {
    return NestFactory.createApplicationContext(RuntimeModule, {
      logger,
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
    const failure = new Logger(SUPERVISOR_CONFIG.id);
    lines.forEach((line, index) => failure.error(`${index === 0 ? 'startup failed: ' : ''}${line}`));
    process.exit(EXIT_CODE.startupFailed);
  }
}

await SeaRuntimeMain.main();
