import type { Server } from 'node:http';
import { Logger } from '@nestjs/common';
import { InjectLogger, provideLogger } from 'shared-core';
import { AGGREGATE_STATE, CONTROL_KIND, EXIT_CODE, readyMessageSchema, shutdownMessageSchema } from 'service-registry';
import { AppBootstrap } from './app.bootstrap.js';
import { GATEWAY_NAME } from './constants/gateway-name.js';
import { HealthState } from './services/health-state.js';
import { createRedirectServer } from './redirect-listener.js';
import { receiveWebBundle } from './web-bundle.js';
import { createWebHandler } from './web-handler.js';

type AppContext = Awaited<ReturnType<typeof AppBootstrap.createAppContext>>;

class HttpAppMain {
  @InjectLogger() private declare readonly logger: Logger;

  private closing = false;

  static async main(): Promise<void> {
    await new HttpAppMain().run();
  }

  private async run(): Promise<void> {
    try {
      this.initLogger();
      const context = await this.createApp();
      await this.configureApp(context);
      await this.startApp(context);
    } catch (error) {
      this.handleFatal(error);
    }
  }

  private initLogger(): void {
    // First, before AppBootstrap and NestFactory.create (which gets no `logger` option, so it keeps this one).
    Logger.overrideLogger(provideLogger({ prefix: GATEWAY_NAME }));
  }

  private createApp(): Promise<AppContext> {
    return AppBootstrap.createAppContext();
  }

  private async configureApp({ app, serverConfig }: AppContext): Promise<void> {
    // Receive the bundle first, so a missing or invalid one fails before the database opens or a port opens.
    if (serverConfig.web === 'ipc') app.use(createWebHandler(await receiveWebBundle()));
    // Opens the database (DatabaseService.onModuleInit). Done here, not inside listen, so a database failure is not reported as a listen failure.
    await app.init();
  }

  private async startApp({ app, netConfig, identity }: AppContext): Promise<void> {
    const health = app.get(HealthState, { strict: false });
    const { bind, httpsPort, httpPort } = netConfig;
    try {
      await app.listen(httpsPort, bind);
    } catch (error) {
      throw this.listenError(`https://${bind}:${httpsPort}`, error);
    }
    this.logger.log(`https: listening on ${bind}:${httpsPort}`);
    const redirect = createRedirectServer({ names: identity.names, httpsPort });
    await this.listenRedirect(redirect, bind, httpPort);
    this.logger.log(`http: redirecting to https on ${bind}:${httpPort}`);
    if (process.send === undefined) {
      // Standalone run: no supervisor, so listening is ready.
      health.set(AGGREGATE_STATE.ready);
      return;
    }
    this.superviseApp(app, health, redirect, process.send.bind(process));
  }

  // Supervised run: tell the supervisor, then follow the aggregate state it sends back.
  // Stop on a shutdown message, or on disconnect when the supervisor died (REQ-RUNTIME-06). Disconnect logs nothing: the output pipe is gone too.
  private superviseApp(app: AppContext['app'], health: HealthState, redirect: Server, send: NonNullable<typeof process.send>): void {
    process.on('message', (raw) => {
      health.apply(raw);
      if (shutdownMessageSchema.safeParse(raw).success) void this.close(app, redirect, true);
    });
    process.once('disconnect', () => void this.close(app, redirect, false));
    send(readyMessageSchema.parse({ kind: CONTROL_KIND.ready }));
  }

  private async close(app: AppContext['app'], redirect: Server, announce: boolean): Promise<void> {
    if (this.closing) return;
    this.closing = true;
    await this.closeRedirect(redirect);
    await app.close();
    if (announce) this.logger.log('app.close() completed');
    process.exit(EXIT_CODE.ok);
  }

  private handleFatal(error: unknown): never {
    // A rejected top-level await makes Node print a line of the bundled source. The message plus exit code 1 is what the supervisor and the operator need.
    this.logger.error(`startup failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(EXIT_CODE.startupFailed);
  }

  // One line naming the address, so an operator sees which listener failed (for example a port already in use).
  private listenError(address: string, error: unknown): Error {
    return new Error(`cannot listen on ${address}: ${error instanceof Error ? error.message : String(error)}`);
  }

  private listenRedirect(server: Server, host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      server.once('error', (error) => reject(this.listenError(`http://${host}:${port}`, error)));
      server.listen(port, host, resolve);
    });
  }

  private closeRedirect(server: Server): Promise<void> {
    return new Promise((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }
}

await HttpAppMain.main();
