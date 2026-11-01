import { NestFactory } from '@nestjs/core';
import { NodeAdapter } from '@nestjs/platform-node';
import { AppModule } from './app.module.js';
import { parseServerConfig } from './server-config.js';

async function bootstrap() {
  const config = parseServerConfig(process.argv.slice(2));
  const app = await NestFactory.create(AppModule.register(config), new NodeAdapter());
  app.setGlobalPrefix('api');
  await app.listen(config.port, config.hostname);
}
await bootstrap();
