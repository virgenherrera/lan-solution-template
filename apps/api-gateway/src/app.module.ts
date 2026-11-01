import { Module, type DynamicModule } from '@nestjs/common';
import { ConfigModule } from './config.module.js';
import { HealthController } from './health.controller.js';
import { type ServerConfig } from './server-config.js';

@Module({
  controllers: [HealthController],
})
export class AppModule {
  static register(config: ServerConfig): DynamicModule {
    return { module: AppModule, imports: [ConfigModule.register(config)] };
  }
}
