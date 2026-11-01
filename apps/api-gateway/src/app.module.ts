import { Module, type DynamicModule } from '@nestjs/common';
import { ConfigModule } from './config.module.js';
import { HealthController } from './health.controller.js';
import { HealthState } from './health-state.js';
import { type ServerConfig } from './server-config.js';

@Module({
  controllers: [HealthController],
  providers: [HealthState],
})
export class AppModule {
  static register(config: ServerConfig): DynamicModule {
    return { module: AppModule, imports: [ConfigModule.register(config)] };
  }
}
