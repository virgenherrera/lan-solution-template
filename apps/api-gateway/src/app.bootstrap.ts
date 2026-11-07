import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NodeAdapter } from '@nestjs/platform-node';
import type { LoggerService } from '@nestjs/common';
import { hostname, networkInterfaces } from 'node:os';
import { NetConfig } from 'shared-core';
import { loadTlsIdentity, type TlsIdentity } from 'shared-core/tls';
import { API_PREFIX } from './api-prefix.js';
import { AppModule } from './app.module.js';
import { GatewayConfigSource } from './services/config-source.js';
import type { AppContext } from './interfaces/app-context.js';
import { ServerConfig } from './schemas/server-config.js';

export class AppBootstrap {
  static async createAppContext(logger: LoggerService): Promise<AppContext> {
    ServerConfig.fromArgv(process.argv);
    const identity = AppBootstrap.loadReadOnlyTlsIdentity(logger);
    const app = await NestFactory.create(AppModule, new NodeAdapter(), {
      logger,
      httpsOptions: { key: identity.key, cert: identity.cert },
      abortOnError: false,
    });
    app.setGlobalPrefix(API_PREFIX);

    const configService = app.get(ConfigService);
    const netConfig = AppBootstrap.requireConfig<NetConfig>(configService, NetConfig.name);
    const serverConfig = AppBootstrap.requireConfig<ServerConfig>(configService, ServerConfig.name);

    return { app, netConfig, serverConfig, identity };
  }

  private static loadReadOnlyTlsIdentity(logger: LoggerService): TlsIdentity {
    const { tls } = GatewayConfigSource.file();
    return loadTlsIdentity({
      paths: GatewayConfigSource.paths,
      tls,
      now: new Date(),
      log: (message) => logger.log(message, AppBootstrap.name),
      hostname: hostname(),
      interfaces: networkInterfaces(),
    });
  }

  private static requireConfig<T>(configService: ConfigService, name: string): T {
    const config = configService.get<T>(name);
    if (!config) throw new Error(`Unable to find ${name}`);
    return config;
  }
}
