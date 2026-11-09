// Native E2E of the desktop host (REQ-TEST-08, AC-20): the instrumented build starts the real sea-runtime sidecar.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { request } from 'node:https';
import { join } from 'node:path';
import { browser } from '@wdio/globals';

const base = process.env.DESKTOP_E2E_BASE ?? '';
const port = Number(process.env.DESKTOP_E2E_HTTPS_PORT);
const ca = readFileSync(join(base, 'certs', 'ca.crt'));

// The test process trusts the CA through its own `ca` option: the OS trust store is never touched.
const health = (): Promise<{ status: number | undefined; body: string } | undefined> =>
  new Promise((resolve) => {
    const req = request({ host: '127.0.0.1', port, path: '/api/health', ca, timeout: 2_000 }, (res) => {
      let body = '';
      res.on('data', (c: Buffer) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', () => resolve(undefined));
    req.on('timeout', () => req.destroy());
    req.end();
  });

// The service writes the host log (stderr of the app) under <base>/wdio-logs.
const hostLog = () => {
  const dir = join(base, 'wdio-logs');
  return existsSync(dir) ? readdirSync(dir).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n') : '';
};

describe('desktop host', () => {
  it('spawns the sidecar and the gateway reports ready', async () => {
    await browser.waitUntil(async () => (await health())?.body.includes('ready') === true, { timeout: 60_000, interval: 500, timeoutMsg: '/api/health never reported ready' });
  });
});

// Startup flow (REQ-TEST-08): the window opens on the splash while the sidecar boots, then the same window is sent to the app at /. The OS does not trust this run's CA, by design, so the WebView never commits the gateway page: the move to / is asserted on the host log, not on the page.
describe('startup splash', () => {
  it('shows the splash first and then moves the window to the app at /', async () => {
    // Arrange: the main window exists from the start, before the gateway is ready.
    await browser.switchToWindow('main');
    // Act + Assert: the splash is what the window shows.
    await expect($('#splash')).toBeDisplayed();
    // Act: wait for the host to send the window to the gateway origin.
    const target = `window reloaded url=https://127.0.0.1:${port}/`;
    await browser.waitUntil(() => hostLog().includes(target), { timeout: 60_000, interval: 500, timeoutMsg: `no "${target}" in the host log` });
    // Assert: the splash came first.
    const log = hostLog();
    if (!(log.indexOf('splash shown') >= 0 && log.indexOf('splash shown') < log.indexOf(target))) throw new Error('"splash shown" does not precede the move to /');
  });
});

// A2: the window may only stay on https://127.0.0.1:<httpsPort>. The page is not trusted in this run (the window URL reads about:blank), so the assertions are that the URL does not change and that the host log records each block.
describe('navigation filter', () => {
  const foreign = ['https://example.com/', `http://127.0.0.1:${port + 1}/`, `http://127.0.0.1:${port}/`, 'ftp://127.0.0.1/'];
  it('blocks every navigation outside the gateway origin and logs it', async () => {
    await browser.switchToWindow('main');
    const before = await browser.getUrl();
    for (const target of foreign) {
      await browser.url(target).catch(() => undefined);
      await browser.waitUntil(() => hostLog().includes(`navigation blocked url=${target}`), { timeout: 15_000, interval: 500, timeoutMsg: `no "navigation blocked" log for ${target}` });
      const after = await browser.getUrl();
      if (after !== before) throw new Error(`window URL changed after ${target}: ${before} -> ${after}`);
    }
  });
});
