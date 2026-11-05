import { NestFactory } from '@nestjs/core';
import { NodeAdapter } from '@nestjs/platform-node';
import type { Server } from 'node:http';
import { hostname, networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { AGGREGATE_STATE, CONTROL_KIND, readyMessageSchema, shutdownMessageSchema } from 'service-registry';
import { CONFIG_FILE, loadConfig } from 'shared-core';
import { loadTlsIdentity } from 'shared-core/tls';
import { resolveAppPaths } from './app-paths.js';
import { AppModule } from './app.module.js';
import { HealthState } from './health-state.js';
import { createRedirectServer } from './redirect-listener.js';
import { parseServerConfig } from './server-config.js';
import { receiveWebBundle } from './web-bundle.js';
import { createWebHandler } from './web-handler.js';

// One line naming the address, so an operator sees which listener failed (for example a port already in use).
function listenError(address: string, error: unknown): Error {
  return new Error(`cannot listen on ${address}: ${error instanceof Error ? error.message : String(error)}`);
}

function listenRedirect(server: Server, host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', (error) => reject(listenError(`http://${host}:${port}`, error)));
    server.listen(port, host, resolve);
  });
}

function closeRedirect(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections();
  });
}

async function bootstrap() {
  const serverConfig = parseServerConfig(process.argv.slice(2));
  // The one config read of this process: the TLS identity is validated before Nest builds the HTTPS server. A missing or invalid config stops the start here.
  const paths = resolveAppPaths();
  const config = loadConfig(paths);
  // Both listeners bind the same address: equal ports could only fail later with EADDRINUSE, so name the keys now.
  if (config.net.httpPort === config.net.httpsPort) throw new Error('config net.httpPort must differ from net.httpsPort');
  // Read-only: the gateway never creates or renews certificates. Missing or invalid files stop the start here, with the command that fixes them.
  const identity = loadTlsIdentity({
    paths,
    config,
    now: new Date(),
    log: (message) => console.error(message),
    hostname: hostname(),
    interfaces: networkInterfaces(),
  });
  // Receive the bundle first, so a missing or invalid one fails before the port opens.
  const web = serverConfig.web === 'ipc' ? await receiveWebBundle() : undefined;
  const app = await NestFactory.create(AppModule.register(() => ({ ...config, server: serverConfig }), join(paths.configDir, CONFIG_FILE)), new NodeAdapter(), {
    httpsOptions: { key: identity.key, cert: identity.cert },
  });
  app.setGlobalPrefix('api');
  if (web !== undefined) app.use(createWebHandler(web));
  const health = app.get(HealthState);
  const { bind, httpsPort, httpPort } = config.net;
  try {
    await app.listen(httpsPort, bind);
  } catch (error) {
    throw listenError(`https://${bind}:${httpsPort}`, error);
  }
  console.error(`https: listening on ${bind}:${httpsPort}`);
  const redirect = createRedirectServer({ names: identity.names, httpsPort });
  await listenRedirect(redirect, bind, httpPort);
  console.error(`http: redirecting to https on ${bind}:${httpPort}`);
  if (process.send === undefined) {
    // Standalone run: no supervisor, so listening is ready.
    health.set(AGGREGATE_STATE.ready);
    return;
  }
  // Supervised run: tell the supervisor, then follow the aggregate state it sends back.
  // Stop on a shutdown message, or on disconnect when the supervisor died (REQ-RUNTIME-06). Disconnect logs nothing: the output pipe is gone too.
  let closing = false;
  const close = async (announce: boolean): Promise<void> => {
    if (closing) return;
    closing = true;
    await closeRedirect(redirect);
    await app.close();
    if (announce) console.log('app.close() completed');
    process.exit(0);
  };
  process.on('message', (raw) => {
    health.apply(raw);
    if (shutdownMessageSchema.safeParse(raw).success) void close(true);
  });
  process.once('disconnect', () => void close(false));
  process.send(readyMessageSchema.parse({ kind: CONTROL_KIND.ready }));
}
try {
  await bootstrap();
} catch (error) {
  // A rejected top-level await makes Node print a line of the bundled source. The message plus exit code 1 is what the supervisor and the operator need.
  process.stderr.write(`startup failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
