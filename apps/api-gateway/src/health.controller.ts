import { Controller, Get } from '@nestjs/common';
import { ZodSerializerDto } from 'nestjs-zod';
import { HealthResponseDto } from './health.dto.js';
import { HealthState } from './health-state.js';

@Controller('health')
export class HealthController {
  constructor(private readonly state: HealthState) {}

  // Minimal unauthenticated body: only the aggregate state (whether more detail may be exposed is not verified).
  @Get()
  @ZodSerializerDto(HealthResponseDto)
  check(): HealthResponseDto {
    return { status: this.state.get() };
  }
}
