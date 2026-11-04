// WebdriverIO config for the native desktop E2E (REQ-TEST-08, AC-20). Run it through `pnpm run e2e` (tools/scripts/e2e-desktop.ts), which builds the instrumented host and sets the DESKTOP_E2E_* variables.
// macOS has no native WKWebView driver, so the service's embedded WebDriver server is the provider. Windows and Linux (tauri-driver) are not verified.
const app = process.env.DESKTOP_E2E_APP;
if (!app) throw new Error('DESKTOP_E2E_APP is not set: run "pnpm run e2e" from apps/desktop');

// The service writes the host log (stderr of the app) here, so the E2E can read the navigation blocks (A2). It lives in the temporary base directory.
export const config: WebdriverIO.Config = {
  outputDir: process.env.DESKTOP_E2E_BASE ? `${process.env.DESKTOP_E2E_BASE}/wdio-logs` : undefined,
  runner: 'local',
  specs: ['./e2e/*.e2e.ts'],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: { timeout: 120_000 },
  capabilities: [{ browserName: 'tauri', 'wdio:tauriServiceOptions': { appBinaryPath: app, driverProvider: 'embedded' } }],
  services: [['tauri', { driverProvider: 'embedded', captureBackendLogs: true, backendLogLevel: 'info' }]],
};
