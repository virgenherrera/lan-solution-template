// Entry point of the installer step of `desktop:package` (REQ-ECO-06: no other public name).
// Run after `tauri build --no-bundle`: `node tools/scripts/installer-build.ts`.
// macOS builds a `.pkg`; any other OS reports "installer not implemented on <os>" and exits 0 so the native package stays valid.
// The Windows and Linux installers are technical debt: docs/backlog/td-windows-linux-distribution.md.
const os = process.platform;

if (os === 'darwin') {
  const { buildMacosPkg } = await import('./installer-macos.ts');
  buildMacosPkg();
} else {
  console.log(`installer not implemented on ${os}`);
}
