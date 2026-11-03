import { Module } from '@nestjs/common';
import { SidecarInput } from './sidecar-input.js';
import { SidecarOutput } from './sidecar-output.js';
import { SupervisorLogger } from './supervisor-logger.js';

// The three channels the host sees: stdin commands, stdout events, stderr log lines.
@Module({
  providers: [SupervisorLogger, SidecarOutput, SidecarInput],
  exports: [SupervisorLogger, SidecarOutput, SidecarInput],
})
export class SidecarModule {}
