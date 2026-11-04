// Native E2E of the desktop host (REQ-TEST-08, AC-20): the instrumented build starts the real sea-runtime sidecar.
import { readFileSync } from 'node:fs';
import { request } from 'node:https';
import { join } from 'node:path';

const base = process.env.DESKTOP_E2E_BASE;
const port = Number(process.env.DESKTOP_E2E_HTTPS_PORT);
const ca = readFileSync(join(base, 'certs', 'ca.crt'));

// The test process trusts the CA through its own `ca` option: the OS trust store is never touched.
const health = () =>
  new Promise((resolve) => {
    const req = request({ host: '127.0.0.1', port, path: '/api/health', ca, timeout: 2_000 }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', () => resolve(undefined));
    req.on('timeout', () => req.destroy());
    req.end();
  });

describe('desktop host', () => {
  it('spawns the sidecar and the gateway reports ready', async () => {
    await browser.waitUntil(async () => (await health())?.body.includes('ready') === true, { timeout: 60_000, interval: 500, timeoutMsg: '/api/health never reported ready' });
  });

  // The window is built by the host only after the supervisor reports ready (gateway.rs), so its handle proves the status event reached the host. The page itself is not asserted: the OS does not trust this run's CA, by design.
  it('creates the main window once the sidecar is ready', async () => {
    const handles = await browser.getWindowHandles();
    if (!handles.includes('main')) throw new Error(`no main window handle: ${JSON.stringify(handles)}`);
  });
});
