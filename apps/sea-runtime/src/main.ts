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
  // A rejected top-level await makes Node print a line of the bundled source. One clean line and exit code 1 is what the operator needs.
  const reason = error instanceof Error ? error.message.split('\n')[0] : String(error);
  process.stderr.write(`[supervisor] startup failed: ${reason}\n`);
  process.exit(1);
}
