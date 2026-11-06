import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NodeAdapter } from '@nestjs/platform-node';
import type { INestApplication, LoggerService } from '@nestjs/common';
import { hostname, networkInterfaces } from 'node:os';
import { NetConfig } from 'shared-core';
import { loadTlsIdentity, type TlsIdentity } from 'shared-core/tls';
import { API_PREFIX } from './api-prefix.js';
import { AppModule } from './app.module.js';
import { GatewayConfigSource } from './services/config-source.js';
import { ServerConfig } from './schemas/server-config.js';

export interface AppContext {
  app: INestApplication;
  netConfig: NetConfig;
  serverConfig: ServerConfig;
  identity: TlsIdentity;
}

export class AppBootstrap {
  // The logger arrives as a parameter: this runs before the app exists, so the TLS line goes out through the instance, and the same instance is handed to the factory.
  static async createAppContext(logger: LoggerService): Promise<AppContext> {
    // First, so an invalid --web fails before the config or the TLS files are read.
    ServerConfig.fromArgv(process.argv.slice(2));
    // Read-only: the gateway never creates or renews certificates. Missing or invalid files (and a missing or invalid config) stop the start here, with the command that fixes them.
    // This is the only use of the config outside Nest: NodeAdapter builds the HTTPS server from `httpsOptions` while the app is created, before ConfigService exists. Creating the app twice instead would open the database twice.
    const { tls } = GatewayConfigSource.file();
    const identity = loadTlsIdentity({
      paths: GatewayConfigSource.paths,
      tls,
      now: new Date(),
      log: (message) => logger.log(message, AppBootstrap.name),
      hostname: hostname(),
      interfaces: networkInterfaces(),
    });
    const app = await NestFactory.create(AppModule, new NodeAdapter(), {
      logger,
      httpsOptions: { key: identity.key, cert: identity.cert },
      // A startup error reaches HttpAppMain, which prints it as one line, instead of Nest logging it and exiting by itself.
      abortOnError: false,
    });
    app.setGlobalPrefix(API_PREFIX);

    const configService = app.get(ConfigService);
    const netConfig = configService.get<NetConfig>(NetConfig.name);
    const serverConfig = configService.get<ServerConfig>(ServerConfig.name);
    if (!netConfig) throw new Error(`Unable to find ${NetConfig.name}`);
    if (!serverConfig) throw new Error(`Unable to find ${ServerConfig.name}`);

    return { app, netConfig, serverConfig, identity };
  }
}
