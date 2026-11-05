import { Controller, Get, Query } from '@nestjs/common';
import { HealthCheckService, type HealthIndicatorFunction } from '@nestjs/terminus';
import { ZodSerializerDto } from 'nestjs-zod';
import { HealthQueryDto, HealthResponseDto } from './health.dto.js';
import { DbIndicator, MemoryIndicator, StateIndicator, UptimeIndicator } from './health.indicators.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly state: StateIndicator,
    private readonly uptime: UptimeIndicator,
    private readonly memory: MemoryIndicator,
    private readonly db: DbIndicator,
  ) {}

  // Unauthenticated: the report exposes only what the query flags ask for (whether more detail may be exposed is not verified). A failed indicator answers 503 with the terminus body.
  @Get()
  @ZodSerializerDto(HealthResponseDto)
  check(@Query() query: HealthQueryDto): Promise<HealthResponseDto> {
    const indicators: HealthIndicatorFunction[] = [() => this.state.check()];
    if (query.uptime) indicators.push(() => this.uptime.check());
    if (query.memory) indicators.push(() => this.memory.check());
    if (query.db) indicators.push(() => this.db.check());
    return this.health.check(indicators);
  }
}
