import { NestFactory } from '@nestjs/core';
import { NodeAdapter } from '@nestjs/platform-node';
import { AppModule } from './app.module.js';
import { parseServerConfig } from './server-config.js';
import { receiveWebBundle } from './web-bundle.js';
import { createWebHandler } from './web-handler.js';

async function bootstrap() {
  const config = parseServerConfig(process.argv.slice(2));
  // Receive the bundle first, so a missing or invalid one fails before the port opens.
  const web = config.web === 'ipc' ? await receiveWebBundle() : undefined;
  const app = await NestFactory.create(AppModule.register(config), new NodeAdapter());
  app.setGlobalPrefix('api');
  if (web !== undefined) app.use(createWebHandler(web));
  await app.listen(config.port, config.hostname);
}
await bootstrap();
