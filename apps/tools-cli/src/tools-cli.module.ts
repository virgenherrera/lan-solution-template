import { Module } from '@nestjs/common';
import { BranchNameCommand } from './commands/branch-name.command.js';
import { CompileSeaCommand } from './commands/compile-sea.command.js';
import { DbParityCommand } from './commands/db-parity.command.js';
import { GenerateCertsCommand } from './commands/generate-certs.command.js';
import { InstallerBuildCommand } from './commands/installer-build.command.js';
import { InstallerMacosCommand } from './commands/installer-macos.command.js';
import { PackMigrationsCommand } from './commands/pack-migrations.command.js';
import { StageSidecarCommand } from './commands/stage-sidecar.command.js';
import { TestFilterCommand } from './commands/test-filter.command.js';
import { TrustCaCommand } from './commands/trust-ca.command.js';
import { VersionCheckCommand } from './commands/version-check.command.js';
import { NodeEngineService } from './sea/node-engine.service.js';
import { SeaAssetsService } from './sea/sea-assets.service.js';
import { SeaBundlerService } from './sea/sea-bundler.service.js';
import { SeaDependenciesService } from './sea/sea-dependencies.service.js';
import { SeaPaths } from './sea/sea-paths.service.js';
import { SeaTargetService } from './sea/sea-target.service.js';
import { MacosPkgService } from './services/macos-pkg.service.js';
import { MigrationPackService } from './services/migration-pack.service.js';
import { RepoRoot } from './services/repo-root.service.js';

@Module({
  providers: [
    BranchNameCommand,
    CompileSeaCommand,
    DbParityCommand,
    GenerateCertsCommand,
    InstallerBuildCommand,
    InstallerMacosCommand,
    PackMigrationsCommand,
    StageSidecarCommand,
    TestFilterCommand,
    TrustCaCommand,
    VersionCheckCommand,
    RepoRoot,
    MacosPkgService,
    MigrationPackService,
    NodeEngineService,
    SeaAssetsService,
    SeaBundlerService,
    SeaDependenciesService,
    SeaPaths,
    SeaTargetService,
  ],
})
export class ToolsCliModule {}
