import { Module } from '@nestjs/common';
import { BranchNameCommand } from './commands/branch-name.command.js';
import { StageSidecarCommand } from './commands/stage-sidecar.command.js';
import { TestFilterCommand } from './commands/test-filter.command.js';
import { TrustCaCommand } from './commands/trust-ca.command.js';
import { VersionCheckCommand } from './commands/version-check.command.js';

@Module({
  providers: [BranchNameCommand, StageSidecarCommand, TestFilterCommand, TrustCaCommand, VersionCheckCommand],
})
export class ToolsCliModule {}
