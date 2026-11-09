import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Injectable } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';
import { ASSEMBLER_CONFIG, EXIT_CODE, serviceEntries, servicesAssetSchema, useCodeCache, type DeclaredServices } from 'service-registry';
import { ExitError } from '../constants/exit-error.js';
import { NodeEngineService } from '../sea/node-engine.service.js';
import { SeaAssetsService } from '../sea/sea-assets.service.js';
import { SeaBundlerService } from '../sea/sea-bundler.service.js';
import { SeaDependenciesService } from '../sea/sea-dependencies.service.js';
import { SeaPaths } from '../sea/sea-paths.service.js';
import { SeaTargetService, type BuildTarget } from '../sea/sea-target.service.js';

// Packages a supervisor app and its workspace service dependencies into ONE Node SEA executable.
// Run from anywhere: `tools-cli compile-sea <supervisor-project> [--target <triple> --executable <node-binary>]`.
// Without --target the build is native (host triple). A different --target is a cross build: it needs --executable (the Node binary of the target, used as the SEA base) and turns the code cache off (REQ-SEA-03). Cross builds are not verified.
// Dependencies of the supervisor (`workspace:` ranges) are classified by build output (SeaDependenciesService): a service, at most one web bundle, or a library.
// The SEA entry is TypeScript (apps/sea-runtime/src/sea-entry.ts); the bundle, the staged service bootstraps and the SEA config are written under dist/ at build time and are never committed.
// Run `tools-cli pack-migrations` first: the packed migrations travel in the executable. Exit codes: 0 built, 1 error (the message goes to stderr as the retired script printed it).
@Command({
  name: 'compile-sea',
  description: 'Package a supervisor app and its workspace services into one Node SEA executable under artifacts/<supervisor> (REQ-SEA-01).',
  arguments: '[args...]',
  // The command parses its own options (strict), so a wrong one keeps the retired script's message and exit 1.
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
@Injectable()
export class CompileSeaCommand extends CommandRunner {
  constructor(
    private readonly paths: SeaPaths,
    private readonly targets: SeaTargetService,
    private readonly engine: NodeEngineService,
    private readonly dependencies: SeaDependenciesService,
    private readonly assets: SeaAssetsService,
    private readonly bundler: SeaBundlerService,
  ) {
    super();
  }

  override async run(passedParams: string[]): Promise<void> {
    try {
      await this.compile(passedParams);
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      throw new ExitError(EXIT_CODE.startupFailed);
    }
  }

  private async compile(args: readonly string[]): Promise<void> {
    const { supervisor, target } = this.targets.resolve(args);
    this.engine.assertBuildNodeMatchesEngine();

    const serviceEntry = ASSEMBLER_CONFIG.serviceEntry;
    const supervisorDir = this.dependencies.projectRoot(supervisor);
    const supervisorEntry = join(supervisorDir, serviceEntry);
    if (!existsSync(supervisorEntry)) {
      throw new Error(`${supervisor}: missing ${supervisorEntry}; run the ${supervisor} build target first`);
    }
    // The `--generate-certs` operation lives in shared-core (a built workspace dependency of the supervisor); it is not part of the library's public exports.
    const certsCommandEntry = join(this.dependencies.projectRoot('shared-core'), 'dist', 'tls', 'certs-command.js');
    if (!existsSync(certsCommandEntry)) {
      throw new Error(`shared-core: missing ${certsCommandEntry}; run the shared-core build target first`);
    }
    const built = this.dependencies.discover(supervisor, supervisorDir, serviceEntry);
    const declared = serviceEntries(await this.declaredServices());
    const services = this.dependencies.resolveRoutes(declared, built.services, supervisor, serviceEntry);
    const web = built.web;
    process.stdout.write(
      `supervisor ${supervisor}; services: ${declared.filter((r) => r.enabled).map((r) => r.id).join(', ')}; web: ${web?.name ?? 'none'}; target ${target.triple}; code cache ${useCodeCache(this.targets.hostTriple(), target.triple) ? 'on' : 'off'}\n`,
    );

    const binaryPath = this.prepareOutput(supervisor, target);
    this.bundler.stageServices(services);
    writeFileSync(this.paths.servicesPath, `${JSON.stringify(servicesAssetSchema.parse({ services: declared }), null, 2)}\n`);
    await this.bundler.bundle(supervisorEntry, certsCommandEntry);
    const vector = await this.assets.vector(target);
    this.bundler.writeSeaConfig(binaryPath, web, target, vector);
    this.bundler.buildSea(binaryPath, target);

    process.stdout.write(`sea executable: ${binaryPath} (${statSync(binaryPath).size} bytes)\n`);
  }

  // The services the supervisor runs: a TypeScript table that stays in the sea-runtime sources, so it is read at run time and not bundled into this CLI.
  private async declaredServices(): Promise<DeclaredServices> {
    const module = (await import(/* webpackIgnore: true */ pathToFileURL(this.paths.seaServicesSource).href)) as { SERVICES: DeclaredServices };
    return module.SERVICES;
  }

  // Starts from clean work and artifact folders and returns the path of the executable to build.
  private prepareOutput(supervisor: string, target: BuildTarget): string {
    const artifactDir = this.paths.artifactDir(supervisor);
    const binaryName = `${supervisor}-${target.triple}${target.triple.includes('windows') ? '.exe' : ''}`;
    rmSync(this.paths.workDir, { recursive: true, force: true });
    rmSync(artifactDir, { recursive: true, force: true });
    mkdirSync(this.paths.workDir, { recursive: true });
    mkdirSync(artifactDir, { recursive: true });
    return join(artifactDir, binaryName);
  }
}
