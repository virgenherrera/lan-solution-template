import { Module } from '@nestjs/common';
import { SERVER_CONFIG, parseServerConfig } from './server-config.js';

@Module({
  providers: [
    {
      provide: SERVER_CONFIG,
      useFactory: () => parseServerConfig({}),
    },
  ],
  exports: [SERVER_CONFIG],
})
export class ConfigModule {}
