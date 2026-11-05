import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health.controller.js';
import { DbIndicator, MemoryIndicator, StateIndicator, UptimeIndicator } from './health.indicators.js';
import { HealthState } from './health-state.js';

@Module({
  imports: [TerminusModule, DatabaseModule],
  controllers: [HealthController],
  providers: [HealthState, StateIndicator, UptimeIndicator, MemoryIndicator, DbIndicator],
})
export class HealthModule {}
