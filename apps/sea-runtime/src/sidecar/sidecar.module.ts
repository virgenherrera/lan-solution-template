import { Module } from '@nestjs/common';
import { SidecarInput } from './sidecar-input.js';
import { SidecarOutput } from './sidecar-output.js';

// The three channels the host sees: stdin commands, stdout events, stderr log lines.
@Module({
  providers: [SidecarOutput, SidecarInput],
  exports: [SidecarOutput, SidecarInput],
})
export class SidecarModule {}
