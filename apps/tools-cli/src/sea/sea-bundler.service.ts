import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Injectable } from '@nestjs/common';
import { ASSEMBLER_CONFIG, DISPATCHER_CONFIG, useCodeCache } from 'service-registry';
import type { RspackOptions } from '@rspack/core';
import { type BuiltService, type WebBundle } from './sea-dependencies.service.js';
import { SeaAssetsService } from './sea-assets.service.js';
import { SeaPaths } from './sea-paths.service.js';
import { SeaTargetService, type BuildTarget } from './sea-target.service.js';

type RspackNamespace = typeof import('@rspack/core');

// The shared Nest rspack overrides of tools/rspack/nest.config.ts: externals and ignore rules for the bundle.
type SharedNestConfig = (
  defaults: { plugins: unknown[] },
  rspack: RspackNamespace,
) => Pick<RspackOptions, 'externals' | 'optimization'> & { plugins: NonNullable<RspackOptions['plugins']> };

// Bundles the SEA entry into one ESM file, writes the SEA config and turns it into the executable with `node --build-sea`.
@Injectable()
export class SeaBundlerService {
  constructor(
    private readonly paths: SeaPaths,
    private readonly targets: SeaTargetService,
    private readonly assets: SeaAssetsService,
  ) {}

  // The entry (sea-entry.ts) picks the role through the dispatcher and reaches each registered service with one import() context, so only registered services reach the bundle.
  stageServices(services: BuiltService[]): void {
    mkdirSync(this.paths.servicesDir, { recursive: true });
    for (const s of services) copyFileSync(s.entryPath, join(this.paths.servicesDir, `${s.service}.js`));
  }

  // One ESM file. Externals and ignore rules come from the shared Nest config; the banner gives CommonJS dependencies a real require.
  async bundle(supervisorEntry: string, certsCommandEntry: string): Promise<void> {
    const rspack = await this.loadRspack();
    const shared = await this.loadSharedConfig(rspack);
    await this.runRspack(rspack, {
      mode: 'production',
      devtool: false,
      target: 'node',
      entry: this.paths.seaEntry,
      resolve: {
        extensionAlias: { '.js': ['.ts', '.js'] },
        alias: { 'sea-services': this.paths.servicesDir, 'sea-supervisor$': supervisorEntry, 'sea-certs-command$': certsCommandEntry },
      },
      module: {
        rules: [{ test: /\.ts$/, loader: 'builtin:swc-loader', type: 'javascript/auto', options: { jsc: { parser: { syntax: 'typescript' }, target: 'es2023' } } }],
      },
      output: {
        path: this.paths.workDir,
        filename: 'sea-app.mjs',
        module: true,
        library: { type: 'module' },
        chunkFormat: 'module',
      },
      externals: shared.externals,
      optimization: shared.optimization,
      plugins: [
        ...shared.plugins,
        new rspack.BannerPlugin({
          raw: true,
          banner: "import { createRequire as __seaCreateRequire } from 'node:module'; const require = __seaCreateRequire(import.meta.url);",
        }),
      ],
    });
  }

  // REQ-SEA-03 baseline from ASSEMBLER_CONFIG; the code cache follows the native/cross rule; a cross build names the target's Node as the SEA base.
  writeSeaConfig(binaryPath: string, web: WebBundle | undefined, target: BuildTarget, vector: Record<string, string>): void {
    const config = {
      main: this.paths.bundlePath,
      mainFormat: ASSEMBLER_CONFIG.mainFormat,
      output: binaryPath,
      ...(target.executable === undefined ? {} : { executable: target.executable }),
      useVfs: ASSEMBLER_CONFIG.useVfs,
      useSnapshot: ASSEMBLER_CONFIG.useSnapshot,
      useCodeCache: useCodeCache(this.targets.hostTriple(), target.triple),
      execArgvExtension: ASSEMBLER_CONFIG.execArgvExtension,
      assets: { [DISPATCHER_CONFIG.servicesAsset]: this.paths.servicesPath, ...this.assets.web(web), ...vector, ...this.assets.migrations() },
    };
    writeFileSync(this.paths.configPath, `${JSON.stringify(config, null, 2)}\n`);
  }

  buildSea(binaryPath: string, target: BuildTarget): void {
    execFileSync(process.execPath, ['--build-sea', this.paths.configPath], { stdio: 'inherit' });
    // The Node SEA doc requires an ad-hoc signature on macOS; an unsigned arm64 binary is killed at start. codesign only runs for a macOS target built on macOS.
    if (process.platform === 'darwin' && target.triple.endsWith('-apple-darwin')) {
      execFileSync('codesign', ['--sign', '-', binaryPath], { stdio: 'inherit' });
    }
  }

  // The native rspack binding cannot travel inside the tools-cli bundle: it loads from the workspace node_modules at run time.
  private async loadRspack(): Promise<RspackNamespace> {
    return (await import(/* webpackIgnore: true */ '@rspack/core')) as RspackNamespace;
  }

  // tools/rspack/nest.config.ts is TypeScript that Node runs as is; it stays outside the bundle so the assembler and the Nest builds read one file.
  private async loadSharedConfig(rspack: RspackNamespace): Promise<ReturnType<SharedNestConfig>> {
    const module = (await import(/* webpackIgnore: true */ pathToFileURL(this.paths.sharedNestConfig).href)) as { default: SharedNestConfig };
    return module.default({ plugins: [] }, rspack);
  }

  private runRspack(rspack: RspackNamespace, options: RspackOptions): Promise<void> {
    return new Promise((resolvePromise, reject) => {
      rspack.rspack(options, (error, stats) => {
        if (error) return reject(error);
        if (stats?.hasErrors()) return reject(new Error(stats.toString({ all: false, errors: true })));
        resolvePromise();
      });
    });
  }
}
