import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NodeAdapter } from '@nestjs/platform-node';
import { Logger, type INestApplication } from '@nestjs/common';
import { hostname, networkInterfaces } from 'node:os';
import { NetConfig, PLAIN_CONTEXT } from 'shared-core';
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
    // First, so an invalid --web fails before the config or the TLS files are read.
    ServerConfig.fromArgv(process.argv.slice(2));
    // Read-only: the gateway never creates or renews certificates. Missing or invalid files (and a missing or invalid config) stop the start here, with the command that fixes them.
    // This is the only use of the config outside Nest: NodeAdapter builds the HTTPS server from `httpsOptions` while the app is created, before ConfigService exists. Creating the app twice instead would open the database twice.
    const { tls } = GatewayConfigSource.file();
    const identity = loadTlsIdentity({
      paths: GatewayConfigSource.paths,
      tls,
      now: new Date(),
      log: (message) => new Logger(PLAIN_CONTEXT).log(message),
      hostname: hostname(),
      interfaces: networkInterfaces(),
    });
    const app = await NestFactory.create(AppModule, new NodeAdapter(), {
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
