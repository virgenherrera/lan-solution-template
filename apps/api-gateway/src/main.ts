import { NestFactory } from '@nestjs/core';
import { NodeAdapter } from '@nestjs/platform-node';
import { AGGREGATE_STATE, CONTROL_KIND, readyMessageSchema } from 'service-registry';
import { AppModule } from './app.module.js';
import { HealthState } from './health-state.js';
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
  const health = app.get(HealthState);
  await app.listen(config.port, config.hostname);
  if (process.send === undefined) {
    // Standalone run: no supervisor, so listening is ready.
    health.set(AGGREGATE_STATE.ready);
    return;
  }
  // Supervised run: tell the supervisor, then follow the aggregate state it sends back.
  process.on('message', (raw) => health.apply(raw));
  process.send(readyMessageSchema.parse({ kind: CONTROL_KIND.ready }));
}
await bootstrap();
