import { Module } from '@nestjs/common';
import { BranchNameCommand } from './commands/branch-name.command.js';
import { VersionCheckCommand } from './commands/version-check.command.js';

@Module({
  providers: [BranchNameCommand, VersionCheckCommand],
})
export class ToolsCliModule {}
