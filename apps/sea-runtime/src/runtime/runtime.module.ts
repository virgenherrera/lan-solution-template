import { Module } from '@nestjs/common';
import { SupervisorService } from '../supervisor/supervisor.service.js';

@Module({
  providers: [SupervisorService],
})
export class RuntimeModule {}
