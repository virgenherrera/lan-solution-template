import { Module } from '@nestjs/common';
import { BranchNameCommand } from './commands/branch-name.command.js';

@Module({
  providers: [BranchNameCommand],
})
export class ToolsCliModule {}
