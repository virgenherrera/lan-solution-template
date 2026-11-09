import { Injectable } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';
import { MacosPkgService } from '../services/macos-pkg.service.js';

// Builds the macOS installer `.pkg` with pkgbuild and productbuild (the work lives in MacosPkgService). It never signs or installs anything.
// Usage: `tools-cli installer-macos`, after `tauri build --no-bundle` has produced the host and the sidecar. Arguments are ignored.
// A missing input or a failing packaging tool throws: ToolsCliMain prints `tools-cli: <message>` and exits 1.
@Command({
  name: 'installer-macos',
  description: 'Build the macOS installer .pkg of the desktop app with pkgbuild and productbuild (ADR-007).',
  arguments: '[ignored...]',
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
@Injectable()
export class InstallerMacosCommand extends CommandRunner {
  constructor(private readonly pkg: MacosPkgService) {
    super();
  }

  override run(): Promise<void> {
    this.pkg.build();
    return Promise.resolve();
  }
}
