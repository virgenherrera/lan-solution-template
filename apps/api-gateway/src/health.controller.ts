import { Controller, Get } from '@nestjs/common';
import { type AggregateState } from 'service-registry';
import { HealthState } from './health-state.js';

@Controller('health')
export class HealthController {
  constructor(private readonly state: HealthState) {}

  // Minimal unauthenticated body: only the aggregate state (whether more detail may be exposed is not verified).
  @Get()
  check(): { status: AggregateState } {
    return { status: this.state.get() };
  }
}
