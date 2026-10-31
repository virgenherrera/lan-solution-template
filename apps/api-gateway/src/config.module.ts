import { Module, type DynamicModule } from '@nestjs/common';
import { SERVER_CONFIG, type ServerConfig } from './server-config.js';

@Module({})
export class ConfigModule {
  static register(config: ServerConfig): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: SERVER_CONFIG, useValue: config }],
      exports: [SERVER_CONFIG],
    };
  }
}
