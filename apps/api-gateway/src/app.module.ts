import { Module } from '@nestjs/common';
import { CoreModule } from './modules/core.module.js';
import { HealthModule } from './modules/health.module.js';

@Module({
  imports: [CoreModule, HealthModule],
})
export class AppModule {}
