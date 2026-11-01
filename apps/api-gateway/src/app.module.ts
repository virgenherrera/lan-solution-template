import { Module, type DynamicModule } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ConfigModule } from './config.module.js';
import { HealthController } from './health.controller.js';
import { type ServerConfig } from './server-config.js';

@Module({
  controllers: [HealthController],
})
export class AppModule {
  static register(config: ServerConfig): DynamicModule {
    const imports: DynamicModule['imports'] = [ConfigModule.register(config)];
    if (config.webRoot !== undefined) {
      imports.push(ServeStaticModule.forRoot({ rootPath: config.webRoot }));
    }
    return { module: AppModule, imports };
  }
}
