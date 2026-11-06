import { Module } from '@nestjs/common';
import { SidecarInput } from '../services/sidecar-input.js';
import { SidecarOutput } from '../services/sidecar-output.js';

// The three channels the host sees: stdin commands, stdout events, stderr log lines.
@Module({
  providers: [SidecarOutput, SidecarInput],
  exports: [SidecarOutput, SidecarInput],
})
export class SidecarModule {}
