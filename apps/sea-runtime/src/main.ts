import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { EXIT_CODE, SUPERVISOR_CONFIG, serviceEntries } from 'service-registry';
import { ServiceLogger } from 'shared-core';
import { RuntimeModule } from './runtime/runtime.module.js';
import { SERVICES } from './services.js';

// The supervisor and every service id print plain `[id] text` lines; Nest's own lines are dropped.
const logger = new ServiceLogger({ plainContexts: new Set([SUPERVISOR_CONFIG.id, ...serviceEntries(SERVICES).map((entry) => entry.id)]), plainPrefix: true, nest: false });

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(RuntimeModule, {
    logger,
    // Without this Nest aborts the process; the catch below reports the failure instead.
    abortOnError: false,
  });
  app.enableShutdownHooks();
}
try {
  await bootstrap();
} catch (error) {
  // A rejected top-level await makes Node print a line of the bundled source. The message, once and prefixed, plus exit code 1 is what the operator needs.
  const lines = error instanceof Error ? error.message.split('\n') : [String(error)];
  const failure = new Logger(SUPERVISOR_CONFIG.id);
  lines.forEach((line, index) => failure.error(`${index === 0 ? 'startup failed: ' : ''}${line}`));
  process.exit(EXIT_CODE.startupFailed);
}
