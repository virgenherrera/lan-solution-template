import { NestFactory } from '@nestjs/core';
import { RuntimeModule } from './runtime/runtime.module.js';

async function bootstrap() {
  await NestFactory.createApplicationContext(RuntimeModule, {
    // Nest's own log lines carry no service id prefix; the supervisor writes its own prefixed lines.
    logger: false,
  });
}
try {
  await bootstrap();
} catch (error) {
  // A rejected top-level await makes Node print a line of the bundled source. The message, once and prefixed, plus exit code 1 is what the operator needs.
  const lines = error instanceof Error ? error.message.split('\n') : [String(error)];
  lines.forEach((line, index) => process.stderr.write(`[supervisor] ${index === 0 ? 'startup failed: ' : ''}${line}\n`));
  process.exit(1);
}
