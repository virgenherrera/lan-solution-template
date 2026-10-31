import { NestFactory } from '@nestjs/core';
import { RuntimeModule } from './runtime/runtime.module.js';

async function bootstrap() {
  await NestFactory.createApplicationContext(RuntimeModule);
}
await bootstrap();
