import { Injectable } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';
import { MacosPkgService } from '../services/macos-pkg.service.js';

// Entry point of the installer step of `desktop:package` (REQ-ECO-06: no other public name).
// Run after `tauri build --no-bundle`: `tools-cli installer-build`. Arguments are ignored.
// macOS builds a `.pkg` (MacosPkgService); any other OS reports "installer not implemented on <os>" and exits 0 so the native package stays valid.
// The Windows and Linux installers are technical debt: docs/backlog/td-windows-linux-distribution.md.
@Command({
  name: 'installer-build',
  description:
    'Build the installer of the desktop app for this OS: a .pkg on macOS, a notice elsewhere (REQ-ECO-06).',
  arguments: '[ignored...]',
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
@Injectable()
export class InstallerBuildCommand extends CommandRunner {
  constructor(private readonly macos: MacosPkgService) {
    super();
  }

  override run(): Promise<void> {
    const os = process.platform;
    if (os === 'darwin') {
      this.macos.build();
    } else {
      process.stdout.write(`installer not implemented on ${os}\n`);
    }
    return Promise.resolve();
  }
}
