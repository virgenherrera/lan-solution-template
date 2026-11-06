import type { Server } from 'node:http';
import { AGGREGATE_STATE, CONTROL_KIND, EXIT_CODE, readyMessageSchema, shutdownMessageSchema } from 'service-registry';
import { AppBootstrap } from './app.bootstrap.js';
import { HealthState } from './health-state.js';
import { createRedirectServer } from './redirect-listener.js';
import { receiveWebBundle } from './web-bundle.js';
import { createWebHandler } from './web-handler.js';

class HttpAppMain {
  static async main(): Promise<void> {
    try {
      await this.bootstrapHttpServer();
    } catch (error) {
      // A rejected top-level await makes Node print a line of the bundled source. The message plus exit code 1 is what the supervisor and the operator need.
      process.stderr.write(`startup failed: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(EXIT_CODE.startupFailed);
    }
  }

  private static async bootstrapHttpServer(): Promise<void> {
    const { app, netConfig, serverConfig, identity } = await AppBootstrap.createAppContext();
    // Receive the bundle first, so a missing or invalid one fails before the database opens or a port opens.
    if (serverConfig.web === 'ipc') app.use(createWebHandler(await receiveWebBundle()));
    // Opens the database (DatabaseService.onModuleInit). Done here, not inside listen, so a database failure is not reported as a listen failure.
    await app.init();
    const health = app.get(HealthState, { strict: false });
    const { bind, httpsPort, httpPort } = netConfig;
    try {
      await app.listen(httpsPort, bind);
    } catch (error) {
      throw this.listenError(`https://${bind}:${httpsPort}`, error);
    }
    console.error(`https: listening on ${bind}:${httpsPort}`);
    const redirect = createRedirectServer({ names: identity.names, httpsPort });
    await this.listenRedirect(redirect, bind, httpPort);
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
      await this.closeRedirect(redirect);
      await app.close();
      if (announce) console.log('app.close() completed');
      process.exit(EXIT_CODE.ok);
    };
    process.on('message', (raw) => {
      health.apply(raw);
      if (shutdownMessageSchema.safeParse(raw).success) void close(true);
    });
    process.once('disconnect', () => void close(false));
    process.send(readyMessageSchema.parse({ kind: CONTROL_KIND.ready }));
  }

  // One line naming the address, so an operator sees which listener failed (for example a port already in use).
  private static listenError(address: string, error: unknown): Error {
    return new Error(`cannot listen on ${address}: ${error instanceof Error ? error.message : String(error)}`);
  }

  private static listenRedirect(server: Server, host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      server.once('error', (error) => reject(this.listenError(`http://${host}:${port}`, error)));
      server.listen(port, host, resolve);
    });
  }

  private static closeRedirect(server: Server): Promise<void> {
    return new Promise((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }
}

await HttpAppMain.main();
