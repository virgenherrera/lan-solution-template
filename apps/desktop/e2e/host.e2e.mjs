// Native E2E of the desktop host (REQ-TEST-08, AC-20): the instrumented build starts the real sea-runtime sidecar.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

// A2: the window may only stay on https://127.0.0.1:<httpsPort>. The page is not trusted in this run (the window URL reads about:blank), so the assertions are that the URL does not change and that the host log records each block.
describe('navigation filter', () => {
  const foreign = ['https://example.com/', `http://127.0.0.1:${port + 1}/`, `http://127.0.0.1:${port}/`, 'ftp://127.0.0.1/'];
  const hostLog = () => {
    const dir = join(base, 'wdio-logs');
    return existsSync(dir) ? readdirSync(dir).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n') : '';
  };

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
