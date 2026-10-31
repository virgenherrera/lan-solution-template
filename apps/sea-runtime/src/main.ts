import { NestFactory } from '@nestjs/core';
import { NodeAdapter } from '@nestjs/platform-node';
import { AppModule } from './app.module.js';
import { SERVER_CONFIG, type ServerConfig } from './server-config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new NodeAdapter());
  const config = app.get<ServerConfig>(SERVER_CONFIG);
  await app.listen(config.port, config.hostname);
}
await bootstrap();
