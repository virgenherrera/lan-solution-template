import { NestFactory } from '@nestjs/core';
import { NodeAdapter } from '@nestjs/platform-node';
import type { INestApplication } from '@nestjs/common';
import { hostname, networkInterfaces } from 'node:os';
import { AppConfigModule, NetConfig } from 'shared-core';
import { loadTlsIdentity, type TlsIdentity } from 'shared-core/tls';
import { API_PREFIX } from './api-prefix.js';
import { AppModule } from './app.module.js';
import { GatewayConfigSource } from './config-source.js';
import { ServerConfig } from './server-config.js';

export interface AppContext {
  app: INestApplication;
  netConfig: NetConfig;
  serverConfig: ServerConfig;
  identity: TlsIdentity;
}

export class AppBootstrap {
  static async createAppContext(): Promise<AppContext> {
    // Read-only: the gateway never creates or renews certificates. Missing or invalid files (and a missing or invalid config) stop the start here, with the command that fixes them.
    // This is the only use of the config outside Nest: NodeAdapter builds the HTTPS server from `httpsOptions` while the app is created, before ConfigService exists. Creating the app twice instead would open the database twice.
    const { tls } = GatewayConfigSource.file();
    const identity = loadTlsIdentity({
      paths: GatewayConfigSource.paths,
      tls,
      now: new Date(),
      log: (message) => console.error(message),
      hostname: hostname(),
      interfaces: networkInterfaces(),
    });
    const app = await NestFactory.create(AppModule, new NodeAdapter(), {
      httpsOptions: { key: identity.key, cert: identity.cert },
    });
    app.setGlobalPrefix(API_PREFIX);

    // By the injection token of the namespace, as @InjectConfig does: pnpm resolves @nestjs/config twice (api-gateway and shared-core get different peer sets), so the ConfigService class here is not the one the module provides.
    const netConfig = app.get<NetConfig>(AppConfigModule.getToken(NetConfig), { strict: false });
    const serverConfig = app.get<ServerConfig>(AppConfigModule.getToken(ServerConfig), { strict: false });

    return { app, netConfig, serverConfig, identity };
  }
}
