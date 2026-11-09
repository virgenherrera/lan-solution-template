import { Module } from '@nestjs/common';
import { BranchNameCommand } from './commands/branch-name.command.js';
import { StageSidecarCommand } from './commands/stage-sidecar.command.js';
import { VersionCheckCommand } from './commands/version-check.command.js';

@Module({
  providers: [BranchNameCommand, StageSidecarCommand, VersionCheckCommand],
})
export class ToolsCliModule {}
