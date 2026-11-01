import { NestFactory } from '@nestjs/core';
import { RuntimeModule } from './runtime/runtime.module.js';

async function bootstrap() {
  await NestFactory.createApplicationContext(RuntimeModule, {
    // Nest's own log lines carry no service id prefix; the supervisor writes its own prefixed lines.
    logger: false,
  });
}
await bootstrap();
